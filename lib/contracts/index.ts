/**
 * Contract guide registry.
 *
 * Curated knowledge about Antelope smart contracts that the LLM can
 * look up on-demand via the get_contract_guide tool. Each guide covers
 * action workflows, parameter formats, table scopes, and common gotchas
 * so the LLM can build correct transactions without guessing.
 */

export interface ContractGuide {
  /** Contract account name (e.g. "eosio.system") */
  contract: string
  /** Chain names this guide applies to. Use ["*"] for all Antelope chains. */
  chains: string[]
  /** One-line description */
  summary: string
  /** Full guide text — this is what the LLM reads */
  guide: string
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

const GUIDES: ContractGuide[] = [
  {
    contract: "eosio.system",
    chains: ["*"],
    summary: "System contract: staking, RAM, voting, account creation, powerup",
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
  },

  {
    contract: "eosio.token",
    chains: ["*"],
    summary: "Standard token contract: transfers, token creation, supply queries",
    guide: `# eosio.token — Token Contract Guide

## Transfer

### transfer — Send tokens
- account: "eosio.token" (or the specific token contract)
- action: "transfer"
- data:
  - from: (sender account)
  - to: (receiver account)
  - quantity: "1.0000 EOS" (MUST match exact precision and symbol)
  - memo: "" (string, can be empty, max 256 chars)

### CRITICAL — Quantity Format
The quantity MUST match the token's exact precision and symbol:
- EOS: "1.0000 EOS" (4 decimals)
- WAX: "1.00000000 WAX" (8 decimals)
- TLOS: "1.0000 TLOS" (4 decimals)
- USDT on EOS: "1.0000 USDT" (4 decimals, contract: tethertether)
- Wrong precision = transaction FAILS with "symbol precision mismatch"

### How to find token precision
1. get_currency_balance on the token contract for any known holder
2. Or query table: code=<token_contract>, table="stat", scope=<SYMBOL> → look at "max_supply" field for precision

## Token Creation (for contract deployers)

### create — Create a new token
- account: (token contract account)
- action: "create"
- data:
  - issuer: (account that can issue)
  - maximum_supply: "1000000.0000 EOS"

### issue — Issue tokens to issuer
- account: (token contract)
- action: "issue"
- data:
  - to: (must be the issuer)
  - quantity: "100.0000 EOS"
  - memo: ""

## Querying Balances
- Table: code=<token_contract>, table="accounts", scope=<account_name>
- Table: code=<token_contract>, table="stat", scope=<SYMBOL> → supply info

## Common Token Contracts by Chain
- EOS: eosio.token (EOS), tethertether (USDT), everipediaiq (IQ)
- WAX: eosio.token (WAX)
- Telos: eosio.token (TLOS), tokens.swaps (various)`,
  },

  {
    contract: "eosio.msig",
    chains: ["*"],
    summary: "Multisig proposals: propose, approve, execute multi-signature transactions",
    guide: `# eosio.msig — Multisig Contract Guide

## Workflow
1. propose — Create a proposal with the transaction and required approvals
2. approve — Each required signer approves
3. exec — Anyone executes once all approvals are collected
4. (optional) cancel — Proposer can cancel anytime before execution

## propose — Create a multisig proposal
- account: "eosio.msig"
- action: "propose"
- data:
  - proposer: (account creating the proposal)
  - proposal_name: (unique name, up to 12 chars, a-z1-5)
  - requested: [{ actor: "account1", permission: "active" }, { actor: "account2", permission: "active" }]
  - trx: {
      expiration: "2025-12-31T23:59:59" (must be in the future),
      ref_block_num: 0,
      ref_block_prefix: 0,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      actions: [{ account: "eosio.token", name: "transfer", authorization: [...], data: "..." }]
    }
- NOTE: The "data" field in actions must be hex-encoded. Use the chain's /v1/chain/abi_json_to_bin endpoint to convert JSON action data to hex.

## approve — Approve a proposal
- account: "eosio.msig"
- action: "approve"
- data:
  - proposer: (who created the proposal)
  - proposal_name: (name of the proposal)
  - level: { actor: "myaccount", permission: "active" }

## exec — Execute an approved proposal
- account: "eosio.msig"
- action: "exec"
- data:
  - proposer: (who created the proposal)
  - proposal_name: (name of the proposal)
  - executer: (account paying for execution CPU/NET)

## cancel — Cancel a proposal
- account: "eosio.msig"
- action: "cancel"
- data:
  - proposer: (must be the original proposer)
  - proposal_name: (name)
  - canceler: (must be proposer)

## Querying Proposals
- Table: code="eosio.msig", table="proposal", scope=<proposer> → list proposals
- Table: code="eosio.msig", table="approvals2", scope=<proposer> → see who approved`,
  },

  {
    contract: "atomicassets",
    chains: ["wax", "eos"],
    summary: "NFT standard: create collections, schemas, templates, mint and transfer NFTs",
    guide: `# atomicassets — NFT Contract Guide

## Key Concepts
- Collection: top-level grouping (e.g. a game or brand)
- Schema: defines attribute types within a collection
- Template: a blueprint with fixed attributes (immutable data)
- Asset: an individual NFT minted from a template

## Transfer NFTs

### transfer — Send NFTs
- account: "atomicassets"
- action: "transfer"
- data:
  - from: (sender)
  - to: (receiver)
  - asset_ids: ["1099512345678"] (array of asset ID strings)
  - memo: "" (string)
- NOTE: asset_ids are large numbers passed as strings.

## Create a Collection

### createcol — Create collection
- account: "atomicassets"
- action: "createcol"
- data:
  - author: (creator account)
  - collection_name: (up to 12 chars)
  - allow_notify: true
  - authorized_accounts: ["author_account"]
  - notify_accounts: []
  - market_fee: 0.05 (5% marketplace fee, decimal)
  - data: [] (serialized collection metadata)

## Create a Schema

### createschema
- account: "atomicassets"
- action: "createschema"
- data:
  - authorized_creator: (must be in collection's authorized_accounts)
  - collection_name: (existing collection)
  - schema_name: (up to 12 chars)
  - schema_format: [{ name: "name", type: "string" }, { name: "img", type: "image" }, { name: "rarity", type: "string" }]

## Mint an NFT

### mintasset
- account: "atomicassets"
- action: "mintasset"
- data:
  - authorized_minter: (must be in authorized_accounts)
  - collection_name: (collection)
  - schema_name: (schema)
  - template_id: 12345 (or -1 for no template)
  - new_asset_owner: (account receiving the NFT)
  - immutable_data: [{ key: "name", value: ["string", "My NFT"] }]
  - mutable_data: []
  - tokens_to_back: []

## Querying NFTs
- Table: code="atomicassets", table="assets", scope=<owner_account> → list owned NFTs
- Table: code="atomicassets", table="collections", scope="atomicassets" → list collections
- Table: code="atomicassets", table="schemas", scope=<collection_name> → list schemas
- Table: code="atomicassets", table="templates", scope=<collection_name> → list templates`,
  },

  {
    contract: "telos.decide",
    chains: ["telos"],
    summary: "Telos governance: create ballots, register voters, cast votes",
    guide: `# telos.decide — Telos Governance Contract Guide

## Key Concepts
- Treasury: a token-based voting group
- Ballot: a proposal/poll that treasury members vote on
- Voter: must register with a treasury before voting

## Register as Voter

### regvoter — Register for a treasury
- account: "telos.decide"
- action: "regvoter"
- data:
  - voter: (account registering)
  - treasury_symbol: "4,VOTE" (precision + symbol of the treasury)
  - referrer: null (optional referrer account)

## Cast a Vote

### castvote — Vote on a ballot
- account: "telos.decide"
- action: "castvote"
- data:
  - voter: (registered voter account)
  - ballot_name: (name of the ballot)
  - options: ["yes"] (array of option names — usually "yes", "no", "abstain")

## Create a Ballot

### newballot — Create a new ballot
- account: "telos.decide"
- action: "newballot"
- data:
  - ballot_name: (unique name, up to 12 chars)
  - category: "proposal" (or "election", "poll", etc.)
  - publisher: (creator account)
  - treasury_symbol: "4,VOTE"
  - voting_method: "1token1vote" (or "1acct1vote", "quadratic")
  - initial_options: ["yes", "no", "abstain"]

### openvoting — Open ballot for voting
- account: "telos.decide"
- action: "openvoting"
- data:
  - ballot_name: (ballot to open)
  - end_time: "2025-12-31T23:59:59" (ISO 8601)

### closevoting — Close voting
- account: "telos.decide"
- action: "closevoting"
- data:
  - ballot_name: (ballot to close)
  - broadcast: true (whether to broadcast results)

## Querying
- Table: code="telos.decide", table="ballots", scope="telos.decide" → list ballots
- Table: code="telos.decide", table="voters", scope=<treasury_symbol> → list voters
- Table: code="telos.decide", table="treasuries", scope="telos.decide" → list treasuries`,
  },

  {
    contract: "dgoods",
    chains: ["eos", "wax", "telos"],
    summary: "dGoods NFT standard: create, issue, transfer, and burn digital goods",
    guide: `# dGoods — Digital Goods / NFT Standard

## Transfer

### transfernft — Send an NFT
- account: (dgoods contract account)
- action: "transfernft"
- data:
  - from: (sender)
  - to: (receiver)
  - dgood_ids: [1, 2, 3] (array of dGood IDs — numbers, not strings)
  - memo: ""

## Create Token Category

### create — Define a new token category
- account: (dgoods contract)
- action: "create"
- data:
  - issuer: (account)
  - category: "art" (category name)
  - token_name: "mypiece" (token name within category)
  - fungible: false (true for fungible, false for NFT)
  - burnable: true
  - transferable: true
  - max_supply: "100 MYTOKEN" (for fungible) or "0 MYTOKEN" (0 = unlimited for NFTs)

## Issue / Mint

### issue — Mint NFTs or fungible tokens
- account: (dgoods contract)
- action: "issue"
- data:
  - to: (receiver)
  - category: "art"
  - token_name: "mypiece"
  - quantity: "1 MYTOKEN" (for fungible) or "1" (for NFT, mints 1 copy)
  - relative_uri: "https://..." (metadata URI)
  - memo: ""`,
  },

  {
    contract: "res.pink",
    chains: ["wax"],
    summary: "WAX resource helper: powerup CPU/NET on WAX network",
    guide: `# res.pink — WAX Resource Powerup

## noop — Free CPU/NET powerup
On WAX, the res.pink contract provides free CPU/NET for basic transactions.
- account: "res.pink"
- action: "noop"
- data: {} (no parameters needed)
- NOTE: Add this as the FIRST action in your transaction. It pays for CPU/NET for the remaining actions. Many WAX transactions include this action.

## boost — Boost resources for heavy transactions
- account: "boost.wax"
- action: "noop"
- data: {}
- NOTE: Alternative/additional free resource provider on WAX.`,
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Find a guide by contract name, optionally filtered by chain.
 * Chain matching: guide applies if chains includes "*" or includes
 * a chain name that is a substring of the provided chain hint
 * (e.g. chain="eos" matches "EOS Mainnet").
 */
export function getContractGuide(contract: string, chainHint?: string): ContractGuide | null {
  const lower = contract.toLowerCase()
  const chainLower = chainHint?.toLowerCase() || ""

  for (const g of GUIDES) {
    if (g.contract.toLowerCase() !== lower) continue
    // Check chain match
    if (g.chains.includes("*")) return g
    if (chainLower && g.chains.some((c) => chainLower.includes(c) || c.includes(chainLower))) return g
    if (!chainLower) return g // no chain filter, return first match
  }
  return null
}

/**
 * List all available guides, optionally filtered by chain.
 */
export function listAvailableGuides(chainHint?: string): { contract: string; summary: string }[] {
  const chainLower = chainHint?.toLowerCase() || ""
  return GUIDES
    .filter((g) => {
      if (g.chains.includes("*")) return true
      if (!chainLower) return true
      return g.chains.some((c) => chainLower.includes(c) || c.includes(chainLower))
    })
    .map((g) => ({ contract: g.contract, summary: g.summary }))
}
