import { createAdminClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/check"

const FREE_REQUESTS_PER_DAY = 6
const CREDITS_PER_TLOS = 250

interface UsageAllowance {
  allowed: boolean
  reason?: string
  mode: "free" | "paid"
  freeRemaining?: number
  balanceTokens?: number
}

export async function checkUsageAllowance(chainId: string, accountName: string): Promise<UsageAllowance> {
  if (!isSupabaseConfigured()) {
    return { allowed: false, reason: "Supabase not configured. Use BYOK mode.", mode: "free" }
  }

  const supabase = createAdminClient()!
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

export type UsageKind = "chat" | "cosign"

export async function recordUsage(
  chainId: string,
  accountName: string,
  mode: "free" | "paid",
  credits: number,
  kind: UsageKind,
  model?: string,
) {
  if (!isSupabaseConfigured()) return

  const supabase = createAdminClient()!
  const today = new Date().toISOString().split("T")[0]

  const { data: existing } = await supabase
    .from("daily_usage")
    .select("id, request_count")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .eq("date", today)
    .single()

  if (existing) {
    await supabase
      .from("daily_usage")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id)
  } else {
    await supabase.from("daily_usage").insert({
      chain_id: chainId,
      account_name: accountName,
      date: today,
      request_count: 1,
    })
  }

  if (mode === "paid") {
    const { data: balance } = await supabase
      .from("credit_balances")
      .select("balance_tokens")
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
      .single()

    const currentBalance = balance?.balance_tokens ?? 0
    const newBalance = Math.max(0, currentBalance - credits)

    await supabase
      .from("credit_balances")
      .update({ balance_tokens: newBalance, updated_at: new Date().toISOString() })
      .eq("chain_id", chainId)
      .eq("account_name", accountName)

    await supabase.from("credit_transactions").insert({
      chain_id: chainId,
      account_name: accountName,
      type: "usage",
      total_tokens: credits,
      model: model ?? kind,
      token_units_delta: -credits,
      balance_after: newBalance,
    })
  }
}

/**
 * Apply a deposit. Symbol-agnostic: caller computes the credits count from
 * the deposited amount and the per-symbol rate (see app_config.credits_per_*).
 *
 * `paymentAmount` is the raw token amount (e.g. 1.0 for "1.0000 A") — stored
 * in credit_transactions.tlos_amount for audit (the column name is legacy from
 * the TLOS-only era; values are now per-symbol). `paymentSymbol` is the token
 * ticker (TLOS, A, EOS) — stored in credit_transactions.model so `credits` row
 * displays show what was paid.
 */
export async function creditDeposit(
  chainId: string,
  accountName: string,
  credits: number,
  txHash: string,
  paymentAmount: number,
  paymentSymbol: string,
): Promise<{ newBalance: number }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured. Credit deposits are unavailable.")
  }

  const supabase = createAdminClient()!

  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("tx_hash", txHash)
    .single()

  if (existingTx) {
    throw new Error("Transaction already processed")
  }

  const { data: existing } = await supabase
    .from("credit_balances")
    .select("balance_tokens, total_deposited_tlos")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .single()

  let newBalance: number

  if (existing) {
    newBalance = (existing.balance_tokens ?? 0) + credits
    await supabase
      .from("credit_balances")
      .update({
        balance_tokens: newBalance,
        total_deposited_tlos: (existing.total_deposited_tlos ?? 0) + paymentAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
  } else {
    newBalance = credits
    await supabase.from("credit_balances").insert({
      chain_id: chainId,
      account_name: accountName,
      balance_tokens: newBalance,
      total_deposited_tlos: paymentAmount,
    })
  }

  await supabase.from("credit_transactions").insert({
    chain_id: chainId,
    account_name: accountName,
    type: "deposit",
    tlos_amount: paymentAmount,
    tx_hash: txHash,
    token_units_delta: credits,
    balance_after: newBalance,
    model: paymentSymbol,
  })

  return { newBalance }
}
