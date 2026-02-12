import { creditDeposit } from "@/lib/billing/credits"
import { getAppConfig } from "@/lib/config"

const TOKENS_PER_TLOS = 250000

export async function POST(req: Request) {
  const body = await req.json()
  const { transactionId, chainId, accountName } = body

  if (!transactionId) {
    return Response.json({ error: "transactionId is required" }, { status: 400 })
  }
  if (!chainId || !accountName) {
    return Response.json({ error: "chainId and accountName are required" }, { status: 400 })
  }

  // Verify transaction on Telos mainnet via Hyperion
  const hyperionUrl = `https://mainnet.telos.net/v2/history/get_transaction?id=${transactionId}`
  let txData
  try {
    const resp = await fetch(hyperionUrl)
    if (!resp.ok) {
      return Response.json({ error: "Transaction not found on chain" }, { status: 404 })
    }
    txData = await resp.json()
  } catch {
    return Response.json({ error: "Failed to verify transaction on chain" }, { status: 502 })
  }

  // Find eosio.token::transfer action to our wallet
  const appWallet = await getAppConfig("app_wallet_account")
  if (!appWallet) {
    return Response.json({ error: "App wallet not configured" }, { status: 500 })
  }

  const actions = txData.actions || []
  const transferAction = actions.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) =>
      a.act?.account === "eosio.token" &&
      a.act?.name === "transfer" &&
      a.act?.data?.to === appWallet
  )

  if (!transferAction) {
    return Response.json({ error: "No transfer to app wallet found in transaction" }, { status: 400 })
  }

  const { quantity } = transferAction.act.data

  // Parse quantity (e.g., "1.0000 TLOS")
  const parts = quantity.split(" ")
  if (parts.length !== 2 || parts[1] !== "TLOS") {
    return Response.json({ error: "Invalid token — expected TLOS" }, { status: 400 })
  }

  const tlosAmount = parseFloat(parts[0])
  if (isNaN(tlosAmount) || tlosAmount <= 0) {
    return Response.json({ error: "Invalid transfer amount" }, { status: 400 })
  }

  // Credit the deposit to the specified chain+account
  try {
    const { newBalance } = await creditDeposit(chainId, accountName, tlosAmount, transactionId)
    return Response.json({
      success: true,
      tlos_amount: tlosAmount,
      tokens_credited: Math.floor(tlosAmount * TOKENS_PER_TLOS),
      new_balance: newBalance,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to credit deposit"
    return Response.json({ error: message }, { status: 409 })
  }
}
