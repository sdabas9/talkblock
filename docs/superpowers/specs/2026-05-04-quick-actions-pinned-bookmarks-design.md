# Pinned quick-action bookmarks

## Goal

Give signed-in wallet users a small set of always-available shortcuts in the sidebar — Powerup, Show balance, Buy RAM, Stake, Transfer — pre-filled with their connected account where applicable. Click → injects a synthetic chat message that renders the relevant card (transaction proposal for the four action pins, balance card for the query pin).

## Scope

**In:**
- A new "Quick actions" sidebar section, between chain info and the Bookmarks list.
- Five pins, chain-filtered: Powerup, Show balance, Buy RAM, Stake, Transfer.
- Pre-fill `from` / `payer` / `receiver` (and equivalents) with `walletAccount`.
- Disabled state with a "Connect wallet" hint when no wallet is connected.

**Out:**
- Dashboard pins (sidebar only).
- User-customizable pins (reorder, hide, add custom, persist preferences).
- Smart pre-fill of amounts (`quantity`, `quant`, `stake_*`, etc.) — user fills these.
- Pins on chains where the action isn't supported.
- Renaming pins (they're system-defined; the user-rename surface stays scoped to real bookmarks).

## Data model

A hardcoded registry, no DB rows. Lives in a new file:

```
lib/quick-actions/registry.ts
```

Each entry:

```typescript
type QuickActionContext = {
  walletAccount: string  // guaranteed non-empty (UI gates on this)
  chainName: string
  chainEndpoint: string | null
  hyperionEndpoint: string | null
}

type QuickActionInjection =
  | { kind: "tx"; txProposal: TxProposal }
  | { kind: "tool-result"; toolName: string; result: Record<string, unknown> }

type QuickAction = {
  id: string                              // stable, used in synthetic message id
  label: string
  icon: LucideIcon
  applicableChains: string[] | "*"        // matched against chainName, "*" = all chains
  build: (ctx: QuickActionContext) => Promise<QuickActionInjection> | QuickActionInjection
}
```

Chains are matched on the `chainName` string (the same field the existing bookmark filter uses — `b.chain_name === chainName`). The exact set of names lives in the chain-store; the registry's `applicableChains` lists the names it supports.

## The five pins

| ID | Label | Chains | Behavior |
|---|---|---|---|
| `powerup` | Powerup | `Telos`, `EOS` | Builds `eosio::powerup` with `payer=self, receiver=self, days=1`, blank `net_frac/cpu_frac/max_payment` |
| `balance` | Show balance | `*` | Runs `get_currency_balance` against `chainEndpoint` for `account=self`; injects a `tool-get_currency_balance` synthetic message |
| `buyram` | Buy RAM | `Telos`, `EOS`, `WAX` | Builds `eosio::buyram` with `payer=self, receiver=self`, blank `quant` |
| `stake` | Stake | `Telos`, `EOS` | Builds `eosio::delegatebw` with `from=self, receiver=self, transfer=false`, blank `stake_net_quantity / stake_cpu_quantity` |
| `transfer` | Transfer | `*` | Builds `eosio.token::transfer` with `from=self`, blank `to / quantity / memo` |

Exact chain-name strings are confirmed against `lib/stores/chain-store.tsx` during implementation. If a chain name in the chain store doesn't match the registry's expectations, the registry is the place to update — keep it as the single source of truth for "which pins apply where."

## Click behavior

The chat panel already handles `window.dispatchEvent(new CustomEvent("bookmark-show", { detail: <bookmark-shaped> }))` (`components/chat/chat-panel.tsx:136-187`) by synthesizing an assistant message with a tool result part and appending it via `setMessages`. We reuse this exact path. The detail object passed in matches the shape of a stored bookmark:

```typescript
{
  id: string                       // synthetic id, see below
  tool_name: string
  result: Record<string, unknown>
  chain_endpoint: string | null
  created_at: string
}
```

For tx pins, the synthesized result is the `TxProposal` shape returned by the `build_transaction` tool. For balance, it's the `get_currency_balance` tool output shape (`{ account, balances }`).

The synthetic message id MUST start with `bookmark-` so `lib/llm/optimize-messages.ts` rewrites it into plain text before sending to the LLM (we shipped this rewrite earlier — it prevents Anthropic 400s on unpaired tool_use blocks). The id format: `bookmark-quick-<action_id>-<Date.now()>`.

## UI

In `components/layout/left-panel.tsx`, between the chain info block and the Bookmarks block:

- Section header: small lucide icon (`Zap`) + "Quick actions" label, matching the existing "Bookmarks" header style.
- One row per applicable action: icon + label, full-width clickable.
- Filter: include only entries whose `applicableChains` includes the current `chainName`, or is `"*"`.
- Empty state: if zero applicable pins on the current chain (shouldn't happen since `transfer` and `balance` are universal), the section hides entirely.
- When `!walletAccount`: rows render disabled (50% opacity, cursor not-allowed), with a one-line muted hint at the top of the section: "Connect wallet to enable".

Click handler:
1. If `!walletAccount`, no-op.
2. `await action.build(ctx)` to produce the injection payload.
3. Wrap into the bookmark-shaped detail and dispatch `bookmark-show`.
4. The chat panel appends the synthetic message; the relevant card renders inline.

For the balance pin, `build` performs an HTTP call (`POST {chainEndpoint}/v1/chain/get_currency_balance` with `code=eosio.token, account=self`). On error, it injects a synthetic `tool-get_currency_balance` message with `{ error: "<message>" }` so the existing error-rendering path in `tool-result-renderer.tsx:65-71` shows a clean error instead of a thrown exception.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `lib/quick-actions/registry.ts` | Create | Exports the `QuickAction[]` registry and the `QuickActionContext` / `QuickActionInjection` types. |
| `lib/quick-actions/build-tx.ts` | Create | Helper `buildTxProposal({ description, actions })` that returns a `TxProposal`-shaped object. Used by the tx-type entries in the registry to keep their `build` functions one-liners. |
| `lib/quick-actions/dispatch.ts` | Create | `dispatchQuickAction(action, ctx)`: runs `build`, wraps the result in the bookmark-shaped detail, fires the `bookmark-show` event. Keeps the UI component dumb. |
| `components/layout/left-panel.tsx` | Modify | Render the new "Quick actions" section. Filter pins by chain. Wire up clicks. Disable when no wallet. |

No server changes. No DB changes. No new API routes.

## Edge cases

- **Connecting wallet mid-session**: the registry rebuild is automatic — `walletAccount` and `chainName` come from `useWallet()` / `useChain()` and React re-renders the sidebar.
- **Chain switch**: the bookmark-clear-on-chain-change effect in chat-panel doesn't apply to the sidebar pin section itself; the section just re-filters.
- **Unsupported chain for a tx pin**: if a user crafts a powerup tx on a chain that doesn't have `eosio::powerup`, the wallet sign step would fail. We pre-empt this by chain-filtering the pin from the UI in the first place.
- **Balance fetch failure**: rendered as a `tool-get_currency_balance` message with `error` set; user sees the standard tool-error styling.
- **Multiple rapid clicks on the same pin**: each click appends a fresh synthetic message — same as repeatedly clicking a bookmark today. No deduping.

## Reuse vs. duplication

This intentionally piggybacks on the existing bookmark-show injection path rather than introducing a parallel mechanism. The synthetic-message id rewrite in `optimize-messages.ts` already covers it. The renderer (`tool-result-renderer.tsx`) doesn't need to know quick actions exist — it just renders a tool result like any other.
