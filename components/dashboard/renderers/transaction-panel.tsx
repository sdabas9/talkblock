// Normalize action from either RPC format { account, name } or Hyperion { act: { account, name } }
// (same normalization as components/chat/cards/transaction-card.tsx)
function normalizeAction(a: Record<string, unknown>) {
  const act = a.act as Record<string, unknown> | undefined
  return {
    account: (act?.account || a.account || "") as string,
    name: (act?.name || a.name || "") as string,
  }
}

function getStatus(data: Record<string, unknown>): string {
  if (data.status) return String(data.status)
  if (data.executed === true) return "executed"
  if (data.executed === false) return "failed"
  return "unknown"
}

interface TransactionPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export function TransactionPanel({ data }: TransactionPanelProps) {
  const status = getStatus(data)
  const actions = ((data.actions || []) as Record<string, unknown>[]).map(normalizeAction)
  const txId = String(data.id || data.trx_id || data.transaction_id || "")
  return (
    <div className="font-mono text-xs space-y-1">
      <div className="flex justify-between gap-3">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">Status</span>
        <span className={status === "executed" ? "text-primary" : status === "failed" ? "text-destructive" : ""}>
          {status.toUpperCase()}
        </span>
      </div>
      {txId && (
        <div className="flex justify-between gap-3">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">ID</span>
          <span className="truncate">{txId.slice(0, 16)}…</span>
        </div>
      )}
      {data.block_num !== undefined && (
        <div className="flex justify-between gap-3">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">Block</span>
          <span className="tabular-nums">#{Number(data.block_num).toLocaleString()}</span>
        </div>
      )}
      {actions.length > 0 && (
        <div className="pt-1 border-t border-border/40">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground pb-0.5">Actions</div>
          {actions.slice(0, 6).map((a, i) => (
            <div key={i} className="truncate">
              <span className="text-muted-foreground">{a.account}::</span>{a.name}
            </div>
          ))}
          {actions.length > 6 && (
            <div className="text-muted-foreground/60">+{actions.length - 6} more</div>
          )}
        </div>
      )}
    </div>
  )
}
