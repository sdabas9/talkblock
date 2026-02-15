import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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

export async function GET(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()!
  const { data, error } = await supabase
    .from("user_settings")
    .select("llm_provider, llm_model, llm_api_key, llm_mode, ui_preferences, preferred_chains")
    .eq("user_id", userId)
    .single()

  if (error) return Response.json({ error: "Settings not found" }, { status: 404 })
  return Response.json({
    llm_provider: data.llm_provider,
    llm_model: data.llm_model,
    llm_mode: data.llm_mode || "builtin",
    has_api_key: !!data.llm_api_key,
    ui_preferences: data.ui_preferences,
    preferred_chains: data.preferred_chains,
  })
}

export async function PUT(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()!

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.llm_provider !== undefined) updateData.llm_provider = body.llm_provider
  if (body.llm_model !== undefined) updateData.llm_model = body.llm_model
  if (body.llm_api_key !== undefined) updateData.llm_api_key = body.llm_api_key
  if (body.llm_mode !== undefined) updateData.llm_mode = body.llm_mode
  if (body.ui_preferences !== undefined) updateData.ui_preferences = body.ui_preferences

  const { error } = await supabase
    .from("user_settings")
    .update(updateData)
    .eq("user_id", userId)

  if (error) return Response.json({ error: "Failed to update settings" }, { status: 500 })
  return Response.json({ success: true })
}
