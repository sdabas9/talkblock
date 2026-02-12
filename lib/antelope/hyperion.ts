export class HyperionClient {
  constructor(private endpoint: string) {}

  private async query(path: string, params: Record<string, string | number | boolean | undefined>) {
    const url = new URL(`${this.endpoint}${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    const res = await fetch(url.toString())
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Hyperion error: ${res.status}`)
    }
    return res.json()
  }

  // History endpoints

  async getActions(params: {
    account?: string
    filter?: string
    skip?: number
    limit?: number
    sort?: "asc" | "desc"
    after?: string
    before?: string
    simple?: boolean
  }) {
    return this.query("/v2/history/get_actions", {
      account: params.account,
      filter: params.filter,
      skip: params.skip,
      limit: params.limit,
      sort: params.sort,
      after: params.after,
      before: params.before,
      simple: params.simple,
    })
  }

  async getTransaction(id: string) {
    return this.query("/v2/history/get_transaction", { id })
  }

  async getTransfers(params: {
    from?: string
    to?: string
    symbol?: string
    contract?: string
    skip?: number
    limit?: number
    after?: string
    before?: string
  }) {
    return this.query("/v2/history/get_transfers", {
      from: params.from,
      to: params.to,
      symbol: params.symbol,
      contract: params.contract,
      skip: params.skip,
      limit: params.limit,
      after: params.after,
      before: params.before,
    })
  }

  async getCreatedAccounts(account: string) {
    return this.query("/v2/history/get_created_accounts", { account })
  }

  async getCreator(account: string) {
    return this.query("/v2/history/get_creator", { account })
  }

  async getDeltas(params: {
    code?: string
    scope?: string
    table?: string
    payer?: string
  }) {
    return this.query("/v2/history/get_deltas", {
      code: params.code,
      scope: params.scope,
      table: params.table,
      payer: params.payer,
    })
  }

  async getTransactedAccounts(params: {
    account: string
    direction: "in" | "out" | "both"
    symbol?: string
    contract?: string
    min?: number
    max?: number
    limit?: number
  }) {
    return this.query("/v2/history/get_transacted_accounts", {
      account: params.account,
      direction: params.direction,
      symbol: params.symbol,
      contract: params.contract,
      min: params.min,
      max: params.max,
      limit: params.limit,
    })
  }

  // State endpoints

  async getTokens(account: string) {
    return this.query("/v2/state/get_tokens", { account })
  }

  async getKeyAccounts(publicKey: string) {
    return this.query("/v2/state/get_key_accounts", { public_key: publicKey })
  }

  async getProposals(params: {
    proposer?: string
    account?: string
    executed?: boolean
  }) {
    return this.query("/v2/state/get_proposals", {
      proposer: params.proposer,
      account: params.account,
      executed: params.executed,
    })
  }

  async getVoters(params: {
    producer?: string
    skip?: number
    limit?: number
  }) {
    return this.query("/v2/state/get_voters", {
      producer: params.producer,
      skip: params.skip,
      limit: params.limit,
    })
  }

  // Health

  async getHealth() {
    return this.query("/v2/health", {})
  }
}
