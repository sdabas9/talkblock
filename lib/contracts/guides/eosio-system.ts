import type { ContractGuide } from "../index"

export const eosioSystem: ContractGuide = {
  contract: "eosio.system",
  chains: ["*"],
  summary: "System contract: staking, RAM, REX, voting, account creation, powerup",
  guide: `# eosio.system — System Contract Guide

## Staking (CPU / NET)

### delegatebw — Stake tokens for CPU and NET
- account: "eosio"
- action: "delegatebw"
- data:
  - from: (account paying)
  - receiver: (account receiving resources, can be same as from)
  - stake_net_quantity: "1.0000 EOS" (must match chain token precision+symbol)
  - stake_cpu_quantity: "1.0000 EOS"
  - transfer: false (true = gift the staked tokens to receiver)

### undelegatebw — Unstake tokens
- account: "eosio"
- action: "undelegatebw"
- data:
  - from: (account that originally staked)
  - receiver: (account to unstake from)
  - unstake_net_quantity: "1.0000 EOS"
  - unstake_cpu_quantity: "1.0000 EOS"
- NOTE: Unstaked tokens have a 3-day refund period on most chains.

## RAM

### buyram — Buy RAM with tokens
- account: "eosio"
- action: "buyram"
- data:
  - payer: (account paying)
  - receiver: (account receiving RAM)
  - quant: "1.0000 EOS" (amount of tokens to spend on RAM)

### buyrambytes — Buy exact bytes of RAM
- account: "eosio"
- action: "buyrambytes"
- data:
  - payer: (account paying)
  - receiver: (account receiving RAM)
  - bytes: 8192 (number — NOT a string)

### sellram — Sell RAM for tokens
- account: "eosio"
- action: "sellram"
- data:
  - account: (account selling RAM)
  - bytes: 8192 (number)

## Voting

### voteproducer — Vote for block producers
- account: "eosio"
- action: "voteproducer"
- data:
  - voter: (account voting)
  - proxy: "" (set to a proxy account name OR leave empty to vote directly)
  - producers: ["bp1", "bp2", ...] (array, sorted alphabetically, max 30)
- NOTE: producers array MUST be sorted alphabetically or the transaction will fail.

## Account Creation

### newaccount — Create a new account
- This requires TWO actions in sequence:
  1. eosio::newaccount — create the account
  2. eosio::buyrambytes — buy RAM for the new account
  3. (optional) eosio::delegatebw — stake CPU/NET for the new account

- Action 1 (newaccount):
  - account: "eosio"
  - name: "newaccount"
  - data:
    - creator: (existing account paying)
    - name: (new 12-char account name, a-z, 1-5, dots allowed except at end)
    - owner: { threshold: 1, keys: [{ key: "EOS...", weight: 1 }], accounts: [], waits: [] }
    - active: { threshold: 1, keys: [{ key: "EOS...", weight: 1 }], accounts: [], waits: [] }

## REX (Resource Exchange)

REX lets users lend tokens to earn staking rewards, and renters can cheaply get CPU/NET.

### deposit — Deposit tokens into REX fund
- account: "eosio"
- action: "deposit"
- data:
  - owner: (account depositing)
  - amount: "10.0000 EOS" (tokens to deposit into REX fund)

### withdraw — Withdraw tokens from REX fund
- account: "eosio"
- action: "withdraw"
- data:
  - owner: (account withdrawing)
  - amount: "10.0000 EOS"
- IMPORTANT: Before building withdraw, ALWAYS query rexfund first (get_table_rows code="eosio", table="rexfund", scope="eosio", lower_bound=account, upper_bound=account) to get the user's actual available balance. Use that value for the amount field.

### buyrex — Buy REX tokens (lend resources to earn yield)
- account: "eosio"
- action: "buyrex"
- data:
  - from: (account buying REX, must have deposited first)
  - amount: "10.0000 EOS" (tokens from REX fund to convert to REX)
- NOTE: Must call deposit first. REX has a 4-day maturity period before it can be sold.

### sellrex — Sell REX tokens back for tokens
- account: "eosio"
- action: "sellrex"
- data:
  - from: (account selling)
  - rex: "1000.0000 REX" (amount of REX to sell — note REX has 4 decimal precision)
- NOTE: REX must be matured (4 days after purchase). If not enough liquid REX is available, the sell order is queued.
- IMPORTANT: Before building sellrex, ALWAYS query rexbal first (get_table_rows code="eosio", table="rexbal", scope="eosio", lower_bound=account, upper_bound=account) to get the user's actual rex_balance. Use that value for the rex field.

### unstaketorex — Convert staked tokens directly to REX
- account: "eosio"
- action: "unstaketorex"
- data:
  - owner: (account that staked)
  - receiver: (account resources were staked to)
  - from_net: "1.0000 EOS" (amount to unstake from NET)
  - from_cpu: "1.0000 EOS" (amount to unstake from CPU)
- NOTE: Skips the 3-day unstaking refund — tokens go directly into REX.

### rentcpu — Rent CPU from REX pool
- account: "eosio"
- action: "rentcpu"
- data:
  - from: (account paying the rental fee)
  - receiver: (account receiving CPU resources)
  - loan_payment: "0.1000 EOS" (rental fee)
  - loan_fund: "0.0000 EOS" (extra deposit for auto-renewal, 0 = no auto-renew)
- NOTE: Rental lasts 30 days. Cost depends on REX pool utilization.

### rentnet — Rent NET from REX pool
- account: "eosio"
- action: "rentnet"
- data:
  - from: (account paying)
  - receiver: (account receiving NET resources)
  - loan_payment: "0.1000 EOS"
  - loan_fund: "0.0000 EOS"

### mvtosavings — Move REX to savings (no maturity expiry)
- account: "eosio"
- action: "mvtosavings"
- data:
  - owner: (account)
  - rex: "1000.0000 REX"
- NOTE: REX in savings cannot be sold until moved back with mvfromsavings (which restarts the 4-day maturity).

### mvfromsavings — Move REX out of savings
- account: "eosio"
- action: "mvfromsavings"
- data:
  - owner: (account)
  - rex: "1000.0000 REX"
- NOTE: Starts a new 4-day maturity period.

### Typical REX workflow
1. deposit → buyrex (to lend and earn)
2. Wait 4 days for maturity
3. Query rexbal to get actual rex_balance → sellrex with that amount
4. Query rexfund to get available balance → withdraw with that amount

### Querying REX
All REX tables use code="eosio" and scope="eosio". To get a specific account's row, set BOTH lower_bound AND upper_bound to the account name.

- get_table_rows(code="eosio", table="rexbal", scope="eosio", lower_bound="<account>", upper_bound="<account>") → REX balance for a specific account (rex_balance, matured_rex, vote_stake)
- get_table_rows(code="eosio", table="rexfund", scope="eosio", lower_bound="<account>", upper_bound="<account>") → deposited funds not yet converted to REX
- get_table_rows(code="eosio", table="rexpool", scope="eosio") → global REX pool stats (no bounds needed, single row)
- get_table_rows(code="eosio", table="cpuloan", scope="eosio") → active CPU rental loans
- get_table_rows(code="eosio", table="netloan", scope="eosio") → active NET rental loans

## Powerup (EOS Mainnet)

### powerup — Rent CPU/NET resources
- account: "eosio"
- action: "powerup"
- data:
  - payer: (account paying)
  - receiver: (account receiving resources)
  - days: 1 (always 1 on EOS)
  - net_frac: 0 (fraction of total network, use 0 if only need CPU)
  - cpu_frac: 100000000 (fraction of total network capacity)
  - max_payment: "0.0100 EOS" (max willing to pay)
- NOTE: Powerup is the modern way to get CPU/NET on EOS mainnet. Staking still works but powerup is cheaper for temporary usage.

## Common Token Precisions
- EOS: 4 decimals, symbol "EOS" → "1.0000 EOS"
- WAX: 8 decimals, symbol "WAX" → "1.00000000 WAX"
- TLOS: 4 decimals, symbol "TLOS" → "1.0000 TLOS"
- FIO: 9 decimals, symbol "FIO" → "1.000000000 FIO"
- LIBRE: 4 decimals, symbol "LIBRE" → "1.0000 LIBRE"

## Querying Resource Info
- Table: "eosio" / "userres" / scope = account_name → shows RAM, CPU, NET delegated
- Table: "eosio" / "delband" / scope = account_name → shows delegation details
- Table: "eosio" / "refunds" / scope = account_name → shows pending refunds`,
}
