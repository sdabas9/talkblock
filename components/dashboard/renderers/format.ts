// Compact age for dense rows: "now", "5m", "3h", "2d".
// Hyperion timestamps often lack a timezone suffix — treat them as UTC.
export function shortAge(iso?: string): string {
  if (!iso) return ""
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z"
  const diff = Date.now() - new Date(normalized).getTime()
  if (Number.isNaN(diff)) return ""
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// Flatten a result object into [path, value] rows for the generic kv-panel.
// Arrays show their first 5 entries plus a "+N more" row; nesting caps at depth 2.
export function flattenResult(
  obj: Record<string, unknown>,
  prefix = "",
  out: Array<[string, string]> = [],
  depth = 0
): Array<[string, string]> {
  if (depth > 2) {
    out.push([prefix || "value", JSON.stringify(obj)])
    return out
  }
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      value.slice(0, 5).forEach((v, i) => {
        if (v !== null && typeof v === "object") {
          flattenResult(v as Record<string, unknown>, `${path}[${i}]`, out, depth + 1)
        } else {
          out.push([`${path}[${i}]`, String(v)])
        }
      })
      if (value.length > 5) out.push([path, `+${value.length - 5} more`])
    } else if (value !== null && typeof value === "object") {
      flattenResult(value as Record<string, unknown>, path, out, depth + 1)
    } else {
      out.push([path, String(value)])
    }
  }
  return out
}
