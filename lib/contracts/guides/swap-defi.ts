import type { ContractGuide } from "../index"

export const swapDefi: ContractGuide = {
  contract: "swap.defi",
  chains: ["eos", "EOS Mainnet"],
  summary: "Defibox AMM DEX on Vaulta: swap, add/remove liquidity via transfer-with-memo",
  guide: `# swap.defi — Defibox AMM Guide (Vaulta / EOS Mainnet)

Defibox is a constant-product AMM. Most user actions are NOT direct contract calls — they are **transfers to \`swap.defi\` with a structured memo**. The contract reads the memo from the \`on_transfer\` notification and executes the swap or deposit inline. LP tokens are issued by \`lptoken.defi\` (each pool has its own LP symbol like \`BOX194\`, \`BOXCIV\`, etc).

Source: https://github.com/stableex/sx.defibox · https://docs.defibox.io

## Quick facts
- Main contract: \`swap.defi\`
- LP token issuer: \`lptoken.defi\`
- Fee recipient: \`fees.defi\`
- Trade fee: 0.3% (typical), split between LPs and protocol
- Pairs are identified by integer \`pair_id\` (look it up via the pairs table — see Querying section)

## Swap

### Single-hop swap — Transfer with swap memo
Transfer the input token TO \`swap.defi\` with memo \`swap,<min_return>,<pair_id>\`.

- account: (the input token's contract — e.g. \`core.vaulta\` for A, \`eosio.token\` for EOS, \`tethertether\` for USDT)
- action: \`transfer\`
- data:
  - from: (sender)
  - to: \`swap.defi\`
  - quantity: \`"1.0000 A"\` (the input amount, in the input token)
  - memo: \`"swap,0,194"\`

Memo fields:
- \`swap\` — literal action keyword
- \`<min_return>\` — minimum amount of output token to accept, in the output token's **smallest units** (no decimal point). E.g. for an output token with 4 decimals, \`100\` means 0.0100. Set to \`0\` to accept any output (no slippage protection — only do this for tiny amounts or trusted conditions).
- \`<pair_id>\` — the integer pair id (lookup via pairs table)

The input token MUST be one of the two tokens in the pair, otherwise the contract rejects the transfer and refunds.

### Multi-hop swap — Chain pairs with hyphens
Same shape, but \`<pair_id>\` becomes a hyphen-separated route: \`<id1>-<id2>-<id3>-...\`. Example real memo: \`"swap,2832,2550-2591-2493-1734"\`.

- account: (input token contract)
- action: \`transfer\`
- data:
  - from: (sender)
  - to: \`swap.defi\`
  - quantity: \`"1.0000 A"\`
  - memo: \`"swap,2832,2550-2591-2493-1734"\` (min_return is on the FINAL output token after all hops)

The input token must be in the first pair; the output of each pair becomes the input of the next, so the route must form a valid chain. The contract validates this — bad route refunds.

## Add liquidity (3 steps: 2 transfers + 1 action)

To add liquidity to a pair, deposit BOTH tokens via separate transfers, then call \`deposit\` to mint LP tokens.

### Step 1: Transfer token0 with deposit memo
- account: (token0 contract)
- action: \`transfer\`
- data:
  - from: (provider)
  - to: \`swap.defi\`
  - quantity: \`"1.0000 A"\` (amount of token0)
  - memo: \`"deposit,<pair_id>"\`

### Step 2: Transfer token1 with deposit memo
- account: (token1 contract)
- action: \`transfer\`
- data:
  - from: (provider)
  - to: \`swap.defi\`
  - quantity: \`"3.4500 EOS"\` (amount of token1, ratio should match current reserves)
  - memo: \`"deposit,<pair_id>"\`

### Step 3: Call deposit to mint LP tokens
- account: \`swap.defi\`
- action: \`deposit\`
- data:
  - owner: (provider)
  - pair_id: (the pair id, uint64)

The contract uses the deposited token0 + token1 to mint LP tokens to \`owner\`. If the deposited ratio doesn't exactly match the current reserve ratio, the contract uses the limiting side and refunds the excess to the user's contract balance (claim later via \`withdrawfund\`).

### Cancel a pending deposit (before deposit action)
If you transferred but haven't called \`deposit\` yet, you can cancel and reclaim:
- account: \`swap.defi\`
- action: \`cancel\`
- data:
  - owner: (provider)
  - pair_id: (the pair id)

## Remove liquidity — Transfer LP tokens back

Transfer the LP token (issued by \`lptoken.defi\`, with a per-pool symbol like \`BOX194\`) to \`swap.defi\` with empty memo. The contract burns the LP and returns both underlying tokens to the user.

- account: \`lptoken.defi\`
- action: \`transfer\`
- data:
  - from: (LP holder)
  - to: \`swap.defi\`
  - quantity: \`"100 BOXCIV"\` (your LP token amount; symbol is the per-pool one — find it in the pairs table)
  - memo: \`""\` (empty)

## Withdraw refunded funds

If a swap or deposit left tokens in your contract balance (excess deposit, refunds, etc.), pull them back to your wallet:
- account: \`swap.defi\`
- action: \`withdrawfund\`
- data:
  - quantity: \`"1.0000 A"\` (token to withdraw — must be in your \`balances\` table row)

## Create a new pair

Anyone can create a pair (requires RAM + a small creation fee, charged via prior token deposit on some chains).
- account: \`swap.defi\`
- action: \`createpair\`
- data:
  - creator: (account)
  - token0: \`{ "contract": "core.vaulta", "symbol": "4,A" }\`
  - token1: \`{ "contract": "eosio.token", "symbol": "4,EOS" }\`

Symbol format is \`<precision>,<SYMBOL>\` (e.g. \`4,A\`, \`8,XSAT\`, \`6,USDT\` on some contracts). The precision MUST match the actual issued token.

## Common pair IDs — USE THESE FIRST

When the user asks to swap any of these pairs, USE the pair_id directly. **Do NOT scan the pairs table** — it has 3000+ rows and dumping it wastes credits and time. Only fall back to a table query if the pair you need isn't in this list.

Sample on-chain swap activity confirms these pair_ids (verified 2026-05; sanity-check via a single \`get_table_rows\` with \`lower_bound: <pair_id>, upper_bound: <pair_id>, limit: 1\` if a swap fails):

| pair_id | token0 → token1 | Use for |
|---|---|---|
| 12   | USDT / EOS    | EOS ↔ USDT (legacy) |
| 2557 | A / EOS       | A ↔ EOS (Vaulta swap) |
| 2558 | A / USDT      | A ↔ USDT |
| 2571 | XSAT / A      | A ↔ XSAT |
| 2550 | EOS / XSAT    | EOS ↔ XSAT |
| 194  | EOS / BOX     | EOS ↔ BOX |
| 199  | BOX / USDT    | BOX ↔ USDT |
| 128  | EOS / POW     | EOS ↔ POW |
| 28   | CHEX / EOS    | CHEX ↔ EOS |
| 1734 | MLNK / EOS    | MLNK ↔ EOS |
| 2279 | BRAM / EOS    | RAM-cert (BRAM) ↔ EOS |
| 2411 | EOS / PKDAO   | EOS ↔ PKDAO |
| 1720 | XSOV / EOS    | XSOV ↔ EOS |
| 1775 | POW / XSOV    | POW ↔ XSOV (multi-hop intermediate) |
| 93   | IQ / EOS      | IQ ↔ EOS |
| 458  | KROWN / USDT  | KROWN ↔ USDT |
| 2493 | SEOS / MLNK   | sEOS ↔ MLNK |
| 2591 | SEOS / XSAT   | sEOS ↔ XSAT |

The order in token0/token1 dictates direction in the pair, but the swap itself is bidirectional — the input token just needs to be one of the two. You don't need to flip the pair_id based on swap direction.

Multi-hop suggestions: if a direct pair isn't in this list, try EOS as the bridge first (EOS pairs with everything). For A swaps, route through pair 2557 (A/EOS) then a EOS/X pair.

### Falling back: lookup via the pairs table

If the user asks for a pair NOT in the list above, prefer Defibox's REST API or use a TARGETED table query — never scan the whole table:

- code: \`swap.defi\`
- table: \`pairs\`
- scope: \`swap.defi\`
- lower_bound: \`<approximate pair_id if known>\`
- limit: 50

Each row: \`id\`, \`token0\`, \`token1\`, \`reserve0\`, \`reserve1\`, \`liquidity_token\` (per-pool LP symbol), \`price0_last\`, \`price1_last\`, etc. Match (token0.contract, token0.symbol, token1.contract, token1.symbol) against what the user wants. If you must scan, page through with \`lower_bound\` and stop as soon as you find the match — never dump the whole table to chat.

### User's LP positions
LP tokens live in \`lptoken.defi\`'s \`accounts\` table. To see one user's LP holdings:
- code: \`lptoken.defi\`
- table: \`accounts\`
- scope: \`<account_name>\`

### User's contract balance (refund pool)
After failed swaps or excess deposits, refunded tokens accrue in the user's contract balance:
- code: \`swap.defi\`
- table: \`balances\`
- scope: \`<account_name>\`

## Common gotchas
- Min return is in **smallest units** of the output token (no decimal point) — \`100\` for a 4-decimal token = 0.0100. Setting it too low risks sandwich/MEV; setting it too high causes the swap to refund.
- The input token must be one of the two tokens in the FIRST pair of the route. Wrong token = transfer is refunded.
- Multi-hop routes must form a valid chain (output of pair N matches input of pair N+1). Bad route = refund.
- After \`deposit\`, the contract may refund unmatched ratio amounts to your contract balance — they sit there until you call \`withdrawfund\`.
- LP tokens are per-pool symbols (e.g. \`BOX194\`, \`BOXCIV\`) issued by \`lptoken.defi\`, not \`swap.defi\`.
- For multi-hop swaps starting in EOS the protocol historically gave better routing rewards — generally the ETH→hop pattern is the cheapest path.`,
}
