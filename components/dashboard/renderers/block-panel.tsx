function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 border-b border-border/40 last:border-0">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground self-center">{k}</span>
      <span className="truncate text-right tabular-nums">{v}</span>
    </div>
  )
}

interface BlockPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export function BlockPanel({ data }: BlockPanelProps) {
  return (
    <div className="font-mono text-xs">
      <Row k="Block" v={`#${Number(data.block_num ?? 0).toLocaleString()}`} />
      <Row k="Producer" v={String(data.producer || "?")} />
      <Row k="Time" v={data.timestamp ? new Date(String(data.timestamp)).toLocaleString() : "?"} />
      <Row k="Txs" v={String(data.transaction_count ?? 0)} />
      {data.id && <Row k="ID" v={`${String(data.id).slice(0, 16)}…`} />}
    </div>
  )
}
