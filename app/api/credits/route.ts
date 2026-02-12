import { createAdminClient } from "@/lib/supabase/server"
import { getAppConfig } from "@/lib/config"

const FREE_REQUESTS_PER_DAY = 5

export async function GET(req: Request) {
  const url = new URL(req.url)
  const chainId = url.searchParams.get("chainId")
  const accountName = url.searchParams.get("accountName")

  if (!chainId || !accountName) {
    return Response.json({ error: "chainId and accountName are required" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const [balanceResult, usageResult, transactionsResult] = await Promise.all([
    supabase
      .from("credit_balances")
      .select("balance_tokens, total_deposited_tlos")
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
      .single(),
    supabase
      .from("daily_usage")
      .select("request_count, total_input_tokens, total_output_tokens")
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
      .eq("date", today)
      .single(),
    supabase
      .from("credit_transactions")
      .select("type, tlos_amount, tx_hash, input_tokens, output_tokens, total_tokens, model, token_units_delta, balance_after, created_at")
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const balance = balanceResult.data
  const usage = usageResult.data
  const requestCount = usage?.request_count ?? 0

  const appWalletAccount = await getAppConfig("app_wallet_account")

  return Response.json({
    balance_tokens: balance?.balance_tokens ?? 0,
    total_deposited_tlos: balance?.total_deposited_tlos ?? 0,
    today: {
      request_count: requestCount,
      free_remaining: Math.max(0, FREE_REQUESTS_PER_DAY - requestCount),
      total_input_tokens: usage?.total_input_tokens ?? 0,
      total_output_tokens: usage?.total_output_tokens ?? 0,
    },
    recent_transactions: transactionsResult.data ?? [],
    app_wallet_account: appWalletAccount,
  })
}
