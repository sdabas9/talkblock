import { NextRequest, NextResponse } from "next/server"
import { AntelopeClient } from "@/lib/antelope/client"
import { HyperionClient } from "@/lib/antelope/hyperion"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, id, endpoint, hyperionEndpoint } = body

  if (!endpoint || !type) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  try {
    if (type === "account") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const client = new AntelopeClient(endpoint)
      const account = await client.getAccount(id)
      return NextResponse.json({
        account_name: account.account_name,
        balance: account.core_liquid_balance || "0",
        ram: { used: account.ram_usage, quota: account.ram_quota },
        cpu: account.cpu_limit,
        net: account.net_limit,
        cpu_staked: account.total_resources?.cpu_weight || "0",
        net_staked: account.total_resources?.net_weight || "0",
        permissions: account.permissions?.map((p: Record<string, any>) => ({
          name: p.perm_name,
          parent: p.parent,
          threshold: p.required_auth.threshold,
          keys: p.required_auth.keys,
          accounts: p.required_auth.accounts,
        })),
        voter_info: account.voter_info || null,
      })
    }

    if (type === "transaction") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      if (hyperionEndpoint) {
        const h = new HyperionClient(hyperionEndpoint)
        const result = await h.getTransaction(id)
        const firstAction = (result.actions || [])[0] as Record<string, any> | undefined
        return NextResponse.json({
          id: result.trx_id || id,
          block_num: result.block_num ?? firstAction?.block_num,
          block_time: result.block_time ?? firstAction?.["@timestamp"],
          actions: result.actions || [],
          executed: result.executed,
        })
      } else {
        const client = new AntelopeClient(endpoint)
        const tx = await client.getTransaction(id)
        return NextResponse.json({
          id: tx.id,
          block_num: tx.block_num,
          block_time: tx.block_time,
          actions: tx.trx?.trx?.actions || [],
          status: tx.trx?.receipt?.status,
        })
      }
    }

    if (type === "abi") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const client = new AntelopeClient(endpoint)
      const result = await client.getAbi(id)
      return NextResponse.json({ abi: result.abi || null })
    }

    if (type === "block") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const client = new AntelopeClient(endpoint)
      const block = await client.getBlock(id)
      return NextResponse.json({
        block_num: block.block_num,
        id: block.id,
        timestamp: block.timestamp,
        producer: block.producer,
        confirmed: block.confirmed,
        transaction_count: block.transactions?.length ?? 0,
        transactions: (block.transactions ?? []).slice(0, 50).map((tx: any) => ({
          id: typeof tx.trx === "string" ? tx.trx : tx.trx?.id || tx.id || "",
          status: tx.status,
          cpu_usage_us: tx.cpu_usage_us,
          net_usage_words: tx.net_usage_words,
          actions: typeof tx.trx === "object" ? (tx.trx?.transaction?.actions ?? tx.trx?.trx?.actions ?? []).map((a: any) => ({
            account: a.account,
            name: a.name,
          })) : [],
        })),
      })
    }

    if (type === "table") {
      const { code, table, scope, limit, lower_bound, upper_bound, reverse } = body
      if (!code || !table) {
        return NextResponse.json({ error: "Missing code or table" }, { status: 400 })
      }
      const client = new AntelopeClient(endpoint)
      const result = await client.getTableRows({
        code,
        table,
        scope: scope || code,
        limit: limit || 100,
        ...(lower_bound ? { lower_bound } : {}),
        ...(upper_bound ? { upper_bound } : {}),
        ...(reverse ? { reverse: true } : {}),
      })
      return NextResponse.json({
        code,
        table,
        scope: scope || code,
        rows: result.rows || [],
        more: result.more ?? false,
      })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 },
    )
  }
}
