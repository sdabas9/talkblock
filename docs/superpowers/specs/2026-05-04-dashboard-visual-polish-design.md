# Dashboard visual polish

## Goal

Make the dashboard feel more designed: card sizes that match each tool's content shape, polished card chrome, per-chain accent color, a small header stats strip, a useful empty state with one-click suggestions, and subtle motion on cards.

## Scope

**In:**
- Per-tool card size hierarchy (compact / medium / wide), driven by a hardcoded map.
- Card chrome polish: rounded-xl, soft shadow with hover lift, gradient header.
- Per-chain accent color: 2px left border + ~4% header wash, tied to current chain.
- Header stats strip above the grid: chain icon · "N bookmarks" · "Last synced …" · Refresh all button.
- Empty state suggested cards (3): Watch my account, My token balances, My recent activity.
- Hover & entrance motion (CSS only — no Framer Motion dep).

**Out:**
- Per-card user-overridable size (smart defaults only; can layer override later).
- Sparklines / historical data (separate feature).
- Dashboard sharing / public URLs.
- Drag-resize handles.

---

## Size hierarchy

CSS Grid with explicit `grid-column: span N` per card. Default grid is 2 columns at `lg:`, single column below.

| Size | Spans | Default height | Tools |
|---|---|---|---|
| **compact** | 1 col on `lg:`, 1 on mobile | content-fit, min ~200px | `get_account`, `get_currency_balance`, `get_creator` |
| **medium** | 1 col on `lg:`, 1 on mobile | content-fit | `get_block`, `get_transaction`, `get_tokens`, `get_abi`, `build_transaction`, `get_key_accounts`, `get_contract_guide` |
| **wide** | 2 cols on `lg:` (full row), 1 on mobile | content-fit | `get_actions`, `get_transfers`, `get_table_rows`, `get_producers`, `get_created_accounts` |

Implementation: hardcoded `CARD_SIZE: Record<string, "compact" \| "medium" \| "wide">` map in a new `lib/dashboard/card-sizes.ts`. Default to "medium" when a tool isn't listed (forward-compat).

`DashboardView` switches from `grid-cols-1 lg:grid-cols-2` to `grid grid-cols-1 lg:grid-cols-2 auto-rows-max gap-4`. The wrapper div around each `DashboardCard` gets `lg:col-span-2` when size is "wide", otherwise default span 1.

---

## Card chrome polish

Applied uniformly in `DashboardCard`:

- Border radius: `rounded-xl` (was `rounded-lg`).
- Border: keep existing `border` class but switch to `border-border/60` for a softer line.
- Shadow: base `shadow-sm`. On hover, transition to `shadow-lg` and `-translate-y-0.5` over `200ms ease-out`.
- Header background: `bg-gradient-to-b from-muted/40 to-muted/10` (was solid `bg-muted/50`).
- Header padding bumps from `px-3 py-2` to `px-4 py-2.5`.
- Card body: every card variant gets a consistent `p-4` (today some have tighter padding).

Theme-safe: all values use existing tokens (`muted`, `border`, etc.), so the polish travels across light, dusk, dim, gold, orange themes.

---

## Chain accent color

A new `lib/dashboard/chain-accent.ts` exports:

```typescript
export const CHAIN_ACCENT: Record<string, string> = {
  "Telos Mainnet":   "oklch(0.7 0.15 195)",   // teal
  "EOS Mainnet":     "oklch(0.62 0.2 260)",   // blue
  "WAX Mainnet":     "oklch(0.6 0.22 300)",   // purple
  "Jungle4 Testnet": "oklch(0.7 0.18 145)",   // green
  "FIO Mainnet":     "oklch(0.78 0.18 70)",   // amber
  "Libre":           "oklch(0.65 0.22 25)",   // red
}

export function chainAccent(chainName: string | null | undefined): string {
  if (!chainName) return "oklch(0.6 0 0)" // neutral fallback
  return CHAIN_ACCENT[chainName] ?? "oklch(0.6 0 0)"
}
```

`DashboardCard` reads the accent for the bookmark's `chain_name` (not the current chain — bookmarks are per-chain after the recent filter fix). Applied as:

- 2px left border using inline `style={{ borderLeftColor: accent, borderLeftWidth: 2 }}` (so we keep tailwind border for the rest)
- Header gets `style={{ background: \`linear-gradient(to bottom, color-mix(in oklch, ${accent} 8%, var(--muted)/40), var(--muted)/10)\` }}` — the chain accent washes through the gradient subtly

Light/dark theme robustness: uses `color-mix` with the muted token, so the wash adapts. Test in all five themes during the manual check pass.

---

## Header stats strip

