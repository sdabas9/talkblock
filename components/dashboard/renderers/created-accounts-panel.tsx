interface CreatedAccountsPanelProps {
  data: {
    accounts?: Array<{ name?: string; timestamp?: string }>
    query_account?: string
  }
}

export function CreatedAccountsPanel({ data }: CreatedAccountsPanelProps) {
  const accounts = data.accounts || []
  if (accounts.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO ACCOUNTS FOUND</div>
  }
  return (
    <div className="font-mono text-xs">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 pb-1">
        Created by {String(data.query_account || "?")}
      </div>
      {accounts.map((a, i) => (
        <div key={i} className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
          <span className="truncate">{String(a.name || "?")}</span>
          <span className="text-muted-foreground shrink-0">
            {a.timestamp ? new Date(String(a.timestamp)).toLocaleDateString() : ""}
          </span>
        </div>
      ))}
    </div>
  )
}
