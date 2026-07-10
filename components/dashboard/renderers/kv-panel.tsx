import { flattenResult } from "./format"

// Generic fallback renderer: any tool without a dedicated renderer becomes
// labeled key-value rows instead of a raw JSON dump.
export function KvPanel({ result }: { result: Record<string, unknown> }) {
  const rows = flattenResult(result)
  const shown = rows.slice(0, 40)
  if (rows.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO DATA</div>
  }
  return (
    <div className="font-mono text-xs">
      {shown.map(([k, v], i) =>
        v.length > 100 ? (
          <div key={i} className="py-0.5 border-b border-border/40 last:border-0">
            <div className="text-muted-foreground uppercase tracking-wide truncate">{k}</div>
            <div className="whitespace-pre-wrap break-words text-foreground/90">{v}</div>
          </div>
        ) : (
          <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
            <span className="text-muted-foreground uppercase tracking-wide truncate">{k}</span>
            <span className="truncate text-right tabular-nums">{v}</span>
          </div>
        )
      )}
      {rows.length > 40 && (
        <div className="py-0.5 text-muted-foreground/60">+{rows.length - 40} more rows</div>
      )}
    </div>
  )
}
