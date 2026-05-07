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

## Indexed pair IDs — USE THESE FIRST

When the user asks to swap any of these pairs, USE the pair_id directly. **Do NOT scan the pairs table** — it has 3000+ rows and dumping it wastes credits and time. Only fall back to a table query if the pair the user wants isn't here.

Currently indexed: the three deepest EOS-quoted pairs. All verified on-chain with material reserves.

| pair_id | token0 / token1 | Use for |
|---|---|---|
| 28   | EOS / CHEX  | EOS ↔ CHEX |
| 93   | EOS / IQ    | EOS ↔ IQ |
| 194  | EOS / BOX   | EOS ↔ BOX |

token0/token1 order doesn't dictate swap direction — the input can be either token in the pair. You don't flip the pair_id based on direction.

Multi-hop guidance inside this set (EOS as the hub):
- BOX ↔ CHEX: \`194-28\`
- BOX ↔ IQ: \`194-93\`
- CHEX ↔ IQ: \`28-93\`
- Multi-hop memo format: \`swap,<min_return>,<id1>-<id2>\`

### Anything else — refer the user to defibox.io

For any swap NOT covered by the indexed pair table above (e.g. A, XSAT, USDT, USN, BOX/USDT, less popular tokens), DO NOT scan the on-chain \`pairs\` table or attempt to discover a pair_id yourself. Instead, tell the user to use the Defibox UI directly — it lists every pair with live prices and routing, and the on-chain table scan would burn credits without giving them a better experience.

Sample reply when the user requests an out-of-list swap:

> "I only have a few popular pairs indexed for direct on-chain swaps (BOX, CHEX, IQ vs EOS). For \`<their token>\`, please use https://defibox.io directly — they'll route the swap optimally and you can sign from there with your wallet."

Direct them to https://defibox.io and stop. Don't build a transaction proposal for an unindexed pair.

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
