export interface ChainInfo {
  chain_id: string
  head_block_num: number
  head_block_producer: string
  server_version_string: string
}

export interface AccountInfo {
  account_name: string
  core_liquid_balance?: string
  ram_quota: number
  ram_usage: number
  cpu_limit: { used: number; available: number; max: number }
  net_limit: { used: number; available: number; max: number }
  cpu_weight: number
  net_weight: number
  permissions: Array<{
    perm_name: string
    parent: string
    required_auth: {
      threshold: number
      keys: Array<{ key: string; weight: number }>
      accounts: Array<{ permission: { actor: string; permission: string }; weight: number }>
    }
  }>
  total_resources?: {
    cpu_weight: string
    net_weight: string
    ram_bytes: number
  }
  voter_info?: {
    producers: string[]
    staked: number
  }
}

export class AntelopeClient {
  constructor(private endpoint: string) {}

  private async rpc(path: string, body?: object) {
    const res = await fetch(`${this.endpoint}/v1/chain/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `RPC error: ${res.status}`)
    }
    return res.json()
  }

  async getInfo(): Promise<ChainInfo> {
    return this.rpc("get_info")
  }

  async getAccount(accountName: string): Promise<AccountInfo> {
    return this.rpc("get_account", { account_name: accountName })
  }

  async getBlock(blockNumOrId: string | number) {
    return this.rpc("get_block", { block_num_or_id: blockNumOrId })
  }

  async getTransaction(id: string) {
    const res = await fetch(`${this.endpoint}/v1/history/get_transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `RPC error: ${res.status}`)
    }
    return res.json()
  }

  async getTableRows(params: {
    code: string
    table: string
    scope: string
    limit?: number
    lower_bound?: string
    upper_bound?: string
    key_type?: string
    index_position?: string
    reverse?: boolean
    json?: boolean
  }) {
    return this.rpc("get_table_rows", { json: true, limit: 10, ...params })
  }

  async getAbi(accountName: string) {
    return this.rpc("get_abi", { account_name: accountName })
  }

  async getCurrencyBalance(code: string, account: string, symbol?: string) {
    return this.rpc("get_currency_balance", { code, account, symbol })
  }

  async getProducers(limit = 21, lowerBound = "") {
    return this.rpc("get_producers", {
      json: true,
      limit,
      lower_bound: lowerBound,
    })
  }
}
