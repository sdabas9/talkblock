import { createAdminClient } from "@/lib/supabase/server"

const FREE_REQUESTS_PER_DAY = 5
const TOKENS_PER_TLOS = 250000

interface UsageAllowance {
  allowed: boolean
  reason?: string
  mode: "free" | "paid"
  freeRemaining?: number
  balanceTokens?: number
}

export async function checkUsageAllowance(chainId: string, accountName: string): Promise<UsageAllowance> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  // Check today's usage by chain+account
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("request_count")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .eq("date", today)
    .single()

  const requestCount = usage?.request_count ?? 0

  if (requestCount < FREE_REQUESTS_PER_DAY) {
    return {
      allowed: true,
      mode: "free",
      freeRemaining: FREE_REQUESTS_PER_DAY - requestCount,
    }
  }

  // Free tier exhausted — check paid balance
  const { data: balance } = await supabase
    .from("credit_balances")
    .select("balance_tokens")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .single()

  const balanceTokens = balance?.balance_tokens ?? 0

  if (balanceTokens > 0) {
    return {
      allowed: true,
      mode: "paid",
      freeRemaining: 0,
      balanceTokens,
    }
  }

  return {
    allowed: false,
    reason: "Free requests exhausted and no credit balance. Purchase credits to continue.",
    mode: "paid",
    freeRemaining: 0,
    balanceTokens: 0,
  }
}

export async function recordUsage(
  chainId: string,
  accountName: string,
  mode: "free" | "paid",
  inputTokens: number,
  outputTokens: number,
  model: string
) {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]
  const totalTokens = inputTokens + outputTokens

  // Always upsert daily_usage
  const { data: existing } = await supabase
    .from("daily_usage")
    .select("id, request_count, total_input_tokens, total_output_tokens")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .eq("date", today)
    .single()

  if (existing) {
    await supabase
      .from("daily_usage")
      .update({
        request_count: existing.request_count + 1,
        total_input_tokens: (existing.total_input_tokens ?? 0) + inputTokens,
        total_output_tokens: (existing.total_output_tokens ?? 0) + outputTokens,
      })
      .eq("id", existing.id)
  } else {
    await supabase.from("daily_usage").insert({
      chain_id: chainId,
      account_name: accountName,
      date: today,
      request_count: 1,
      total_input_tokens: inputTokens,
      total_output_tokens: outputTokens,
    })
  }

  // If paid mode, deduct from balance and log transaction
  if (mode === "paid") {
    const { data: balance } = await supabase
      .from("credit_balances")
      .select("balance_tokens")
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
      .single()

    const currentBalance = balance?.balance_tokens ?? 0
    const newBalance = Math.max(0, currentBalance - totalTokens)

    await supabase
      .from("credit_balances")
      .update({ balance_tokens: newBalance, updated_at: new Date().toISOString() })
      .eq("chain_id", chainId)
      .eq("account_name", accountName)

    await supabase.from("credit_transactions").insert({
      chain_id: chainId,
      account_name: accountName,
      type: "usage",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      model,
      token_units_delta: -totalTokens,
      balance_after: newBalance,
    })
  }
}

export async function creditDeposit(
  chainId: string,
  accountName: string,
  tlosAmount: number,
  txHash: string
): Promise<{ newBalance: number }> {
  const supabase = createAdminClient()

  // Check for duplicate tx_hash
  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("tx_hash", txHash)
    .single()

  if (existingTx) {
    throw new Error("Transaction already processed")
  }

  const tokenUnits = Math.floor(tlosAmount * TOKENS_PER_TLOS)

  // Upsert credit_balances
  const { data: existing } = await supabase
    .from("credit_balances")
    .select("balance_tokens, total_deposited_tlos")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .single()

  let newBalance: number

  if (existing) {
    newBalance = (existing.balance_tokens ?? 0) + tokenUnits
    await supabase
      .from("credit_balances")
      .update({
        balance_tokens: newBalance,
        total_deposited_tlos: (existing.total_deposited_tlos ?? 0) + tlosAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
  } else {
    newBalance = tokenUnits
    await supabase.from("credit_balances").insert({
      chain_id: chainId,
      account_name: accountName,
      balance_tokens: newBalance,
      total_deposited_tlos: tlosAmount,
    })
  }

  // Insert transaction record
  await supabase.from("credit_transactions").insert({
    chain_id: chainId,
    account_name: accountName,
    type: "deposit",
    tlos_amount: tlosAmount,
    tx_hash: txHash,
    token_units_delta: tokenUnits,
    balance_after: newBalance,
  })

  return { newBalance }
}
