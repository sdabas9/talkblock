# Terminal Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard tab as a theme-adaptive "Data Terminal": a KPI stat strip for compact bookmarks plus a strict 4-column module grid with dashboard-native renderers for every tool.

**Architecture:** Pure CSS Grid with a per-tool module map (`tile` | `panel` | `wide`). A shared panel chrome (`dashboard-panel.tsx`) wraps per-tool renderers in `components/dashboard/renderers/`; compact tools render as stat tiles in a strip. Existing stores, refresh logic (`lib/antelope/refetch.ts`), and HTML5 drag-reorder are reused unchanged.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (theme tokens via `@theme inline`), shadcn/ui, lucide-react. **No new dependencies.**

**Spec:** `docs/plans/2026-07-06-terminal-dashboard-design.md` — read it before starting.

## Global Constraints

- No new npm dependencies.
- Zero hard-coded colors: only theme tokens (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `text-destructive`, `border-t-chart-2`). Must look right in all 5 themes (root/light, `dim`, `dusk`, `gold`, `orange`).
- All data text uses `font-mono`; numbers get `tabular-nums`. Panels use `rounded-none`, 1px borders, no shadows.
- Chat components (`components/chat/**`) are untouched, except `TxProposalCard` being *imported* by the dashboard.
- No test infrastructure exists. Per-task verification = `npm run lint` (no new errors) + `npm run build` (compiles successfully). Final task is a manual visual pass.
- Direction accents: inbound `text-primary` + `←`, outbound `text-destructive` + `→` (arrow ensures color is not the only signal).
- Commit after every task.

## Data shapes (from `lib/antelope/refetch.ts` — the source of truth for stored bookmark results)

- `get_account`: `{account_name, balance, ram:{used,quota}, cpu:{used,max}, net:{used,max}, permissions[], voter_info}` — **but** bookmarks created via `EmptyState` store the *raw* RPC response (`core_liquid_balance`, `ram_usage`, `ram_quota`, `cpu_limit`, `net_limit`). Renderers must tolerate both.
- `get_currency_balance`: `{account, balances: string[]}` (e.g. `["4210.5000 TLOS"]`)
- `get_transfers`: `{transfers: [{timestamp, from, to, quantity, memo, contract, block}], account}`
- `get_actions`: `{actions: [{block, timestamp, contract, action, actors, data}], account, total:{value, relation}}`
- `get_tokens`: `{tokens: [{symbol, amount, contract, precision}], account}`
- `get_table_rows`: `{rows: object[], more?, code?, table?, scope?}`
- `get_producers`: `{producers: [{owner, total_votes, url, is_active, unpaid_blocks}], total_producer_vote_weight}`
- `get_block`: `{block_num, id, timestamp, producer, confirmed, transaction_count, transactions[]}`
- `get_transaction`: loose; actions may be RPC (`{account, name, data}`) or Hyperion (`{act:{account, name, data}}`); status via `data.status` or `data.executed`
- `get_abi`: `{account_name, actions: string[], tables: string[], structs[]}`
- `get_created_accounts`: `{accounts: [{name, timestamp}], query_account}`
- `get_creator`: `{account, creator, timestamp}`
- `get_key_accounts`: `{account_names: string[], public_key}`

Bookmark record (from `useHistory()`): `{id, tool_name, label, result, chain_name, chain_endpoint, created_at}`.

---

### Task 1: Module map + graph-paper background

**Files:**
- Create: `lib/dashboard/modules.ts`
- Modify: `app/globals.css` (append at end of file)

**Interfaces:**
- Produces: `type Module = "tile" | "panel" | "wide"`, `getModule(toolName: string): Module`, `getTypeLabel(toolName: string): string`, CSS class `terminal-grid-bg`.
- Note: `lib/dashboard/card-sizes.ts` stays untouched until Task 9 (the live view still imports it).

- [ ] **Step 1: Create `lib/dashboard/modules.ts`**

```ts
export type Module = "tile" | "panel" | "wide"

// Per-tool grid module. Tools not listed default to "panel" — a new/unknown
// bookmarked tool slots in as a standard 2x2 panel (rendered by kv-panel).
const MODULE_MAP: Record<string, Module> = {
  // tile — single key fact, lives in the stat strip
  get_currency_balance: "tile",
  get_creator: "tile",
  get_account: "tile",
  get_key_accounts: "tile",

  // wide — long lists / tables, full grid row
  get_table_rows: "wide",
  get_producers: "wide",
  get_actions: "wide",
  get_transfers: "wide",

  // everything else (get_block, get_transaction, get_tokens, get_abi,
  // build_transaction, get_created_accounts, unknown tools) → "panel"
}

export function getModule(toolName: string): Module {
  return MODULE_MAP[toolName] ?? "panel"
}

const TYPE_LABEL: Record<string, string> = {
  get_account: "Account",
  get_block: "Block",
  get_transaction: "Transaction",
  get_table_rows: "Table",
  get_currency_balance: "Balance",
  get_abi: "ABI",
  get_producers: "Producers",
  build_transaction: "Proposal",
  get_actions: "Actions",
  get_transfers: "Transfers",
  get_tokens: "Tokens",
  get_created_accounts: "Accounts",
  get_creator: "Creator",
  get_key_accounts: "Key",
}

export function getTypeLabel(toolName: string): string {
  return TYPE_LABEL[toolName] || "Data"
}
```

- [ ] **Step 2: Append the graph-paper background class to `app/globals.css`**

