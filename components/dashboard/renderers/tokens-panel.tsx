interface TokensPanelProps {
  data: { tokens?: Array<{ symbol?: string; amount?: number; contract?: string }> }
}

export function TokensPanel({ data }: TokensPanelProps) {
  const tokens = data.tokens || []
  if (tokens.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO TOKENS</div>
  }
  return (
    <div className="font-mono text-xs grid grid-cols-2 gap-x-4">
      {tokens.map((t, i) => (
        <div key={i} className="flex justify-between gap-2 py-0.5 border-b border-border/40">
          <span className="truncate">
            {String(t.symbol || "?")}
            <span className="text-muted-foreground/60 text-[9px]"> {String(t.contract || "")}</span>
          </span>
          <span className="tabular-nums shrink-0">{Number(t.amount ?? 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
