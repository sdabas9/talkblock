import { createAdminClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/check"
import { checkUsageAllowance, recordUsage } from "@/lib/billing/credits"
import { cosignClientTx, fetchVaultaInfo } from "@/lib/cosigner/sign"
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

// GET /api/cosign — return TAPOS + the noop action template the client should
// prepend to its actions list. Used by the client to build the canonical tx
// before sending it back via POST for the cosign signature.
export async function GET(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return Response.json({ error: "Auth unavailable" }, { status: 503 })

  const cosignAccount = process.env.COSIGN_ACCOUNT
  const cosignPermission = process.env.COSIGN_PERMISSION
  const noopContract = process.env.NOOP_CONTRACT
  if (!cosignAccount || !cosignPermission || !noopContract) {
    return Response.json({ error: "Cosigner not configured" }, { status: 500 })
  }

  try {
    const info = await fetchVaultaInfo()
    return Response.json({
      noop: {
        account: noopContract,
        name: "noop",
        authorization: [{ actor: cosignAccount, permission: cosignPermission }],
        data: { memo: `tlbk-${Date.now()}` },
      },
      chainId: String(info.chain_id),
    })
  } catch (e) {
    console.error("[cosign] info fetch failed:", e)
    return Response.json({ error: "Failed to fetch chain info" }, { status: 500 })
  }
}

// POST /api/cosign — sign the digest of a client-built packed transaction with
// the cosign key. The client owns serialization (so its wallet signature stays
// valid against the same bytes). Server validates the embedded noop matches the
// cosign permission and adds a second signature.
export async function POST(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return Response.json({ error: "Auth unavailable" }, { status: 503 })

  let body: { chainId?: unknown; packed_trx?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.chainId !== VAULTA_CHAIN_ID) {
    return Response.json({ error: "Cosigner only supports Vaulta" }, { status: 403 })
  }

  if (typeof body.packed_trx !== "string" || body.packed_trx.length === 0) {
    return Response.json({ error: "packed_trx (hex string) required" }, { status: 400 })
  }

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

  let result
  try {
    result = await cosignClientTx(body.packed_trx, body.chainId as string)
  } catch (e) {
    console.error("[cosign] sign failed:", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Sign failed" },
      { status: 400 },
    )
  }

  await recordUsage(profile.chain_id, profile.account_name, allowance.mode, 1, "cosign")

  return Response.json({
    signature: result.signature,
    creditsRemaining: Math.max(0, (allowance.balanceTokens ?? 0) - (allowance.mode === "paid" ? 1 : 0)),
    freeRemaining: Math.max(0, (allowance.freeRemaining ?? 0) - (allowance.mode === "free" ? 1 : 0)),
  })
}