```css
/* Terminal dashboard — faint graph-paper grid behind the module grid */
.terminal-grid-bg {
  background-image:
    linear-gradient(to right, color-mix(in oklab, var(--border) 40%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklab, var(--border) 40%, transparent) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: lint passes with no new errors; build prints "Compiled successfully".

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/modules.ts app/globals.css
git commit -m "feat(dashboard): module map and terminal grid background"
```

---

### Task 2: Shared refresh hook + renameable label

**Files:**
- Create: `components/dashboard/use-bookmark-refresh.ts`
- Create: `components/dashboard/rename-label.tsx`

**Interfaces:**
- Consumes: `refetchToolData`, `REFRESHABLE_TOOLS` from `@/lib/antelope/refetch`; `useChain`, `useHistory`, `useDashboard` stores.
- Produces:
  - `useBookmarkRefresh(bookmark: RefreshableBookmark): {canRefresh, refreshing, refreshError, lastRefreshedAt, handleRefresh}` with `interface RefreshableBookmark {id: string; tool_name: string; result: Record<string, any>; chain_endpoint: string | null}`
  - `<RenameLabel bookmarkId={string} baseLabel={string} className?={string} />`

- [ ] **Step 1: Create `components/dashboard/use-bookmark-refresh.ts`** (logic lifted from the old `dashboard-card.tsx:154-198` so behavior is identical, incl. auto-refresh on mount)

```ts
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { refetchToolData, REFRESHABLE_TOOLS } from "@/lib/antelope/refetch"

export interface RefreshableBookmark {
  id: string
  tool_name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
  chain_endpoint: string | null
}

export function useBookmarkRefresh(bookmark: RefreshableBookmark) {
  const { hyperionEndpoint } = useChain()
  const { updateBookmarkResult } = useHistory()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const canRefresh = REFRESHABLE_TOOLS.has(bookmark.tool_name) && !!bookmark.chain_endpoint

  const handleRefresh = useCallback(async () => {
    if (!bookmark.chain_endpoint || refreshing) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      const newResult = await refetchToolData(
        bookmark.tool_name,
        bookmark.result,
        bookmark.chain_endpoint,
        hyperionEndpoint
      )
      if (!newResult.error) {
        updateBookmarkResult(bookmark.id, newResult)
        setLastRefreshedAt(new Date().toISOString())
      } else {
        setRefreshError(newResult.error)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refresh failed"
      setRefreshError(msg === "Failed to fetch" ? "Chain endpoint unreachable" : msg)
    } finally {
      setRefreshing(false)
    }
  }, [bookmark, hyperionEndpoint, refreshing, updateBookmarkResult])

  // Auto-refresh on mount
  const didAutoRefresh = useRef(false)
  useEffect(() => {
    if (!didAutoRefresh.current && canRefresh) {
      didAutoRefresh.current = true
      handleRefresh()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { canRefresh, refreshing, refreshError, lastRefreshedAt, handleRefresh }
}
```

- [ ] **Step 2: Create `components/dashboard/rename-label.tsx`** (rename logic lifted from old `dashboard-card.tsx:200-220`)

```tsx
"use client"

import { useState, useRef } from "react"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { useHistory } from "@/lib/stores/history-store"

interface RenameLabelProps {
  bookmarkId: string
  baseLabel: string
  className?: string
}

export function RenameLabel({ bookmarkId, baseLabel, className = "" }: RenameLabelProps) {
  const { customLabels, setCustomLabel, removeCustomLabel } = useDashboard()
  const { updateBookmarkLabel } = useHistory()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const displayLabel = customLabels[bookmarkId] || baseLabel

  const start = () => {
    setValue(displayLabel)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const save = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== baseLabel) {
      setCustomLabel(bookmarkId, trimmed)
      updateBookmarkLabel(bookmarkId, trimmed)
    } else if (trimmed === baseLabel) {
      removeCustomLabel(bookmarkId)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") setEditing(false)
        }}
        className={`w-full min-w-0 bg-transparent border border-border px-1 font-mono uppercase outline-none ${className}`}
      />
    )
  }

  return (
    <button onClick={start} title="Rename" className={`truncate text-left hover:text-foreground transition-colors ${className}`}>
      {displayLabel}
    </button>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: pass (files are not imported yet — that's fine, they compile standalone).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/use-bookmark-refresh.ts components/dashboard/rename-label.tsx
git commit -m "feat(dashboard): shared bookmark refresh hook and rename label"
```

---

### Task 3: Format helpers, kv-panel fallback, renderer registry

**Files:**
- Create: `components/dashboard/renderers/format.ts`
- Create: `components/dashboard/renderers/kv-panel.tsx`
- Create: `components/dashboard/renderers/index.tsx`

**Interfaces:**
- Produces:
  - `shortAge(iso?: string): string` — compact age ("now", "5m", "3h", "2d")
  - `flattenResult(obj, prefix?, out?, depth?): Array<[string, string]>`
  - `<KvPanel result={Record<string, unknown>} />`
  - `<DashboardRenderer toolName={string} result={Record<string, any>} />` — the single entry point panels use; switch grows in Tasks 6–8, default = KvPanel.

- [ ] **Step 1: Create `components/dashboard/renderers/format.ts`**

