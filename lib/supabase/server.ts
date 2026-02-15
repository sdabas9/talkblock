import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient as createJSClient } from "@supabase/supabase-js"
import { isSupabaseConfigured } from "./check"

export async function createClient() {
  if (!isSupabaseConfigured()) return null

  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export function createAdminClient() {
  if (!isSupabaseConfigured()) return null

  return createJSClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
