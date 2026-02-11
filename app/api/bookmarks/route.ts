import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

function getUserId(req: Request): string | null {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
    return decoded.sub
  } catch { return null }
}

export async function GET(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) return Response.json({ error: "Failed to fetch bookmarks" }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: userId,
      tool_name: body.toolName,
      label: body.label,
      result: body.result,
      chain_name: body.chainName || null,
      chain_endpoint: body.chainEndpoint || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: "Failed to create bookmark" }, { status: 500 })
  return Response.json(data)
}