```ts
// Compact age for dense rows: "now", "5m", "3h", "2d".
// Hyperion timestamps often lack a timezone suffix — treat them as UTC.
export function shortAge(iso?: string): string {
  if (!iso) return ""
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z"
  const diff = Date.now() - new Date(normalized).getTime()
  if (Number.isNaN(diff)) return ""
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// Flatten a result object into [path, value] rows for the generic kv-panel.
// Arrays show their first 5 entries plus a "+N more" row; nesting caps at depth 2.
export function flattenResult(
  obj: Record<string, unknown>,
  prefix = "",
  out: Array<[string, string]> = [],
  depth = 0
): Array<[string, string]> {
  if (depth > 2) {
    out.push([prefix || "value", JSON.stringify(obj)])
    return out
  }
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      value.slice(0, 5).forEach((v, i) => {
        if (v !== null && typeof v === "object") {
          flattenResult(v as Record<string, unknown>, `${path}[${i}]`, out, depth + 1)
        } else {
          out.push([`${path}[${i}]`, String(v)])
        }
      })
      if (value.length > 5) out.push([path, `+${value.length - 5} more`])
    } else if (value !== null && typeof value === "object") {
      flattenResult(value as Record<string, unknown>, path, out, depth + 1)
    } else {
      out.push([path, String(value)])
    }
  }
  return out
}
```

- [ ] **Step 2: Create `components/dashboard/renderers/kv-panel.tsx`**

```tsx
import { flattenResult } from "./format"

// Generic fallback renderer: any tool without a dedicated renderer becomes
// labeled key-value rows instead of a raw JSON dump.
export function KvPanel({ result }: { result: Record<string, unknown> }) {
  const rows = flattenResult(result).slice(0, 40)
  if (rows.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO DATA</div>
  }
  return (
    <div className="font-mono text-xs">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
          <span className="text-muted-foreground uppercase tracking-wide truncate">{k}</span>
          <span className="truncate text-right tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/dashboard/renderers/index.tsx`** (registry — cases added in Tasks 6–8)

```tsx
import { KvPanel } from "./kv-panel"

interface DashboardRendererProps {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
}

// Single entry point: maps a bookmark's tool to its dashboard-native renderer.
// Unknown tools fall through to KvPanel.
export function DashboardRenderer({ toolName, result }: DashboardRendererProps) {
  switch (toolName) {
    default:
      return <KvPanel result={result} />
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: pass. (The single-case switch may lint-warn on `toolName` being unused — if so, silence by keeping the parameter referenced: the switch statement itself references it, which is sufficient.)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/renderers/
git commit -m "feat(dashboard): renderer registry with kv-panel fallback"
```

---

### Task 4: Stat tiles + stat strip

**Files:**
- Create: `components/dashboard/renderers/stat-tile.tsx`
- Create: `components/dashboard/stat-strip.tsx`

**Interfaces:**
- Consumes: `useBookmarkRefresh`, `RenameLabel`, `getModule` (strip filters by `"tile"`), stores.
- Produces:
  - `<StatTile bookmark onDragStart onDragOver onDrop />` — drag props have the same signatures as the old DashboardCard: `onDragStart(e: DragEvent, id: string)`, `onDragOver(e: DragEvent)`, `onDrop(e: DragEvent, id: string)`
  - `<StatStrip bookmarks onDragStart onDragOver onDrop dragId dropTargetId />` where `bookmarks` is the already-filtered tile list and `dragId`/`dropTargetId` are `string | null` from the view's drag state
  - `DashboardBookmark` type exported from `stat-tile.tsx`: `{id, tool_name, label, result, chain_name, chain_endpoint, created_at}` — reused by Task 5.

- [ ] **Step 1: Create `components/dashboard/renderers/stat-tile.tsx`**

```tsx
"use client"

import { DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useBookmarkRefresh } from "../use-bookmark-refresh"
import { RenameLabel } from "../rename-label"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from "lucide-react"

export interface DashboardBookmark {
  id: string
  tool_name: string
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
  chain_name: string | null
  chain_endpoint: string | null
  created_at: string
}

interface StatTileProps {
  bookmark: DashboardBookmark
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
}

interface TileSpec {
  accent: "value" | "identity" // value → primary top border, identity → chart-2
  value: string
  sub?: string
  bars?: { cpu: number; net: number; ram: number }
}

function pct(used?: number, max?: number): number {
  if (!used || !max || max <= 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTileSpec(toolName: string, result: Record<string, any>): TileSpec {
  switch (toolName) {
    case "get_currency_balance": {
      const balances: string[] = result.balances || []
      const extra = balances.length > 1 ? ` · +${balances.length - 1} more` : ""
      return {
        accent: "value",
        value: balances[0] || "—",
        sub: `${result.account || ""}${extra}`,
      }
    }
    case "get_creator":
      return {
        accent: "identity",
        value: String(result.creator || "?"),
        sub: result.timestamp
          ? `created ${new Date(String(result.timestamp)).toLocaleDateString()}`
          : String(result.account || ""),
      }
    case "get_key_accounts": {
      const names: string[] = result.account_names || []
      return {
        accent: "identity",
        value: `${names.length} account${names.length === 1 ? "" : "s"}`,
        sub: names[0] || "none",
      }
    }
    case "get_account": {
      // Tolerate both the normalized refetch shape and the raw RPC shape
      // that EmptyState suggestions store (core_liquid_balance, ram_usage…).
      const balance = result.balance ?? result.core_liquid_balance ?? "0"
      const ram = result.ram ?? { used: result.ram_usage, quota: result.ram_quota }
      const cpu = result.cpu ?? result.cpu_limit ?? {}
      const net = result.net ?? result.net_limit ?? {}
      return {
        accent: "identity",
        value: String(result.account_name || "?"),
        sub: String(balance),
        bars: {
          cpu: pct(Number(cpu.used), Number(cpu.max)),
          net: pct(Number(net.used), Number(net.max)),
          ram: pct(Number(ram.used), Number(ram.quota)),
        },
      }
    }
    default:
      return { accent: "value", value: "—" }
  }
}

function ResourceBars({ bars }: { bars: { cpu: number; net: number; ram: number } }) {
  const items: Array<[string, number]> = [["CPU", bars.cpu], ["NET", bars.net], ["RAM", bars.ram]]
  return (
    <div className="flex gap-2 mt-auto pt-1">
      {items.map(([name, value]) => (
        <div key={name} className="flex-1 min-w-0">
          <div className="h-1 bg-muted">
            <div
              className={value >= 90 ? "h-full bg-destructive" : "h-full bg-primary"}
              style={{ width: `${value}%` }}
            />
          </div>
          <div className="font-mono text-[8px] text-muted-foreground mt-0.5">{name} {value}%</div>
        </div>
      ))}
    </div>
  )
}

export function StatTile({ bookmark, onDragStart, onDragOver, onDrop }: StatTileProps) {
  const { removeBookmark } = useHistory()
  const { canRefresh, refreshing, refreshError, handleRefresh } = useBookmarkRefresh(bookmark)
  const spec = getTileSpec(bookmark.tool_name, bookmark.result)
  const accentClass = spec.accent === "value" ? "border-t-primary" : "border-t-chart-2"

  return (
    <div
      draggable
      data-bookmark-id={bookmark.id}
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, bookmark.id)}
      className={`group h-full flex flex-col border border-border ${accentClass} border-t-2 rounded-none bg-card p-3 cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <RenameLabel
          bookmarkId={bookmark.id}
          baseLabel={bookmark.label}
          className="flex-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
        />
        {refreshError && (
          <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" title={refreshError} />
        )}
        {canRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => removeBookmark(bookmark.id)}
        >
          <X className="h-2.5 w-2.5" />
        </Button>
      </div>
      <div className="font-mono text-xl tabular-nums truncate leading-tight mt-0.5">{spec.value}</div>
      {spec.sub && (
        <div className="font-mono text-[10px] text-muted-foreground truncate">{spec.sub}</div>
      )}
      {spec.bars && <ResourceBars bars={spec.bars} />}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/dashboard/stat-strip.tsx`**

```tsx
"use client"

