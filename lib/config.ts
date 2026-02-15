import { createAdminClient } from "@/lib/supabase/server"

// Cache config for 5 minutes to avoid querying DB on every request
let configCache: Record<string, string> = {}
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function loadConfig(): Promise<Record<string, string>> {
  const now = Date.now()
  if (now - cacheTimestamp < CACHE_TTL && Object.keys(configCache).length > 0) {
    return configCache
  }

  const supabase = createAdminClient()
  if (!supabase) return {}

  const { data } = await supabase.from("app_config").select("key, value")

  const config: Record<string, string> = {}
  if (data) {
    for (const row of data) {
      config[row.key] = row.value
    }
  }

  configCache = config
  cacheTimestamp = now
  return config
}

export async function getAppConfig(key: string, fallback?: string): Promise<string> {
  const config = await loadConfig()
  return config[key] || fallback || ""
}

export async function getAppConfigs(...keys: string[]): Promise<Record<string, string>> {
  const config = await loadConfig()
  const result: Record<string, string> = {}
  for (const key of keys) {
    result[key] = config[key] || ""
  }
  return result
}