New component `components/dashboard/dashboard-header.tsx`. Renders directly above the grid in `DashboardView`. Hidden when bookmark count is 0 (the empty state handles its own messaging).

Layout (single row, justified):

- **Left:** chain accent dot (`h-2 w-2 rounded-full` filled with `chainAccent`) + chain name (text-sm font-medium) + " · " + "N bookmark{s}" (text-sm text-muted-foreground)
- **Right:** "Last synced 12s ago" (text-xs text-muted-foreground, updates every 5s) + a `Refresh all` button (`size="sm" variant="ghost"` with `RefreshCw` icon)

Last-synced state: track a `lastSyncedAt` Date in `DashboardView`. Initialize on mount (when first bookmarks render); update each time Refresh-all completes. Use `formatAge` from `lib/antelope/refetch.ts` for the relative time.

Refresh-all behavior:
1. Iterate all visible (chain-filtered, ordered) bookmarks.
2. For each whose `tool_name` is in `REFRESHABLE_TOOLS`, call `refetchToolData` in parallel.
3. Update each via `updateBookmarkResult(id, freshResult)` from the history store.
4. While refreshing: button disabled, icon spins.
5. On completion: bump `lastSyncedAt`.

---

## Empty state with suggestions

Replaces the existing "No bookmarks yet" message in `DashboardView` when `chainBookmarks.length === 0`. Two flavors:

**(a) Wallet connected, chain selected:** show three suggestion cards (rendered as the same kind of card but with one-click "Add to dashboard" affordance). Each suggestion runs the relevant query against the current chain for `walletAccount`, then calls `addBookmark` with the result.

| Suggestion | Tool | Pre-fill |
|---|---|---|
| Watch my account | `get_account` | `account_name=walletAccount` |
| My token balances | `get_tokens` (Hyperion) or `get_currency_balance` | `account=walletAccount` |
| My recent activity | `get_actions` | `account=walletAccount` |

If Hyperion isn't connected, fall back to `get_currency_balance` for token balances. If RPC fetch fails, the card shows an error state but the user can click again.

**(b) Wallet not connected:** existing copy ("Chat with the blockchain and bookmark results to build your dashboard.") with an additional "Connect wallet to see suggestions" hint.

UI: vertical stack of three skeleton-styled cards with a `+` icon, the suggestion title, a one-line description, and a single primary button ("Watch", "Show", "View"). Click → fetch + addBookmark + the new bookmark replaces the suggestion in place.

Implementation lives in a new `components/dashboard/empty-state.tsx` to keep `DashboardView` lean.

---

## Hover & motion (CSS only)

All in `DashboardCard`'s root div className (no Framer Motion):

- Base: `transition-all duration-200 ease-out`
- Hover: `hover:shadow-lg hover:-translate-y-0.5`
- Entrance: `animate-in fade-in slide-in-from-bottom-2 duration-300` (Tailwind `tailwindcss-animate` utility — already in the project per shadcn dependencies)
- Drag ghost: keep existing `opacity-50`, add `scale-95` to the dragged element via inline style during `dragId === bookmark.id`.

No spring physics, no JS-animated layouts. CSS-only keeps perf cheap and avoids a new dep.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/dashboard/card-sizes.ts` | Create | `CARD_SIZE` map + helper `getCardSize(toolName)` |
| `lib/dashboard/chain-accent.ts` | Create | `CHAIN_ACCENT` map + helper `chainAccent(chainName)` |
| `components/dashboard/dashboard-header.tsx` | Create | Header stats strip with refresh-all |
| `components/dashboard/empty-state.tsx` | Create | Three-suggestion empty state |
| `components/dashboard/dashboard-view.tsx` | Modify | Use grid spans, render header + empty state, wire refresh-all, animate cards in |
| `components/dashboard/dashboard-card.tsx` | Modify | Apply chrome polish, accent color (left border + gradient), hover lift |

No DB changes. No new API routes.

---

## Edge cases

- **Unknown tool**: `getCardSize` returns "medium" (safe default).
- **Unknown chain**: accent falls back to neutral grey.
- **Refresh-all on a card with no `chain_endpoint`**: skipped (refetch needs endpoint; same as existing per-card refresh path).
- **Refresh-all while signed out (localStorage bookmarks)**: works the same — `updateBookmarkResult` handles the no-token branch.
- **Suggestion fetch failure**: the suggestion card shows an inline error and stays clickable.
- **Theme switch**: all values use tokens or `color-mix`, so swapping themes recolors everything live with no reload.

---

## Out of scope (explicit)

- Per-card user-set size override.
- Resizable drag handles.
- Sparklines / time-series charts.
- Per-card cover image / illustration.
- Conditional layouts (e.g., "if more than 6 bookmarks, switch to 3-col").
