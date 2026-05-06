import { creditDeposit } from "@/lib/billing/credits"
import { getAppConfig } from "@/lib/config"

interface PaymentChainConfig {
  hyperionUrl: string
  // Map (token contract, symbol) → app_config key holding the credits-per-unit rate
  acceptedTokens: Array<{ contract: string; symbol: string; rateKey: string }>
}

const PAYMENT_CHAINS: Record<"telos" | "vaulta", PaymentChainConfig> = {
  telos: {
    hyperionUrl: "https://mainnet.telos.net",
    acceptedTokens: [
      { contract: "eosio.token", symbol: "TLOS", rateKey: "credits_per_tlos" },
    ],
  },
  vaulta: {
    hyperionUrl: "https://eos.hyperion.eosrio.io",
    acceptedTokens: [
      { contract: "core.vaulta", symbol: "A", rateKey: "credits_per_a" },
      { contract: "eosio.token", symbol: "EOS", rateKey: "credits_per_eos" },
    ],
  },
}

export async function POST(req: Request) {
  const body = await req.json()
  const { transactionId, chainId, accountName, paymentChain } = body

  if (!transactionId) {
    return Response.json({ error: "transactionId is required" }, { status: 400 })
  }
  if (!chainId || !accountName) {
    return Response.json({ error: "chainId and accountName are required" }, { status: 400 })
  }

  // Default to "telos" for backwards-compat with older clients that don't send paymentChain.
  const chainKey: "telos" | "vaulta" = paymentChain === "vaulta" ? "vaulta" : "telos"
  const cfg = PAYMENT_CHAINS[chainKey]

  let txData
  try {
    const resp = await fetch(`${cfg.hyperionUrl}/v2/history/get_transaction?id=${transactionId}`)
    if (!resp.ok) {
      return Response.json({ error: "Transaction not found on chain" }, { status: 404 })
    }
    txData = await resp.json()
  } catch {
    return Response.json({ error: "Failed to verify transaction on chain" }, { status: 502 })
  }

  const appWallet = await getAppConfig("app_wallet_account")
  if (!appWallet) {
    return Response.json({ error: "App wallet not configured" }, { status: 500 })
  }

  // Find the first transfer action to our wallet whose (account, symbol) is in the accepted set.
  const actions = txData.actions || []
  let match: { token: typeof cfg.acceptedTokens[number]; amount: number } | null = null
  for (const a of actions) {
    if (a.act?.name !== "transfer") continue
    if (a.act?.data?.to !== appWallet) continue
    const contract = a.act?.account
    const quantity = String(a.act?.data?.quantity || "")
    const [amountStr, symbol] = quantity.split(" ")
    const token = cfg.acceptedTokens.find((t) => t.contract === contract && t.symbol === symbol)
    if (!token) continue
    const amount = parseFloat(amountStr)
    if (isNaN(amount) || amount <= 0) continue
    match = { token, amount }
    break
  }

  if (!match) {
    const accepted = cfg.acceptedTokens.map((t) => `${t.symbol} (${t.contract})`).join(", ")
    return Response.json(
      { error: `No accepted transfer to ${appWallet} found in transaction. Accepted on ${chainKey}: ${accepted}` },
      { status: 400 },
    )
  }

  // Look up the per-symbol credit rate from app_config.
  const rateStr = await getAppConfig(match.token.rateKey)
  const rate = rateStr ? parseFloat(rateStr) : null
  if (!rate || !isFinite(rate) || rate <= 0) {
    return Response.json({ error: `No credit rate configured for ${match.token.symbol}` }, { status: 500 })
  }
  const credits = Math.floor(match.amount * rate)

  try {
    const { newBalance } = await creditDeposit(
      chainId,
      accountName,
      credits,
      transactionId,
      match.amount,
      match.token.symbol,
    )
    return Response.json({
      success: true,
      payment_chain: chainKey,
      payment_amount: match.amount,
      payment_symbol: match.token.symbol,
      credits_credited: credits,
      new_balance: newBalance,
      // legacy field names kept for older clients
      tlos_amount: match.amount,
      tokens_credited: credits,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to credit deposit"
    return Response.json({ error: message }, { status: 409 })
  }
}
