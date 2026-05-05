import type { ContractGuide } from "../index"

export const coreVaulta: ContractGuide = {
  contract: "core.vaulta",
  chains: ["eos", "EOS Mainnet"],
  summary: "Vaulta system contract: A token (replaces EOS), staking, RAM, REX, powerup",
  guide: `# core.vaulta — Vaulta System Contract Guide

The Vaulta network is the rebrand of EOS Mainnet. Its native token is **A** (4 decimals), deployed by the \`core.vaulta\` contract. \`core.vaulta\` wraps the underlying \`eosio\` system contract so users can interact in A instead of EOS — staking, RAM, REX, powerup, voting, claimrewards all flow through here. Source: https://github.com/VaultaFoundation/vaulta-system-contract

## Quick facts
- Contract account: \`core.vaulta\`
- Token symbol: \`A\` (4 decimals → quantity format \`"1.0000 A"\`)
- 1 EOS ↔ 1 A swap, no fees, bidirectional
- Stake/unstake/claimrewards on the EOS chain MUST now go through \`core.vaulta\` using A — the legacy \`eosio\` paths using EOS are no longer used by users

## Transfer

### transfer — Send A tokens
- account: \`core.vaulta\`
- action: \`transfer\`
- data:
  - from: (sender)
  - to: (receiver)
  - quantity: \`"1.0000 A"\` (4 decimals exact, symbol must be A)
  - memo: \`""\` (max 256 chars)

## Swap EOS ↔ A

### Swap EOS → A
Transfer EOS to \`core.vaulta\`. The contract returns A 1:1 to the sender via an inline transfer.
- account: \`eosio.token\`
- action: \`transfer\`
- data:
  - from: (sender)
  - to: \`core.vaulta\`
  - quantity: \`"1.0000 EOS"\`
  - memo: \`""\` (any memo, the contract ignores it for the swap path)

### Swap A → EOS
Transfer A to \`core.vaulta\`. The contract returns EOS 1:1.
- account: \`core.vaulta\`
- action: \`transfer\`
- data:
  - from: (sender)
  - to: \`core.vaulta\`
  - quantity: \`"1.0000 A"\`
  - memo: \`""\`

### swapto — Swap and forward in one transaction
Useful for exchanges or scripts that want to swap and route to a different account in one call.
- account: \`core.vaulta\`
- action: \`swapto\`
- data:
  - from: (sender, holds the source token)
  - to: (final recipient of the swapped token)
  - quantity: \`"1.0000 A"\` or \`"1.0000 EOS"\` (the contract infers swap direction from the symbol)
  - memo: \`""\`

## Staking (CPU & NET)

### delegatebw — Stake A for CPU/NET
- account: \`core.vaulta\`
- action: \`delegatebw\`
- data:
  - from: (staker, pays)
  - receiver: (account that gets the bandwidth — usually same as from)
  - stake_net_quantity: \`"0.0000 A"\` (use \`"0.0000 A"\` if not staking NET)
  - stake_cpu_quantity: \`"1.0000 A"\` (use \`"0.0000 A"\` if not staking CPU)
  - transfer: \`false\` (almost always false — true gifts the stake permanently to receiver)

### undelegatebw — Unstake (3-day refund)
- account: \`core.vaulta\`
- action: \`undelegatebw\`
- data:
  - from: (staker)
  - receiver: (the account whose stake is being reduced)
  - unstake_net_quantity: \`"0.0000 A"\`
  - unstake_cpu_quantity: \`"1.0000 A"\`

After undelegate, A enters a 3-day refund period. Call \`refund\` after the period to reclaim.

### refund — Reclaim unstaked A
- account: \`core.vaulta\`
- action: \`refund\`
- data:
  - owner: (the staker)

## RAM

### buyram — Buy RAM in A
- account: \`core.vaulta\`
- action: \`buyram\`
- data:
  - payer: (pays in A)
  - receiver: (account that gets the RAM)
  - quant: \`"1.0000 A"\` (amount of A to spend; you receive RAM bytes at the current market rate)

### buyrambytes — Buy a specific number of bytes
- account: \`core.vaulta\`
- action: \`buyrambytes\`
- data:
  - payer: (pays in A at market rate)
  - receiver: (account that gets the RAM)
  - bytes: 1024 (uint32_t, exact byte count to receive)

### buyramself — Buy RAM for self
- account: \`core.vaulta\`
- action: \`buyramself\`
- data:
  - payer: (pays in A and receives the RAM)
  - quant: \`"1.0000 A"\`

### sellram — Sell RAM for A
- account: \`core.vaulta\`
- action: \`sellram\`
- data:
  - account: (RAM owner)
  - bytes: 1024 (int64_t, bytes to sell at current market rate)

### ramburn — Permanently destroy RAM
- account: \`core.vaulta\`
- action: \`ramburn\`
- data:
  - owner: (RAM owner)
  - bytes: 1024 (int64_t)
  - memo: \`""\`

### ramtransfer — Transfer RAM bytes
- account: \`core.vaulta\`
- action: \`ramtransfer\`
- data:
  - from: (sender)
  - to: (recipient)
  - bytes: 1024 (int64_t)
  - memo: \`""\`

### giftram / ungiftram — Conditional RAM gifting
\`giftram\` lets one account loan RAM to another with a memo; \`ungiftram\` reclaims it.

## Powerup (rent CPU/NET short-term)

### powerup — Rent CPU/NET for 1+ days
- account: \`core.vaulta\`
- action: \`powerup\`
- data:
  - payer: (pays in A)
  - receiver: (account that gets the resources)
  - days: 1 (uint32_t, typically 1)
  - net_frac: \`"100000000000000"\` (int64, fraction of NET market to rent — use 0 for none)
  - cpu_frac: \`"100000000000000"\` (int64, fraction of CPU market to rent — use 0 for none)
  - max_payment: \`"1.0000 A"\` (cap on how much A this rental can cost)

The fractions are 1e15-scale; consult \`powup.state\` to size them correctly. Most users should let a UI compute these from a target % of network resources.

## REX (Resource Exchange)

REX lets users earn yield on staked A by lending it to the rental market. All REX actions flow through \`core.vaulta\` using A.

### deposit — Move A from balance to REX fund
- account: \`core.vaulta\`
- action: \`deposit\`
- data:
  - owner: (account)
  - amount: \`"1.0000 A"\`

### buyrex — Buy REX shares with the deposited A
- account: \`core.vaulta\`
- action: \`buyrex\`
- data:
  - from: (account)
  - amount: \`"1.0000 A"\` (must be in REX fund first via \`deposit\`)

### sellrex — Sell REX shares back to A in the fund
- account: \`core.vaulta\`
- action: \`sellrex\`
- data:
  - from: (account)
  - rex: \`"1.0000 REX"\` (REX symbol has 4 decimals)

### withdraw — Move A from REX fund back to balance
- account: \`core.vaulta\`
- action: \`withdraw\`
- data:
  - owner: (account)
  - amount: \`"1.0000 A"\`

### unstaketorex — Convert staked CPU/NET into REX in one step
- account: \`core.vaulta\`
- action: \`unstaketorex\`
- data:
  - owner: (staker)
  - receiver: (account whose stake is being moved)
  - from_net: \`"0.0000 A"\`
  - from_cpu: \`"1.0000 A"\`

### mvtosavings / mvfrsavings — Lock REX in 4-year savings (or release)
- account: \`core.vaulta\`
- action: \`mvtosavings\` or \`mvfrsavings\`
- data:
  - owner: (account)
  - rex: \`"1.0000 REX"\`

### donatetorex — Add A to the REX pool (boosts everyone's yield)
- account: \`core.vaulta\`
- action: \`donatetorex\`
- data:
  - payer: (account)
  - quantity: \`"1.0000 A"\`
  - memo: \`""\`

## Voting & rewards

### voteproducer — Vote for block producers
- account: \`core.vaulta\`
- action: \`voteproducer\`
- data:
  - voter: (account)
  - proxy: \`""\` (or proxy account name to delegate vote)
  - producers: ["bp1", "bp2", ...] (up to 30 producer names, alphabetically sorted)

### voteupdate — Refresh vote weight
- account: \`core.vaulta\`
- action: \`voteupdate\`
- data:
  - voter_name: (account)

### claimrewards — Block producers claim block rewards
- account: \`core.vaulta\`
- action: \`claimrewards\`
- data:
  - owner: (the producer account)

## Account creation

### newaccount — Create a new account
- account: \`core.vaulta\`
- action: \`newaccount\`
- data:
  - creator: (account paying for the new account's RAM)
  - name: (the new account name to create)
  - owner: (authority object — owner permission)
  - active: (authority object — active permission)

### newaccount2 — Create a new account from a single public key
- account: \`core.vaulta\`
- action: \`newaccount2\`
- data:
  - creator: (account paying)
  - name: (new account name)
  - key: "PUB_K1_..." (public key string, used for both owner and active)

## Bidding for premium account names

### bidname — Bid A for a short / premium account name
- account: \`core.vaulta\`
- action: \`bidname\`
- data:
  - bidder: (account)
  - newname: (the name being bid on)
  - bid: \`"1.0000 A"\`

### bidrefund — Reclaim a losing bid
- account: \`core.vaulta\`
- action: \`bidrefund\`
- data:
  - bidder: (account)
  - newname: (the name)

## Querying balances and supply
- Table: code=\`core.vaulta\`, table=\`accounts\`, scope=\`<account_name>\`, lower_bound=\`A\` → row contains \`balance\` field as \`"1.0000 A"\`
- Table: code=\`core.vaulta\`, table=\`stat\`, scope=\`A\` → \`supply\`, \`max_supply\`, \`issuer\` for the A token

## Common gotchas
- A and EOS are NOT interchangeable in transactions — \`"1.0000 A"\` and \`"1.0000 EOS"\` are different assets even after a 1:1 swap.
- Quantity precision MUST be 4 decimals for A. Wrong precision = transaction fails with "symbol precision mismatch".
- For CPU/NET stake amounts you don't want to change, pass \`"0.0000 A"\` (not omit the field).
- The \`refund\` after \`undelegatebw\` is NOT automatic — you must call it after the 3-day window.
- REX needs a deposit step before \`buyrex\` works; A in your token balance is not directly REX-eligible.`,
}
