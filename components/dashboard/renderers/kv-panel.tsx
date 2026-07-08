import { flattenResult } from "./format"

// Generic fallback renderer: any tool without a dedicated renderer becomes
// labeled key-value rows instead of a raw JSON dump.
export function KvPanel({ result }: { result: Record<string, unknown> }) {
  const rows = flattenResult(result).slice(0, 40)
  if (rows.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO DATA</div>
  }
  return (
    <div className="font-mono text-xs">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
          <span className="text-muted-foreground uppercase tracking-wide truncate">{k}</span>
          <span className="truncate text-right tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}
