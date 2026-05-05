# Dashboard Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard feel designed: per-tool card size hierarchy, polished card chrome, per-chain accent color, header stats strip with refresh-all, suggestion-rich empty state, and subtle hover/entrance motion.

**Architecture:** Two new tiny lookup modules under `lib/dashboard/`. Two new presentational components under `components/dashboard/`. The existing `DashboardCard` and `DashboardView` get applied changes. CSS Grid with `auto-flow: dense` lets wide cards span both columns while compact cards backfill the holes. All polish uses existing CSS tokens so it travels across all five themes.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind v4 with `tw-animate-css` for entrance animations (already in `app/globals.css`), `@/lib/antelope/refetch.ts` (existing) for refresh-all and the `formatAge` helper, `@/lib/stores/history-store.tsx` (existing) for `addBookmark` / `updateBookmarkResult`.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/dashboard/card-sizes.ts` | Create | Hardcoded per-tool size map + `getCardSize(toolName)` helper. |
| `lib/dashboard/chain-accent.ts` | Create | Hardcoded per-chain accent color map + `chainAccent(chainName)` helper. |
| `components/dashboard/dashboard-header.tsx` | Create | Header stats strip: chain dot, name, count, last-synced, Refresh-all. |
| `components/dashboard/empty-state.tsx` | Create | The three-suggestion empty state (Watch my account / My token balances / My recent activity). |
| `components/dashboard/dashboard-card.tsx` | Modify | Apply chrome polish (rounded-xl, soft shadow + hover lift, gradient header, larger padding), per-chain accent (left border + header gradient), entrance animation. |
| `components/dashboard/dashboard-view.tsx` | Modify | New CSS-grid layout with `auto-flow: dense`, wrap each `DashboardCard` with size-driven span class, render `DashboardHeader` above the grid, swap empty state for `EmptyState`. |

No DB changes. No new API routes. No new dependencies.

---

## Task 1: Size and accent lookups

**Files:**
- Create: `lib/dashboard/card-sizes.ts`
- Create: `lib/dashboard/chain-accent.ts`

- [ ] **Step 1: Create the card-size lookup**

`/Users/sachitdabas/explorer/lib/dashboard/card-sizes.ts`:

```typescript
export type CardSize = "compact" | "medium" | "wide"

// Hardcoded per-tool size. Tools not listed default to "medium".
const SIZE_MAP: Record<string, CardSize> = {
  // Compact — single key fact, no detail list
  get_account: "compact",
  get_currency_balance: "compact",
  get_creator: "compact",

  // Medium — small structured payload
  get_block: "medium",
  get_transaction: "medium",
  get_tokens: "medium",
  get_abi: "medium",
  build_transaction: "medium",
  get_key_accounts: "medium",
  get_contract_guide: "medium",

  // Wide — long lists / tables that benefit from full row
  get_actions: "wide",
  get_transfers: "wide",
  get_table_rows: "wide",
  get_producers: "wide",
  get_created_accounts: "wide",
}

export function getCardSize(toolName: string): CardSize {
  return SIZE_MAP[toolName] ?? "medium"
}
```

- [ ] **Step 2: Create the chain-accent lookup**

`/Users/sachitdabas/explorer/lib/dashboard/chain-accent.ts`:

```typescript
const NEUTRAL = "oklch(0.6 0 0)"

const CHAIN_ACCENT: Record<string, string> = {
  "Telos Mainnet":   "oklch(0.7 0.15 195)",   // teal
  "EOS Mainnet":     "oklch(0.62 0.2 260)",   // blue
  "WAX Mainnet":     "oklch(0.6 0.22 300)",   // purple
  "Jungle4 Testnet": "oklch(0.7 0.18 145)",   // green
  "FIO Mainnet":     "oklch(0.78 0.18 70)",   // amber
  "Libre":           "oklch(0.65 0.22 25)",   // red
}

