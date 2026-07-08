import { shortAge } from "./format"

interface TransfersPanelProps {
  data: {
    transfers?: Array<{ timestamp?: string; from?: string; to?: string; quantity?: string; memo?: string }>
    account?: string
  }
}

export function TransfersPanel({ data }: TransfersPanelProps) {
  const transfers = data.transfers || []
  const account = String(data.account || "")
  if (transfers.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO TRANSFERS</div>
  }
  return (
    <div className="font-mono text-xs">
      {transfers.map((t, i) => {
        const incoming = String(t.to || "") === account
        const counterparty = incoming ? String(t.from || "?") : String(t.to || "?")
        const dirClass = incoming ? "text-primary" : "text-destructive"
        return (
          <div key={i} className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0">
            <span className={`${dirClass} shrink-0`}>{incoming ? "←" : "→"}</span>
            <span className={`${dirClass} tabular-nums shrink-0`}>{String(t.quantity || "?")}</span>
            <span className="text-muted-foreground truncate flex-1">{counterparty}</span>
            <span className="text-muted-foreground/60 shrink-0">{shortAge(t.timestamp)}</span>
          </div>
        )
      })}
    </div>
  )
}
