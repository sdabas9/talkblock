import { shortAge } from "./format"

interface ActionsPanelProps {
  data: {
    actions?: Array<{ timestamp?: string; contract?: string; action?: string; actors?: string }>
    total?: { value: number; relation: string }
  }
}

export function ActionsPanel({ data }: ActionsPanelProps) {
  const actions = data.actions || []
  if (actions.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO ACTIONS</div>
  }
  return (
    <div className="font-mono text-xs">
      {data.total && (
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 pb-1">
          Showing {actions.length} of {data.total.value.toLocaleString()}
        </div>
      )}
      {actions.map((a, i) => (
        <div key={i} className="flex items-center gap-2 py-1 border-b border-border/40 last:border-0">
          <span className="truncate">
            <span className="text-muted-foreground">{String(a.contract || "?")}::</span>
            <span>{String(a.action || "?")}</span>
          </span>
          <span className="text-muted-foreground truncate flex-1">{String(a.actors || "")}</span>
          <span className="text-muted-foreground/60 shrink-0">{shortAge(a.timestamp)}</span>
        </div>
      ))}
    </div>
  )
}
