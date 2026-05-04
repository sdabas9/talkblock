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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()!

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) return Response.json({ error: "Failed to delete bookmark" }, { status: 500 })
  return Response.json({ success: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let body: { label?: unknown; result?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates: { label?: string; result?: Record<string, unknown> } = {}
  if (typeof body.label === "string") {
    const trimmed = body.label.trim()
    if (!trimmed) return Response.json({ error: "label cannot be empty" }, { status: 400 })
    updates.label = trimmed
  }
  if (body.result !== null && typeof body.result === "object" && !Array.isArray(body.result)) {
    updates.result = body.result as Record<string, unknown>
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updatable fields provided" }, { status: 400 })
  }

  const supabase = createAdminClient()!
  const { data, error } = await supabase
    .from("bookmarks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single()

  if (error || !data) return Response.json({ error: "Bookmark not found" }, { status: 404 })
  return Response.json({ success: true })
}