import { DragEvent } from "react"
import { StatTile, DashboardBookmark } from "./renderers/stat-tile"

interface StatStripProps {
  bookmarks: DashboardBookmark[]
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
  dragId: string | null
  dropTargetId: string | null
}

export function StatStrip({ bookmarks, onDragStart, onDragOver, onDrop, dragId, dropTargetId }: StatStripProps) {
  if (bookmarks.length === 0) return null
  return (
    <div className="flex flex-wrap gap-3 mb-3">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          data-bookmark-id={bookmark.id}
          className={`h-[5.5rem] w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[280px] transition-opacity ${
            dragId === bookmark.id ? "opacity-50" : ""
          } ${dropTargetId === bookmark.id ? "ring-1 ring-primary" : ""}`}
        >
          <StatTile
            bookmark={bookmark}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/renderers/stat-tile.tsx components/dashboard/stat-strip.tsx
git commit -m "feat(dashboard): stat tiles and KPI strip"
```

---

### Task 5: Panel chrome

**Files:**
- Create: `components/dashboard/dashboard-panel.tsx`

**Interfaces:**
- Consumes: `DashboardRenderer` (Task 3), `useBookmarkRefresh`, `RenameLabel`, `getTypeLabel` (Task 1), `formatAge` from `@/lib/antelope/refetch`, `DashboardBookmark` type (Task 4).
- Produces: `<DashboardPanel bookmark onDragStart onDragOver onDrop />` — same drag prop signatures as StatTile.

- [ ] **Step 1: Create `components/dashboard/dashboard-panel.tsx`**

```tsx
"use client"

import { DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useBookmarkRefresh } from "./use-bookmark-refresh"
import { RenameLabel } from "./rename-label"
import { DashboardRenderer } from "./renderers"
import { getTypeLabel } from "@/lib/dashboard/modules"
import { formatAge } from "@/lib/antelope/refetch"
import { Button } from "@/components/ui/button"
import { GripVertical, RefreshCw, X } from "lucide-react"
import { DashboardBookmark } from "./renderers/stat-tile"

interface DashboardPanelProps {
  bookmark: DashboardBookmark
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
}

export function DashboardPanel({ bookmark, onDragStart, onDragOver, onDrop }: DashboardPanelProps) {
  const { removeBookmark } = useHistory()
  const { canRefresh, refreshing, refreshError, lastRefreshedAt, handleRefresh } = useBookmarkRefresh(bookmark)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, bookmark.id)}
      className="group h-full flex flex-col border border-border rounded-none bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border shrink-0">
        <span className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
          {getTypeLabel(bookmark.tool_name)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">·</span>
        <RenameLabel
          bookmarkId={bookmark.id}
          baseLabel={bookmark.label}
          className="flex-1 min-w-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        />
        {bookmark.chain_name && (
          <span className="font-mono text-[9px] uppercase text-muted-foreground/60 shrink-0">
            {bookmark.chain_name.split(" ")[0]}
          </span>
        )}
        {canRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => removeBookmark(bookmark.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Content — fixed module height, inner scroll */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <DashboardRenderer toolName={bookmark.tool_name} result={bookmark.result} />
      </div>

      {/* Footer — age + status dot (dot replaces the old error banner) */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-t border-border shrink-0">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            refreshing
              ? "bg-primary animate-pulse"
              : refreshError
                ? "bg-destructive"
                : "bg-muted-foreground/40"
          }`}
          title={refreshError ?? undefined}
        />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
          {lastRefreshedAt ? `Refreshed ${formatAge(lastRefreshedAt)}` : `Saved ${formatAge(bookmark.created_at)}`}
        </span>
        {refreshError && (
          <span className="font-mono text-[9px] uppercase text-destructive truncate" title={refreshError}>
            · {refreshError}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-panel.tsx
git commit -m "feat(dashboard): terminal panel chrome"
```

---

### Task 6: Transfers + actions renderers

**Files:**
- Create: `components/dashboard/renderers/transfers-panel.tsx`
- Create: `components/dashboard/renderers/actions-panel.tsx`
- Modify: `components/dashboard/renderers/index.tsx` (add cases)

**Interfaces:**
- Consumes: `shortAge` from `./format`.
- Produces: `<TransfersPanel data={{transfers, account}} />`, `<ActionsPanel data={{actions, total}} />`; registry handles `get_transfers`, `get_actions`.

- [ ] **Step 1: Create `components/dashboard/renderers/transfers-panel.tsx`**

```tsx
import { shortAge } from "./format"

interface TransfersPanelProps {
  data: {
    transfers?: Array<{ timestamp?: string; from?: string; to?: string; quantity?: string; memo?: string }>
    account?: string
  }
}

export function TransfersPanel({ data }: TransfersPanelProps) {
  const transfers = data.transfers || []
  const account = String(data.account || "")
  if (transfers.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO TRANSFERS</div>
  }
  return (
    <div className="font-mono text-xs">
      {transfers.map((t, i) => {
        const incoming = String(t.to || "") === account
        const counterparty = incoming ? String(t.from || "?") : String(t.to || "?")
        const dirClass = incoming ? "text-primary" : "text-destructive"
        return (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0">
            <span className={`${dirClass} shrink-0`}>{incoming ? "←" : "→"}</span>
            <span className={`${dirClass} tabular-nums shrink-0`}>{String(t.quantity || "?")}</span>
            <span className="text-muted-foreground truncate flex-1">{counterparty}</span>
            <span className="text-muted-foreground/60 shrink-0">{shortAge(t.timestamp)}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/dashboard/renderers/actions-panel.tsx`**

```tsx
import { shortAge } from "./format"

interface ActionsPanelProps {
  data: {
    actions?: Array<{ timestamp?: string; contract?: string; action?: string; actors?: string }>
    total?: { value: number; relation: string }
  }
}

export function ActionsPanel({ data }: ActionsPanelProps) {
  const actions = data.actions || []
  if (actions.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO ACTIONS</div>
  }
  return (
    <div className="font-mono text-xs">
      {data.total && (
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 pb-1">
          Showing {actions.length} of {data.total.value.toLocaleString()}
        </div>
      )}
      {actions.map((a, i) => (
        <div key={i} className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0">
          <span className="truncate">
            <span className="text-muted-foreground">{String(a.contract || "?")}::</span>
            <span>{String(a.action || "?")}</span>
          </span>
          <span className="text-muted-foreground truncate flex-1">{String(a.actors || "")}</span>
          <span className="text-muted-foreground/60 shrink-0">{shortAge(a.timestamp)}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Add registry cases in `components/dashboard/renderers/index.tsx`** — full updated file:

```tsx
import { KvPanel } from "./kv-panel"
import { TransfersPanel } from "./transfers-panel"
import { ActionsPanel } from "./actions-panel"

interface DashboardRendererProps {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
}

// Single entry point: maps a bookmark's tool to its dashboard-native renderer.
// Unknown tools fall through to KvPanel.
export function DashboardRenderer({ toolName, result }: DashboardRendererProps) {
  switch (toolName) {
    case "get_transfers":
      return <TransfersPanel data={result} />
    case "get_actions":
      return <ActionsPanel data={result} />
    default:
      return <KvPanel result={result} />
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/renderers/
git commit -m "feat(dashboard): transfers and actions panel renderers"
```

---

### Task 7: Table/producers + tokens renderers

**Files:**
- Create: `components/dashboard/renderers/table-panel.tsx`
- Create: `components/dashboard/renderers/tokens-panel.tsx`
- Modify: `components/dashboard/renderers/index.tsx` (add cases)

**Interfaces:**
- Produces: `<TablePanel data={{rows}} />` (also serves `get_producers` via `rows: result.producers`), `<TokensPanel data={{tokens}} />`; registry handles `get_table_rows`, `get_producers`, `get_tokens`.

- [ ] **Step 1: Create `components/dashboard/renderers/table-panel.tsx`**

```tsx
interface TablePanelProps {
  data: { rows?: Array<Record<string, unknown>> }
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function TablePanel({ data }: TablePanelProps) {
  const rows = data.rows || []
  if (rows.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO ROWS</div>
  }
  const columns = Object.keys(rows[0]).slice(0, 6)
  return (
    <table className="w-full font-mono text-xs">
      <thead className="sticky top-0 bg-card">
        <tr>
          {columns.map((c) => (
            <th key={c} className="text-left py-1 pr-3 font-normal text-[9px] uppercase tracking-widest text-muted-foreground">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-border/40">
            {columns.map((c) => (
              <td key={c} className="py-1 pr-3 tabular-nums max-w-[16rem] truncate">
                {cell(row[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Create `components/dashboard/renderers/tokens-panel.tsx`**

```tsx
interface TokensPanelProps {
  data: { tokens?: Array<{ symbol?: string; amount?: number; contract?: string }> }
}

export function TokensPanel({ data }: TokensPanelProps) {
  const tokens = data.tokens || []
  if (tokens.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO TOKENS</div>
  }
  return (
    <div className="font-mono text-xs grid grid-cols-2 gap-x-4">
      {tokens.map((t, i) => (
        <div key={i} className="flex justify-between gap-2 py-0.5 border-b border-border/40">
          <span className="truncate">
            {String(t.symbol || "?")}
            <span className="text-muted-foreground/60 text-[9px]"> {String(t.contract || "")}</span>
          </span>
          <span className="tabular-nums shrink-0">{Number(t.amount ?? 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Update `components/dashboard/renderers/index.tsx`** — add imports and cases (keep existing ones from Task 6):

```tsx
import { TablePanel } from "./table-panel"
import { TokensPanel } from "./tokens-panel"
```

```tsx
    case "get_table_rows":
      return <TablePanel data={result} />
    case "get_producers":
      return <TablePanel data={{ rows: result.producers || [] }} />
    case "get_tokens":
      return <TokensPanel data={result} />
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/renderers/
git commit -m "feat(dashboard): table, producers, and tokens panel renderers"
```

---

### Task 8: Block, transaction, ABI, created-accounts renderers + proposal embed

**Files:**
- Create: `components/dashboard/renderers/block-panel.tsx`
- Create: `components/dashboard/renderers/transaction-panel.tsx`
- Create: `components/dashboard/renderers/abi-panel.tsx`
- Create: `components/dashboard/renderers/created-accounts-panel.tsx`
- Modify: `components/dashboard/renderers/index.tsx` (add cases incl. `build_transaction` embed)

**Interfaces:**
- Consumes: `TxProposalCard` from `@/components/chat/cards/tx-proposal-card` (the one deliberate chat-component embed, per spec).
- Produces: registry handles `get_block`, `get_transaction`, `get_abi`, `get_created_accounts`, `build_transaction`.

- [ ] **Step 1: Create `components/dashboard/renderers/block-panel.tsx`**

```tsx
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">{k}</span>
      <span className="truncate text-right tabular-nums">{v}</span>
    </div>
  )
}

interface BlockPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export function BlockPanel({ data }: BlockPanelProps) {
  return (
    <div className="font-mono text-xs">
      <Row k="Block" v={`#${Number(data.block_num ?? 0).toLocaleString()}`} />
      <Row k="Producer" v={String(data.producer || "?")} />
      <Row k="Time" v={data.timestamp ? new Date(String(data.timestamp)).toLocaleString() : "?"} />
      <Row k="Txs" v={String(data.transaction_count ?? 0)} />
      {data.id && <Row k="ID" v={`${String(data.id).slice(0, 16)}…`} />}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/dashboard/renderers/transaction-panel.tsx`**

```tsx
// Normalize action from either RPC format { account, name } or Hyperion { act: { account, name } }
// (same normalization as components/chat/cards/transaction-card.tsx)
function normalizeAction(a: Record<string, unknown>) {
  const act = a.act as Record<string, unknown> | undefined
  return {
    account: (act?.account || a.account || "") as string,
    name: (act?.name || a.name || "") as string,
  }
}

function getStatus(data: Record<string, unknown>): string {
  if (data.status) return String(data.status)
  if (data.executed === true) return "executed"
  if (data.executed === false) return "failed"
  return "unknown"
}

interface TransactionPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export function TransactionPanel({ data }: TransactionPanelProps) {
  const status = getStatus(data)
  const actions = ((data.actions || []) as Record<string, unknown>[]).map(normalizeAction)
  const txId = String(data.id || data.trx_id || data.transaction_id || "")
  return (
    <div className="font-mono text-xs space-y-1">
      <div className="flex justify-between gap-3">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">Status</span>
        <span className={status === "executed" ? "text-primary" : status === "failed" ? "text-destructive" : ""}>
          {status.toUpperCase()}
        </span>
      </div>
      {txId && (
        <div className="flex justify-between gap-3">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">ID</span>
          <span className="truncate">{txId.slice(0, 16)}…</span>
        </div>
      )}
      {data.block_num !== undefined && (
        <div className="flex justify-between gap-3">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">Block</span>
          <span className="tabular-nums">#{Number(data.block_num).toLocaleString()}</span>
        </div>
      )}
      {actions.length > 0 && (
        <div className="pt-1 border-t border-border/40">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground pb-0.5">Actions</div>
          {actions.slice(0, 6).map((a, i) => (
            <div key={i} className="truncate">
              <span className="text-muted-foreground">{a.account}::</span>{a.name}
            </div>
          ))}
          {actions.length > 6 && (
            <div className="text-muted-foreground/60">+{actions.length - 6} more</div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/dashboard/renderers/abi-panel.tsx`**

```tsx
interface AbiPanelProps {
  data: { account_name?: string; actions?: string[]; tables?: string[] }
}

function Chips({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground pb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((name) => (
          <span key={name} className="border border-border px-1.5 py-0.5 text-[10px]">
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AbiPanel({ data }: AbiPanelProps) {
  return (
    <div className="font-mono text-xs space-y-2">
      <div>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Contract </span>
        <span>{String(data.account_name || "?")}</span>
      </div>
      <Chips title="Actions" items={data.actions || []} />
      <Chips title="Tables" items={data.tables || []} />
    </div>
  )
}
```

- [ ] **Step 4: Create `components/dashboard/renderers/created-accounts-panel.tsx`**

```tsx
interface CreatedAccountsPanelProps {
  data: {
    accounts?: Array<{ name?: string; timestamp?: string }>
    query_account?: string
  }
}

export function CreatedAccountsPanel({ data }: CreatedAccountsPanelProps) {
  const accounts = data.accounts || []
  if (accounts.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO ACCOUNTS FOUND</div>
  }
  return (
    <div className="font-mono text-xs">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 pb-1">
        Created by {String(data.query_account || "?")}
      </div>
      {accounts.map((a, i) => (
        <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
          <span className="truncate">{String(a.name || "?")}</span>
          <span className="text-muted-foreground shrink-0">
            {a.timestamp ? new Date(String(a.timestamp)).toLocaleDateString() : ""}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Update `components/dashboard/renderers/index.tsx`** — final full file:

```tsx
import { KvPanel } from "./kv-panel"
import { TransfersPanel } from "./transfers-panel"
import { ActionsPanel } from "./actions-panel"
import { TablePanel } from "./table-panel"
import { TokensPanel } from "./tokens-panel"
import { BlockPanel } from "./block-panel"
import { TransactionPanel } from "./transaction-panel"
import { AbiPanel } from "./abi-panel"
import { CreatedAccountsPanel } from "./created-accounts-panel"
import { TxProposalCard } from "@/components/chat/cards/tx-proposal-card"

interface DashboardRendererProps {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
}

// Single entry point: maps a bookmark's tool to its dashboard-native renderer.
// Unknown tools fall through to KvPanel.
export function DashboardRenderer({ toolName, result }: DashboardRendererProps) {
  switch (toolName) {
    case "get_transfers":
      return <TransfersPanel data={result} />
    case "get_actions":
      return <ActionsPanel data={result} />
    case "get_table_rows":
      return <TablePanel data={result} />
    case "get_producers":
      return <TablePanel data={{ rows: result.producers || [] }} />
    case "get_tokens":
      return <TokensPanel data={result} />
    case "get_block":
      return <BlockPanel data={result} />
    case "get_transaction":
      return <TransactionPanel data={result} />
    case "get_abi":
      return <AbiPanel data={result} />
    case "get_created_accounts":
      return <CreatedAccountsPanel data={result} />
    case "build_transaction":
      // Deliberate exception (see spec): interactive signing machinery is
      // embedded as-is rather than rebuilt terminal-style in v1.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <TxProposalCard data={result as any} />
    default:
      return <KvPanel result={result} />
  }
}
```

Check `TxProposalCard`'s exact prop name before wiring (`grep "export function TxProposalCard" -A2 components/chat/cards/tx-proposal-card.tsx`) — the old dashboard-card called it as `<TxProposalCard data={result as any} />`, so `data` is correct unless that file changed.

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/renderers/
git commit -m "feat(dashboard): block, transaction, abi, created-accounts renderers + proposal embed"
```

---

### Task 9: Dashboard view rework (zones, module grid, background)

**Files:**
- Modify: `components/dashboard/dashboard-view.tsx` (full rewrite below)
- Delete: `components/dashboard/dashboard-card.tsx`
- Delete: `lib/dashboard/card-sizes.ts`

**Interfaces:**
- Consumes: `getModule` (Task 1), `StatStrip` (Task 4), `DashboardPanel` (Task 5), `DashboardBookmark` (Task 4). `DashboardHeader` and `EmptyState` unchanged (restyled in Task 10).
- Produces: the final `DashboardView` — zone split, 4-col module grid, zone-constrained drag.

- [ ] **Step 1: Replace `components/dashboard/dashboard-view.tsx` entirely**

```tsx
"use client"

import { useState, useMemo, DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { DashboardPanel } from "./dashboard-panel"
import { StatStrip } from "./stat-strip"
import { getModule } from "@/lib/dashboard/modules"
import { DashboardHeader } from "./dashboard-header"
import { EmptyState } from "./empty-state"

export function DashboardView() {
  const { bookmarks } = useHistory()
  const { itemOrder, setItemOrder } = useDashboard()
  const { chainName, endpoint, hyperionEndpoint } = useChain()
  const { accountName: walletAccount } = useWallet()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const chainBookmarks = useMemo(
    () => bookmarks.filter((b) => b.chain_name === chainName),
    [bookmarks, chainName],
  )

  const orderedBookmarks = useMemo(() => {
    const orderMap = new Map(itemOrder.map((id, i) => [id, i]))
    return [...chainBookmarks].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity
      const bi = orderMap.get(b.id) ?? Infinity
      if (ai === Infinity && bi === Infinity) return 0
      return ai - bi
    })
  }, [chainBookmarks, itemOrder])

  // Zone split: tiles go to the stat strip, everything else to the module grid
  const tileBookmarks = useMemo(
    () => orderedBookmarks.filter((b) => getModule(b.tool_name) === "tile"),
    [orderedBookmarks],
  )
  const panelBookmarks = useMemo(
    () => orderedBookmarks.filter((b) => getModule(b.tool_name) !== "tile"),
    [orderedBookmarks],
  )

  const zoneOf = (id: string): "strip" | "grid" | null => {
    const bm = chainBookmarks.find((b) => b.id === id)
    if (!bm) return null
    return getModule(bm.tool_name) === "tile" ? "strip" : "grid"
  }

  const handleDragStart = (e: DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const target = (e.currentTarget as HTMLElement).dataset.bookmarkId
    if (target && target !== dragId) {
      setDropTargetId(target)
    }
  }

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault()
    setDropTargetId(null)
    if (!dragId || dragId === targetId) return
    // Reordering is constrained within a zone (tile↔tile, panel↔panel)
    if (zoneOf(dragId) !== zoneOf(targetId)) {
      setDragId(null)
      return
    }

    const currentIds = orderedBookmarks.map((b) => b.id)
    const dragIndex = currentIds.indexOf(dragId)
    const targetIndex = currentIds.indexOf(targetId)
    if (dragIndex === -1 || targetIndex === -1) return

    const newOrder = [...currentIds]
    newOrder.splice(dragIndex, 1)
    newOrder.splice(targetIndex, 0, dragId)
    setItemOrder(newOrder)
    setDragId(null)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDropTargetId(null)
  }

  if (chainBookmarks.length === 0) {
    return (
      <EmptyState
        chainName={chainName}
        chainEndpoint={endpoint}
        walletAccount={walletAccount}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DashboardHeader
        chainName={chainName}
        chainEndpoint={endpoint}
        hyperionEndpoint={hyperionEndpoint}
        bookmarks={orderedBookmarks}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6 terminal-grid-bg" onDragEnd={handleDragEnd}>
        <StatStrip
          bookmarks={tileBookmarks}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          dragId={dragId}
          dropTargetId={dropTargetId}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 auto-rows-[5.5rem] gap-3 [grid-auto-flow:dense]">
          {panelBookmarks.map((bookmark) => {
            const wide = getModule(bookmark.tool_name) === "wide"
            const span = wide
              ? "md:col-span-2 xl:col-span-4 row-span-3"
              : "md:col-span-2 xl:col-span-2 row-span-3"
            return (
              <div
                key={bookmark.id}
                data-bookmark-id={bookmark.id}
                className={`min-h-0 transition-opacity ${span} ${dragId === bookmark.id ? "opacity-50" : ""} ${
                  dropTargetId === bookmark.id ? "ring-1 ring-primary" : ""
                }`}
              >
                <DashboardPanel
                  bookmark={bookmark}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete the superseded files**

```bash
git rm components/dashboard/dashboard-card.tsx lib/dashboard/card-sizes.ts
```

Then confirm nothing else imports them: `grep -rn "dashboard-card\|card-sizes" components/ lib/ app/ --include="*.tsx" --include="*.ts"`
Expected: no matches.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 4: Smoke-check in the browser**

Run: `npm run dev`, open the dashboard tab with a few bookmarks (or add via the empty-state suggestions).
Expected: tiles in a strip on top, aligned panels below, graph-paper background, drag works within each zone, cross-zone drop is a no-op.

- [ ] **Step 5: Commit**

```bash
git add -A components/dashboard/ lib/dashboard/
git commit -m "feat(dashboard): terminal module grid with stat strip zones"
```

---

### Task 10: Header + empty state terminal restyle

**Files:**
- Modify: `components/dashboard/dashboard-header.tsx` (return block only — logic untouched)
- Modify: `components/dashboard/empty-state.tsx` (classNames only — logic untouched)

**Interfaces:**
- Consumes/Produces: no API changes; props stay identical.

- [ ] **Step 1: In `dashboard-header.tsx`, replace the `return (...)` JSX** (keep everything above it):

```tsx
  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-border">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span>{chainName || "No chain"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{count} {noun}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Synced {formatAge(lastSyncedAt)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="font-mono text-[10px] uppercase tracking-widest rounded-none"
          disabled={refreshing || refreshable.length === 0}
          onClick={refreshAll}
        >
          <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
      </div>
    </div>
  )
```

- [ ] **Step 2: In `empty-state.tsx`, terminal-ify the classes** (three exact edits; logic and structure unchanged):

1. Both `<h2>` elements: replace `className="text-lg font-medium text-muted-foreground"` and `className="text-base font-medium"` with `className="font-mono text-sm uppercase tracking-widest text-muted-foreground"`.
2. Suggestion row container: replace `rounded-xl` with `rounded-none` in the `className` on the suggestion `<div>` (`flex items-center gap-3 p-3 border border-border/60 rounded-xl bg-card hover:bg-muted/30 transition-colors` → same with `rounded-none` and `border-border` instead of `border-border/60`).
3. Suggestion title `<div className="text-sm font-medium">` → `<div className="font-mono text-sm">`.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-header.tsx components/dashboard/empty-state.tsx
git commit -m "feat(dashboard): terminal restyle for header and empty state"
```

---

### Task 11: Full manual verification pass

**Files:** none (fixes go where the bug is; each fix gets its own small commit).

- [ ] **Step 1: Start the app**

Run: `npm run dev` and open the dashboard with bookmarks covering: a balance, an account, a creator lookup (tiles); transfers, actions, a table, producers (wide); block, transaction, tokens, ABI (panels); plus one unsupported tool (e.g. ask the chat to `get_voters` and bookmark it) to exercise kv-panel.

- [ ] **Step 2: Theme matrix**

Switch through all 5 themes (root/light, dim, dusk, gold, orange) via the header switcher.
Expected: no hard-coded colors bleeding through; borders, text, accents all follow the theme; graph-paper background visible but faint in every theme.

- [ ] **Step 3: Breakpoints**

Desktop (>1280px): 4-col grid, panels 2-wide, wides full-row. Tablet (~800px): 2-col, panels+wides full width. Mobile (<640px): single column, tiles full-width.
Expected: rows always align; no horizontal scrollbar on the page; overflow scrolls inside panels.

- [ ] **Step 4: Interactions**

- Drag a tile onto a tile → reorders. Drag a tile onto a panel → no-op.
- Drag a panel onto a panel → reorders; order survives reload (localStorage).
- Rename a tile and a panel (Enter saves, Escape cancels); custom label survives reload.
- Manual refresh spins the icon and updates the footer to `REFRESHED …`.
- Kill the network (devtools offline) and refresh a panel → destructive dot + error text in footer, no layout shift.
- Remove a card → disappears from strip/grid.
- `build_transaction` bookmark renders the proposal card inside panel chrome; signing flow still opens Anchor.
- Unknown-tool bookmark renders kv-panel rows (no raw JSON).

- [ ] **Step 5: Fix anything found, then final verify + commit**

Run: `npm run lint && npm run build`
Expected: pass.

```bash
git add -A && git commit -m "fix(dashboard): polish from manual verification pass"
```

(Skip the commit if nothing needed fixing.)