export function chainAccent(chainName: string | null | undefined): string {
  if (!chainName) return NEUTRAL
  return CHAIN_ACCENT[chainName] ?? NEUTRAL
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/sachitdabas/explorer
git add lib/dashboard/card-sizes.ts lib/dashboard/chain-accent.ts
git commit -m "feat: per-tool size and per-chain accent lookups for dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Card chrome polish, accent, motion

**Files:**
- Modify: `components/dashboard/dashboard-card.tsx` (root wrapper div + header div)

The card already imports `Pencil`, `Check`, `RefreshCw`, etc. The only new import is the chain-accent helper.

- [ ] **Step 1: Add the import**

At the top of `components/dashboard/dashboard-card.tsx`, add:

```typescript
import { chainAccent } from "@/lib/dashboard/chain-accent"
```

- [ ] **Step 2: Compute the accent inside the component body**

Find the `function DashboardCard(...)` body. Near the top (after the existing `useHistory()` / state declarations), add:

```typescript
const accent = chainAccent(bookmark.chain_name)
const headerGradient = `linear-gradient(to bottom, color-mix(in oklch, ${accent} 8%, transparent), transparent)`
```

(The card body's `bg-muted/40 → bg-muted/10` portion of the gradient is handled by Tailwind — we layer the accent wash on top.)

- [ ] **Step 3: Update the root wrapper**

Find the root `<div>` that today reads (around line 222):

```tsx
<div
  draggable
  onDragStart={(e) => onDragStart(e, bookmark.id)}
  onDragOver={onDragOver}
  onDrop={(e) => onDrop(e, bookmark.id)}
  className="border rounded-lg bg-card shadow-sm overflow-hidden"
>
```

Replace with:

```tsx
<div
  draggable
  onDragStart={(e) => onDragStart(e, bookmark.id)}
  onDragOver={onDragOver}
  onDrop={(e) => onDrop(e, bookmark.id)}
  style={{ borderLeftColor: accent, borderLeftWidth: 2 }}
  className="border border-border/60 rounded-xl bg-card shadow-sm overflow-hidden transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
>
```

The inline `borderLeftColor` + `borderLeftWidth: 2` overrides the tailwind border on the left edge with the chain accent. Other edges keep `border border-border/60`.

- [ ] **Step 4: Update the card header**

Find the header `<div>` (immediately inside the root wrapper, around line 229):

```tsx
<div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/50">
```

Replace with:

```tsx
<div
  className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/60 bg-gradient-to-b from-muted/40 to-muted/10"
  style={{ backgroundImage: `${headerGradient}, linear-gradient(to bottom, var(--color-muted) / 40%, var(--color-muted) / 10%)` }}
>
```

Note: Tailwind v4's `bg-gradient-to-b from-muted/40 to-muted/10` provides the base muted gradient via Tailwind. The inline `backgroundImage` layers the chain accent wash on top using `color-mix`. If Tailwind's gradient and the inline `backgroundImage` conflict, the inline one wins because it's applied last via `style`.

If the inline approach causes a regression (e.g., gradient flashes during hot reload), simplify to a single Tailwind className for the muted gradient and apply the accent wash via a `::before` pseudo-element. For now, ship the simpler inline-style approach and check visually.

- [ ] **Step 5: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/dashboard/dashboard-card.tsx
git commit -m "feat: card chrome polish, chain accent, hover lift

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Grid layout with size-driven spans

**Files:**
- Modify: `components/dashboard/dashboard-view.tsx`

Change the grid from `grid-cols-1 lg:grid-cols-2 gap-4` to a CSS Grid with `auto-flow: dense` and apply `lg:col-span-2` on wide cards so they take a full row while compact cards backfill.

- [ ] **Step 1: Add the import**

At the top of `components/dashboard/dashboard-view.tsx`, add:

```typescript
import { getCardSize } from "@/lib/dashboard/card-sizes"
```

- [ ] **Step 2: Update the grid wrapper**

Find the JSX (around line 77):

```tsx
<div className="flex-1 overflow-auto p-4 md:p-6">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" onDragEnd={handleDragEnd}>
    {orderedBookmarks.map((bookmark) => (
      <div
        key={bookmark.id}
        data-bookmark-id={bookmark.id}
        className={`transition-opacity ${dragId === bookmark.id ? "opacity-50" : ""} ${
          dropTargetId === bookmark.id ? "ring-2 ring-primary rounded-lg" : ""
        }`}
      >
        <DashboardCard
          bookmark={bookmark}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      </div>
    ))}
  </div>
</div>
```

Replace with:

```tsx
<div className="flex-1 overflow-auto p-4 md:p-6">
  <div
    className="grid grid-cols-1 lg:grid-cols-2 gap-4 [grid-auto-flow:dense]"
    onDragEnd={handleDragEnd}
  >
    {orderedBookmarks.map((bookmark) => {
      const size = getCardSize(bookmark.tool_name)
      const span = size === "wide" ? "lg:col-span-2" : ""
      return (
        <div
          key={bookmark.id}
          data-bookmark-id={bookmark.id}
          className={`transition-opacity ${span} ${dragId === bookmark.id ? "opacity-50 scale-95" : ""} ${
            dropTargetId === bookmark.id ? "ring-2 ring-primary rounded-xl" : ""
          }`}
        >
          <DashboardCard
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
```

Two notes:
- `[grid-auto-flow:dense]` is Tailwind v4 arbitrary-value syntax. It tells the grid to backfill earlier holes when a wide card lands on a row that already has a compact card.
- Drag ghost: `scale-95` joins `opacity-50` so the dragged card visibly shrinks.

- [ ] **Step 3: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/dashboard/dashboard-view.tsx
git commit -m "feat: dashboard grid with per-tool span and dense backfill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Dashboard header strip

**Files:**
- Create: `components/dashboard/dashboard-header.tsx`

Single component, takes props from `DashboardView`. Performs Refresh-all by calling `refetchToolData` for each refreshable bookmark in parallel, then `updateBookmarkResult` per result.

- [ ] **Step 1: Create the file**

`/Users/sachitdabas/explorer/components/dashboard/dashboard-header.tsx`:

```typescript
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { chainAccent } from "@/lib/dashboard/chain-accent"
import { REFRESHABLE_TOOLS, refetchToolData, formatAge } from "@/lib/antelope/refetch"
import { useHistory } from "@/lib/stores/history-store"

interface DashboardHeaderProps {
  chainName: string | null
  chainEndpoint: string | null
  hyperionEndpoint: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookmarks: Array<{ id: string; tool_name: string; result: Record<string, any>; chain_endpoint: string | null }>
}

export function DashboardHeader({ chainName, chainEndpoint, hyperionEndpoint, bookmarks }: DashboardHeaderProps) {
  const { updateBookmarkResult } = useHistory()
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toISOString())
  const [, force] = useState(0)

  // Re-render every 5s so the "last synced" label updates
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const refreshable = bookmarks.filter(
    (b) => REFRESHABLE_TOOLS.has(b.tool_name) && (b.chain_endpoint || chainEndpoint),
  )

  const refreshAll = async () => {
    if (refreshing || refreshable.length === 0) return
    setRefreshing(true)
    try {
      await Promise.all(
        refreshable.map(async (b) => {
          try {
            const fresh = await refetchToolData(
              b.tool_name,
              b.result,
              b.chain_endpoint || chainEndpoint || "",
              hyperionEndpoint,
            )
            updateBookmarkResult(b.id, fresh)
          } catch {
            // Per-card failure is acceptable — the card just stays on its old data.
          }
        }),
      )
      setLastSyncedAt(new Date().toISOString())
    } finally {
      setRefreshing(false)
    }
  }

  const accent = chainAccent(chainName)
  const count = bookmarks.length
  const noun = count === 1 ? "bookmark" : "bookmarks"

  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/60">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="font-medium">{chainName || "No chain"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{count} {noun}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Last synced {formatAge(lastSyncedAt)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={refreshing || refreshable.length === 0}
          onClick={refreshAll}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
      </div>
    </div>
  )
}
```

Note on the `force` setter: the only purpose is to re-render the component every 5s so `formatAge(lastSyncedAt)` returns a fresh value. The state value itself is unused — the setter call alone causes the re-render.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/dashboard/dashboard-header.tsx
git commit -m "feat: dashboard header strip with refresh-all

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Empty state with three suggestions

**Files:**
- Create: `components/dashboard/empty-state.tsx`

When the chain has no bookmarks, this component replaces the existing empty message. It offers three suggestion cards. Each card runs a tool query for the connected wallet's account, then `addBookmark`s the result.

- [ ] **Step 1: Create the file**

`/Users/sachitdabas/explorer/components/dashboard/empty-state.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Bookmark, User, Coins, Activity, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AntelopeClient } from "@/lib/antelope/client"
import { useHistory } from "@/lib/stores/history-store"

interface EmptyStateProps {
  chainName: string | null
  chainEndpoint: string | null
  walletAccount: string | null
}

interface Suggestion {
  id: string
  toolName: string
  title: string
  description: string
  icon: typeof User
  buildLabel: (account: string) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (client: AntelopeClient, account: string) => Promise<Record<string, any>>
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: "watch-account",
    toolName: "get_account",
    title: "Watch my account",
    description: "Track balance, RAM, CPU, NET, staking, and more on the dashboard.",
    icon: User,
    buildLabel: (account) => account,
    fetch: async (client, account) => {
      const info = await client.getAccount(account)
      return info as Record<string, unknown>
    },
  },
  {
    id: "my-tokens",
    toolName: "get_currency_balance",
    title: "My token balances",
    description: "See your eosio.token balance for the connected chain.",
    icon: Coins,
    buildLabel: (account) => `Balances for ${account}`,
    fetch: async (client, account) => {
      const balances = await client.getCurrencyBalance("eosio.token", account)
      return { account, balances }
    },
  },
  {
    id: "my-activity",
    toolName: "get_actions",
    title: "My recent activity",
    description: "Your latest on-chain actions, refreshed when you load the dashboard.",
    icon: Activity,
    buildLabel: (account) => `Actions for ${account}`,
    fetch: async (_client, _account) => {
      // get_actions needs Hyperion, not RPC; if not available, show graceful error
      throw new Error("Hyperion required for action history; connect a chain with Hyperion to enable")
    },
  },
]

export function EmptyState({ chainName, chainEndpoint, walletAccount }: EmptyStateProps) {
  const { addBookmark } = useHistory()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const handleAdd = async (suggestion: Suggestion) => {
    if (!walletAccount || !chainEndpoint) return
    setBusyId(suggestion.id)
    setErrorId(null)
    try {
      const client = new AntelopeClient(chainEndpoint)
      const result = await suggestion.fetch(client, walletAccount)
      await addBookmark({
        toolName: suggestion.toolName,
        label: suggestion.buildLabel(walletAccount),
        result,
        chainName: chainName || undefined,
        chainEndpoint: chainEndpoint || undefined,
      })
    } catch {
      setErrorId(suggestion.id)
    } finally {
      setBusyId(null)
    }
  }

  if (!walletAccount) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-3">
          <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-lg font-medium text-muted-foreground">No bookmarks yet</h2>
          <p className="text-sm text-muted-foreground">
            Chat with the blockchain and bookmark results to build your dashboard.
          </p>
          <p className="text-xs text-muted-foreground">Connect a wallet to see suggestions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2 pb-2">
          <Bookmark className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h2 className="text-base font-medium">No bookmarks for {chainName || "this chain"} yet</h2>
          <p className="text-sm text-muted-foreground">Get started with one of these:</p>
        </div>
        <div className="space-y-2">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon
            const busy = busyId === s.id
            const failed = errorId === s.id
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 border border-border/60 rounded-xl bg-card hover:bg-muted/30 transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {failed ? "Couldn't load — try again." : s.description}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleAdd(s)}>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

Notes:
- The `my-activity` suggestion intentionally throws if used without Hyperion (it requires the history endpoint, which isn't a plain RPC method on `AntelopeClient`). The error message tells the user what's needed; clicking again shows the failure state. A future iteration could add a Hyperion-aware fetch — for now we're prioritizing the visual win.
- `addBookmark` already handles both authed (server) and unauthed (localStorage) modes.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: no errors. (If `client.getAccount` signature mismatches the call, adjust the call site to match `lib/antelope/client.ts`.)

- [ ] **Step 3: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/dashboard/empty-state.tsx
git commit -m "feat: dashboard empty state with three starter suggestions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire header + empty-state into DashboardView

**Files:**
- Modify: `components/dashboard/dashboard-view.tsx`

Pull in the new components, swap the inline empty state, render the header above the grid.

- [ ] **Step 1: Add imports**

At the top of `components/dashboard/dashboard-view.tsx`, add:

```typescript
import { useWallet } from "@/lib/stores/wallet-store"
import { DashboardHeader } from "./dashboard-header"
import { EmptyState } from "./empty-state"
```

- [ ] **Step 2: Read wallet context inside DashboardView**

Where the existing `useChain()` destructure happens, extend or add:

```typescript
const { chainName, endpoint, hyperionEndpoint } = useChain()
const { accountName: walletAccount } = useWallet()
```

(Replace the existing `const { chainName } = useChain()` with the version above; if the file already had `endpoint` from `useChain`, just merge.)

- [ ] **Step 3: Replace the empty-state branch**

Find the existing empty-state JSX:

```tsx
if (chainBookmarks.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md space-y-3">
        <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h2 className="text-lg font-medium text-muted-foreground">No bookmarks yet</h2>
        <p className="text-sm text-muted-foreground">
          {bookmarks.length === 0
            ? "Chat with the blockchain and bookmark results to build your dashboard."
            : `No bookmarks for ${chainName || "this chain"} yet. Switch chains to see others.`}
        </p>
      </div>
    </div>
  )
}
```

Replace with:

```tsx
if (chainBookmarks.length === 0) {
  return (
    <EmptyState
      chainName={chainName}
      chainEndpoint={endpoint}
      walletAccount={walletAccount}
    />
  )
}
```

- [ ] **Step 4: Render the header above the grid**

Find the return block that today reads:

```tsx
return (
  <div className="flex-1 overflow-auto p-4 md:p-6">
    <div className="grid ...">
      ...
    </div>
  </div>
)
```

Restructure to render the header above the grid (note: the previous Task 3 already rewrote the inner grid with span classes — preserve that, just hoist the outer `overflow-auto` so the header sits above and the grid scrolls under it):

```tsx
return (
  <div className="flex-1 flex flex-col overflow-hidden">
    <DashboardHeader
      chainName={chainName}
      chainEndpoint={endpoint}
      hyperionEndpoint={hyperionEndpoint}
      bookmarks={orderedBookmarks}
    />
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 [grid-auto-flow:dense]"
        onDragEnd={handleDragEnd}
      >
        {orderedBookmarks.map((bookmark) => {
          const size = getCardSize(bookmark.tool_name)
          const span = size === "wide" ? "lg:col-span-2" : ""
          return (
            <div
              key={bookmark.id}
              data-bookmark-id={bookmark.id}
              className={`transition-opacity ${span} ${dragId === bookmark.id ? "opacity-50 scale-95" : ""} ${
                dropTargetId === bookmark.id ? "ring-2 ring-primary rounded-xl" : ""
              }`}
            >
              <DashboardCard
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
```

The outer `flex-1 flex flex-col overflow-hidden` lets the header stay pinned while the grid area scrolls.

- [ ] **Step 5: Drop the now-unused `Bookmark` import if it was only used by the inline empty state**

Check the imports at the top of `dashboard-view.tsx`. If `Bookmark` (from `lucide-react`) is no longer referenced after the empty-state extraction, remove it from the import line. If still used elsewhere in the file, leave it.

- [ ] **Step 6: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/dashboard/dashboard-view.tsx
git commit -m "feat: render header and empty-state in dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Push, deploy, manual verification

**Files:** none (git push + browser).

- [ ] **Step 1: Push**

```bash
cd /Users/sachitdabas/explorer && git push origin main
```

- [ ] **Step 2: Wait for Vercel deploy**

```bash
SHA=$(cd /Users/sachitdabas/explorer && git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

Expected: `Vercel: success`.

- [ ] **Step 3: Manual browser checks**

On https://talkblock.me, signed in with a wallet:

1. **Empty state**: switch to a chain you have no bookmarks on → see three suggestion cards. Click "Add" on "Watch my account" → bookmark appears in the dashboard, replacing the empty state.
2. **Header strip**: visible above the grid, shows chain dot + name + count + "Last synced …" + "Refresh all" button.
3. **Refresh all**: click → button shows spinner; cards refetch in parallel; "Last synced" snaps to "just now".
4. **Sizing**: bookmark a `get_actions` (or `get_table_rows`) result — it should occupy a full row at `lg:` widths. Compact cards (`get_account`) should sit one-per-column.
5. **Dense backfill**: with a mix of compact and wide cards, no awkward holes — the grid backfills.
6. **Hover & motion**: hovering a card lifts it 2px with a softer shadow. Newly added cards animate in from below.
7. **Chain accent**: switch chains and confirm the left-edge color and header tint shift (Telos teal, EOS blue, etc.).
8. **Theme matrix**: cycle through Light, Dusk, Dim, Gold, Orange. Card chrome should remain readable in all five — accent washes shouldn't blow out contrast.

If any item fails: capture the exact failure (screenshot or console log) and route it back to me.

---

## Done criteria

- Wide cards (`get_actions`, `get_transfers`, `get_table_rows`, `get_producers`, `get_created_accounts`) span both columns on `lg:`; others span one column.
- Cards have `rounded-xl`, soft shadow, hover lift, and a chain-accent left edge + header tint.
- Header strip renders above the grid with chain info, count, last-synced, and a working Refresh-all.
- Empty state on a wallet-connected chain offers the three suggestions and adds a real bookmark on click.
- All visual changes work cleanly across the five existing themes.
