import { NextRequest, NextResponse } from "next/server"
import { AntelopeClient } from "@/lib/antelope/client"
import { HyperionClient } from "@/lib/antelope/hyperion"

export async function POST(req: NextRequest) {
  const { type, id, endpoint, hyperionEndpoint } = await req.json()

  if (!endpoint || !id || !type) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  try {
    if (type === "account") {
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

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 },
    )
  }
}
