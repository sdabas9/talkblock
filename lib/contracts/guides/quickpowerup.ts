import type { ContractGuide } from "../index"

export const quickPowerup: ContractGuide = {
  contract: "quickpowerup",
  chains: ["eos", "EOS Mainnet"],
  summary: "Quickpowerup wrapper on Vaulta: rent CPU/NET via transfer-with-memo (no fracs)",
  guide: `# quickpowerup — Powerup wrapper on Vaulta (and EOS legacy)

The native \`core.vaulta::powerup\` action requires the caller to compute \`net_frac\` and \`cpu_frac\` (1e15-scale fractions of daily resources) and \`max_payment\`. Getting these right requires reading \`powup.state\` and bisecting the pricing curve. \`quickpowerup\` is a wrapper contract that does all of that for you: send A (or legacy EOS) to it with a memo specifying the receiver and a CPU/NET split %, and it dispatches the inline \`powerup\` paid by itself.

Source: https://github.com/sdabas9/quickpowerup

## Quick facts
- Contract account: \`quickpowerup\` (Vaulta) — same WASM also deployed at \`pwrupwrapper\` on Jungle4 testnet
- Token contract for payment: \`core.vaulta\` (A) on Vaulta. Legacy: \`eosio.token\` (EOS) is also handled.
- 1 day rental period (chain default; not configurable in the wrapper)
- Receiver gets the powerup grant. Payer (\`from\`) is the account whose A leaves the balance.
- No fees beyond the chain's native powerup price; unused budget accumulates on the contract.

## Powerup — Transfer with memo

Send A (or EOS) to \`quickpowerup\` with memo \`<receiver> <cpu_pct>\`.

- account: \`core.vaulta\` (or \`eosio.token\` for legacy EOS)
- action: \`transfer\`
- data:
  - from: (the account paying for the powerup; needs the A balance)
  - to: \`quickpowerup\`
  - quantity: \`"0.0100 A"\` (whole budget; CPU/NET split is determined by the memo)
  - memo: \`"<receiver> <cpu_pct>"\` — receiver = the account being powered up; cpu_pct = % of the budget allocated to CPU (1-99). NET gets \`100 - cpu_pct\`.

### Memo recipes
- \`"<self> 95"\` — **95% CPU / 5% NET. Use this as the default when proposing a transaction** unless the user specifies otherwise.
- \`"<self> 98"\` — 98% CPU / 2% NET. Use for accounts that almost exclusively burn CPU (cosigners, signing bots).
- \`"<self> 50"\` — 50/50. Balanced; rarely the right answer because NET is cheap and rarely the bottleneck.
- \`"<self> 2"\` — 2% CPU / 98% NET. Inverse — only useful when an account mostly transmits large payloads.

Recommended default for user-built proposals: **95**. CPU is the binding resource on EOS/Vaulta; the small NET allocation guards against transient NET pressure for the rest of the day.

### Sizing the budget
\`0.0100 A\` is enough for ~340k µs CPU + ~1.8 GB NET in current market conditions — way more than most accounts need for a day. \`0.0500 A\` is the comfortable default for high-traffic cosigner sponsors. The contract auto-computes the actual \`max_payment\` cap; your transferred amount is the upper bound.

## Cleanup expired rows

Anyone can erase a receiver's row from the \`powerups\` table once \`valid_until\` has passed (frees ~150 bytes of RAM on the contract). Free for the caller; small public good.

- account: \`quickpowerup\`
- action: \`cleanup\`
- authorization: any (no auth required)
- data:
  - receiver: (account whose row is being cleaned)

Tools/UIs typically don't need to call this — it's mostly run by RAM scavengers.

## Querying — has my account been powered up by quickpowerup?

### powerups table
- code: \`quickpowerup\`
- scope: \`quickpowerup\`
- table: \`powerups\`
- lower_bound: \`<receiver>\`
- upper_bound: \`<receiver>\`
- limit: 1

Returns one row per receiver:
- \`receiver\` (name)
- \`payer\` (name) — who paid for the most recent powerup
- \`amount\` (asset) — total spent in the most recent grant
- \`cpu_pct\` (uint8)
- \`powered_up_at\` (time_point)
- \`valid_until\` (time_point) — refresh before this expires

If no row exists, the receiver hasn't been powered up via quickpowerup (could still have a native \`core.vaulta::powerup\` grant or staked CPU/NET — check \`get_account\` for those).

## Common gotchas
- Memo MUST be exactly \`<receiver> <cpu_pct>\` separated by a single space. Both fields are required. Wrong format = transfer is refunded.
- Receiver must be an existing account.
- cpu_pct: 0 and 100 are both invalid. Use 1 or 99 for near-pure CPU/NET respectively.
- If your transferred amount is too small to cover the chain's minimum powerup fee at the requested fracs, the contract refunds and emits a \`swaptrace\`-style log (see source).
- Sending EOS via \`eosio.token::transfer\` is supported on the legacy path but most users on Vaulta should send A from \`core.vaulta\`.
- Power-up grants do NOT stack across days — each call replaces the prior 1-day grant; the contract overwrites the row.

## When to use vs. native powerup
- Use \`quickpowerup\` whenever a UI / wallet / cron is involved — the user just specifies a budget and a CPU/NET preference.
- Use \`core.vaulta::powerup\` directly only when you have a specific \`net_frac\` / \`cpu_frac\` target (e.g., a contract mathematically computing exact resource requirements) and don't want a wrapper layer.`,
}
