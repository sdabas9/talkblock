interface AbiPanelProps {
  data: { account_name?: string; actions?: string[]; tables?: string[] }
}

function Chips({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground pb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((name) => (
          <span key={name} className="border border-border px-1.5 py-0.5 text-[10px]">
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AbiPanel({ data }: AbiPanelProps) {
  return (
    <div className="font-mono text-xs space-y-2">
      <div>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Contract </span>
        <span>{String(data.account_name || "?")}</span>
      </div>
      <Chips title="Actions" items={data.actions || []} />
      <Chips title="Tables" items={data.tables || []} />
    </div>
  )
}
