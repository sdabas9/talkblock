# Terminal Dashboard Redesign — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm with user)

## Problem

The dashboard renders bookmarked chat cards verbatim inside a generic 2-column grid. Result: ragged row heights, walls of chat-formatted content, raw-JSON dumps for unsupported tools — it reads as "messy and bland" rather than a composed dashboard.

## Decisions (user-approved)

| Decision | Choice |
|---|---|
| Visual language | **Data Terminal** — monospace, sharp corners, tight grid, borders-not-shadows (Bloomberg/Grafana energy) |
| Theming | **Theme-adaptive** — terminal structure everywhere, all colors from existing theme tokens; works across root/dim/dusk/gold/orange |
| Layout | **Stat strip + strict module grid** — compact bookmarks collect into a KPI tile row; the rest snap to fixed grid modules |
| Card content | **Full dashboard-native renderers** for every tool (raw-JSON fallback eliminated); chat cards untouched in chat |
| Implementation | **Pure CSS Grid + module map** — no new dependencies; existing stores, drag-reorder, and refresh logic survive |

## Architecture

```
components/dashboard/
  dashboard-view.tsx        # reworked: splits bookmarks into strip + grid zones
  stat-strip.tsx            # NEW: KPI tile row
  dashboard-panel.tsx       # NEW: terminal panel chrome (replaces dashboard-card.tsx)
  renderers/                # NEW: per-tool dashboard renderers
    stat-tile.tsx           # 1×1 tiles: balance, creator, account, key_accounts
    transfers-panel.tsx
    actions-panel.tsx
    table-panel.tsx         # get_table_rows + get_producers
    tokens-panel.tsx
    block-panel.tsx
    transaction-panel.tsx
    abi-panel.tsx
    created-accounts-panel.tsx
    kv-panel.tsx            # generic key-value fallback (replaces raw JSON <pre>)
lib/dashboard/
  card-sizes.ts             # evolves into module map: "tile" | "panel" | "wide"
```

Unchanged: `lib/stores/dashboard-store` (itemOrder, customLabels), `lib/stores/history-store` (bookmarks CRUD), `lib/antelope/refetch.ts` (REFRESHABLE_TOOLS, refetchToolData, formatAge), `/api/bookmarks`.

## Layout system

- **Zone split:** bookmarks with module `tile` render in the stat strip; `panel`/`wide` render in the module grid below.
- **Strip:** `flex-wrap` row of fixed-height tiles, min-width ~180px; wraps to more rows past ~6 tiles.
- **Grid:** desktop `grid-cols-4`, fixed `grid-auto-rows` (~88px), `grid-auto-flow: dense`.
  - `panel` = `col-span-2 row-span-3`
  - `wide` = `col-span-4 row-span-3`
  - Tablet: 2 cols (panel=2, wide=2). Mobile: 1 col, everything stacks (tiles become full-width rows).
- **Alignment guarantee:** fixed row-spans; overflowing content clips with inner scroll — rows always align.
- **Module map (initial):**
  - `tile`: get_currency_balance, get_creator, get_account, get_key_accounts
  - `wide`: get_table_rows, get_producers, get_actions, get_transfers
  - `panel`: get_block, get_transaction, get_tokens, get_abi, build_transaction, get_created_accounts, unknown tools
- **Drag-to-reorder:** existing HTML5 drag code retained; reordering constrained within each zone (tile↔tile, panel↔panel). Single shared `itemOrder` list as today.

## Visual language

**Panel chrome** (shared by all grid panels):
- `rounded-none`, 1px `border-border`, `bg-card`, no shadows.
- Header: uppercase mono tool label with tracking (e.g. `TRANSFERS`, `TABLE · DELPHIORACLE`), 10–11px `text-muted-foreground`; hover-visible refresh/remove icons + drag grip; click-to-rename label retained.
- Footer: tiny mono caps age line (`REFRESHED 12S AGO` / `SAVED 3D AGO`) + status dot: pulses `text-primary` while refreshing, `text-destructive` with tooltip on refresh error (replaces the error banner — no layout shift).

**Stat tiles:** panel chrome minus footer; 2px accent top-border (`border-t-primary` for balance/token tiles; identity tiles use the `chart-2` token if the theme defines it, else `border-t-muted-foreground`); layout = small caps label → large mono value (~20px, `tabular-nums`) → one sub-line.

**Theming:** zero hard-coded colors. Tokens only: `bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `text-destructive`. Mono (`font-mono`) for all data; app sans only in empty states/tooltips.

**Semantic accents:** inbound transfers `text-primary` + `←`, outbound `text-destructive` + `→` (arrows ensure color isn't the only signal).

**Background:** faint graph-paper grid behind the dashboard (CSS `linear-gradient` lines at `border/40`, 24px pitch) — dashboard-tab only.

## Renderers

| Tool | Module | Renderer |
|---|---|---|
| get_currency_balance | tile | Big amount + symbol; multi-token → primary + "+N more" |
| get_creator | tile | Creator name + creation date |
| get_account | tile | Name + core balance + micro CPU/NET/RAM bars |
| get_key_accounts | tile | Count + first account name |
| get_transfers / get_actions | wide | Dense mono rows (`← 120.0000 TLOS  alice.tlos  2m`), ~8 visible, inner scroll |
| get_table_rows / get_producers | wide | Mono table, sticky header row |
| get_tokens | panel | Two-column symbol/amount list |
| get_block | panel | Key-value rows: producer, timestamp, tx count |
| get_transaction | panel | Key-value rows: status, block, actions summary |
| get_abi | panel | Action & table name chips |
| get_created_accounts | panel | Name + date rows |
| build_transaction | panel | **Exception:** embeds existing `TxProposalCard` inside panel chrome (interactive signing machinery; not rebuilt in v1) |
| unknown / guides | panel | `kv-panel`: flattened key-value rows (raw JSON dump eliminated) |

## Edge cases

- Refresh behavior unchanged: auto-refresh on mount for `REFRESHABLE_TOOLS`; others show `SAVED …` only.
- Refresh error → destructive status dot + tooltip (no banner).
- Empty dashboard → existing `EmptyState`, restyled with terminal type.
- Overflow → inner scroll within fixed module; never grows the row.
- Chain filter (bookmarks scoped to selected chain) unchanged.

## Testing / verification

No test infrastructure in this repo. Verification =
1. `npm run lint` and `npm run build` pass.
2. Manual visual pass: all 5 themes (root, dim, dusk, gold, orange) × 3 breakpoints (desktop/tablet/mobile).
3. Interactions: drag-reorder within each zone, rename, manual + auto refresh, remove, bookmark of an unsupported tool renders via kv-panel.

## Out of scope

- User-resizable panels (module map migrates cleanly to react-grid-layout later if ever wanted).
- Chat card redesign — chat rendering is untouched.
- New bookmarkable tool types or dedicated renderers for Hyperion extras (get_voters, get_proposals, etc.) beyond the kv-panel fallback.
