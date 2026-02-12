import { AntelopeClient } from "./client"
import { HyperionClient } from "./hyperion"

export function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Tools that can be refreshed (excludes static/non-refreshable ones)
export const REFRESHABLE_TOOLS = new Set([
  "get_account", "get_block", "get_tokens", "get_currency_balance",
  "get_producers", "get_abi", "get_table_rows",
  "get_actions", "get_transfers", "get_created_accounts", "get_creator", "get_key_accounts",
])

/**
 * Re-execute a tool's API call using the stored result to derive query params.
 */
export async function refetchToolData(
  toolName: string,
  result: Record<string, any>,
  chainEndpoint: string,
  hyperionEndpoint: string | null
): Promise<Record<string, any>> {
  const client = new AntelopeClient(chainEndpoint)

  switch (toolName) {
    case "get_account": {
      const account = await client.getAccount(result.account_name)
      return {
        account_name: account.account_name,
        balance: account.core_liquid_balance || "0",
        ram: { used: account.ram_usage, quota: account.ram_quota },
        cpu: account.cpu_limit,
        net: account.net_limit,
        cpu_staked: account.total_resources?.cpu_weight || "0",
        net_staked: account.total_resources?.net_weight || "0",
        permissions: account.permissions.map((p: any) => ({
          name: p.perm_name,
          parent: p.parent,
          threshold: p.required_auth.threshold,
          keys: p.required_auth.keys,
          accounts: p.required_auth.accounts,
        })),
        voter_info: account.voter_info || null,
      }
    }
    case "get_block": {
      const block = await client.getBlock(result.block_num)
      return {
        block_num: block.block_num,
        id: block.id,
        timestamp: block.timestamp,
        producer: block.producer,
        confirmed: block.confirmed,
        transaction_count: block.transactions?.length || 0,
        transactions: (block.transactions || []).slice(0, 10).map((tx: any) => ({
          id: typeof tx.trx === "string" ? tx.trx : tx.trx?.id,
          status: tx.status,
          cpu_usage_us: tx.cpu_usage_us,
          net_usage_words: tx.net_usage_words,
        })),
      }
    }
    case "get_currency_balance": {
      const balances = await client.getCurrencyBalance(
        result.code || "eosio.token",
        result.account
      )
      return { account: result.account, balances }
    }
    case "get_producers": {
      const res = await client.getProducers(result.producers?.length || 21)
      return {
        producers: res.rows.map((p: any) => ({
          owner: p.owner, total_votes: p.total_votes,
          url: p.url, is_active: p.is_active, unpaid_blocks: p.unpaid_blocks,
        })),
        total_producer_vote_weight: res.total_producer_vote_weight,
      }
    }
    case "get_abi": {
      const res = await client.getAbi(result.account_name)
      const abi = res.abi
      if (!abi) return { error: "No ABI found" }
      const actionTypes = new Set(abi.actions?.map((a: any) => a.type) || [])
      return {
        account_name: res.account_name,
        tables: abi.tables?.map((t: any) => t.name) || [],
        actions: abi.actions?.map((a: any) => a.name) || [],
        structs: abi.structs?.filter((s: any) => actionTypes.has(s.name))
          .map((s: any) => ({ name: s.name, fields: s.fields })) || [],
      }
    }
    case "get_table_rows": {
      return await client.getTableRows({
        code: result.code, table: result.table, scope: result.scope,
        limit: result.rows?.length || 10,
      })
    }
    default:
      break
  }

  // Hyperion tools
  if (!hyperionEndpoint) throw new Error("No Hyperion endpoint available")
  const hyperion = new HyperionClient(hyperionEndpoint)

  switch (toolName) {
    case "get_tokens": {
      const res = await hyperion.getTokens(result.account)
      return { tokens: res.tokens || [], account: result.account }
    }
    case "get_actions": {
      const account = result.account || result.actions?.[0]?.actors?.split(",")[0]
      if (!account) throw new Error("Cannot determine account to refresh")
      const res = await hyperion.getActions({
        account,
        limit: result.actions?.length || 10,
        simple: true,
      })
      return {
        actions: res.simple_actions || res.actions || [],
        account,
        total: res.total || { value: 0, relation: "eq" },
      }
    }
    case "get_transfers": {
      const res = await hyperion.getActions({
        account: result.account,
        filter: "eosio.token:transfer",
        limit: result.transfers?.length || 20,
        simple: true,
      })
      const actions = res.simple_actions || res.actions || []
      return {
        transfers: actions.map((a: any) => ({
          timestamp: a.timestamp || a["@timestamp"],
          from: a.data?.from, to: a.data?.to,
          quantity: a.data?.quantity, memo: a.data?.memo,
          contract: a.contract, block: a.block,
        })),
        account: result.account,
      }
    }
    case "get_created_accounts": {
      const res = await hyperion.getCreatedAccounts(result.query_account)
      return { accounts: res.accounts || [], query_account: result.query_account }
    }
    case "get_creator": {
      const res = await hyperion.getCreator(result.account)
      return { account: result.account, creator: res.creator, timestamp: res.timestamp }
    }
    case "get_key_accounts": {
      const res = await hyperion.getKeyAccounts(result.public_key)
      return { account_names: res.account_names || [], public_key: result.public_key }
    }
    default:
      throw new Error(`Refresh not supported for ${toolName}`)
  }
}
