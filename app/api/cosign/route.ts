import { createAdminClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/check"
import { checkUsageAllowance, recordUsage } from "@/lib/billing/credits"
import { buildAndSignCosign, type ActionInput } from "@/lib/cosigner/sign"
import jwt from "jsonwebtoken"

const VAULTA_CHAIN_ID = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906"

function getUserId(req: Request): string | null {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
    return decoded.sub
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return Response.json({ error: "Auth unavailable" }, { status: 503 })

  let body: { chainId?: unknown; actions?: unknown; expireSeconds?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.chainId !== VAULTA_CHAIN_ID) {
    return Response.json({ error: "Cosigner only supports Vaulta" }, { status: 403 })
  }

  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return Response.json({ error: "actions[] required" }, { status: 400 })
  }

  const actions = body.actions as ActionInput[]
  const cosignAccount = process.env.COSIGN_ACCOUNT
  for (const a of actions) {
    if (!a.account || !a.name || !Array.isArray(a.authorization) || typeof a.data !== "object") {
      return Response.json({ error: "Malformed action" }, { status: 400 })
    }
    if (a.account === cosignAccount) {
      return Response.json({ error: "Actions cannot target the sponsor account" }, { status: 400 })
    }
  }

  const expire = Math.min(300, Math.max(60, Number(body.expireSeconds) || 300))

  const supabase = createAdminClient()!
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_name, chain_id")
    .eq("id", userId)
    .single()

  if (!profile) return Response.json({ error: "Profile not found" }, { status: 401 })
  if (profile.chain_id !== body.chainId) {
    return Response.json({ error: "User is on a different chain" }, { status: 403 })
  }

  const allowance = await checkUsageAllowance(profile.chain_id, profile.account_name)
  if (!allowance.allowed) {
    return Response.json({ error: allowance.reason || "Out of credits" }, { status: 402 })
  }

  let signed
  try {
    signed = await buildAndSignCosign(actions, expire)
  } catch (e) {
    console.error("[cosign] sign failed:", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Sign failed" },
      { status: 500 },
    )
  }

  await recordUsage(profile.chain_id, profile.account_name, allowance.mode, 1, "cosign")

  return Response.json({
    packed_trx: signed.packed_trx,
    signatures: signed.signatures,
    transaction: signed.transaction,
    creditsRemaining: Math.max(0, (allowance.balanceTokens ?? 0) - (allowance.mode === "paid" ? 1 : 0)),
    freeRemaining: Math.max(0, (allowance.freeRemaining ?? 0) - (allowance.mode === "free" ? 1 : 0)),
  })
}
