interface TablePanelProps {
  data: { rows?: Array<Record<string, unknown>> }
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

export function TablePanel({ data }: TablePanelProps) {
  const rows = data.rows || []
  if (rows.length === 0) {
    return <div className="font-mono text-xs text-muted-foreground">NO ROWS</div>
  }
  const columns = Object.keys(rows[0]).slice(0, 6)
  return (
    <table className="w-full font-mono text-xs">
      <thead className="sticky top-0 bg-card">
        <tr>
          {columns.map((c) => (
            <th key={c} className="text-left py-1 pr-3 font-normal text-[9px] uppercase tracking-widest text-muted-foreground">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-border/40">
            {columns.map((c) => (
              <td key={c} className="py-1 pr-3 tabular-nums max-w-[16rem] truncate">
                {cell(row[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
