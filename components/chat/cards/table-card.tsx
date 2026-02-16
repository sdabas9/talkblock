"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TableIcon } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"

interface TableCardProps {
  data: {
    code?: string
    table?: string
    scope?: string
    lower_bound?: string
    upper_bound?: string
    rows: Array<Record<string, unknown>>
    more?: boolean
  }
}

export function TableCard({ data }: TableCardProps) {
  const { setContext } = useDetailContext()

  if (!data.rows || data.rows.length === 0) {
    return (
      <Card className="my-2">
        <CardContent className="px-4 py-3 text-sm text-muted-foreground">
          No rows found
        </CardContent>
      </Card>
    )
  }

  const columns = Object.keys(data.rows[0])

  return (
    <Card onClick={() => setContext("table", data)} className="my-2 overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4 space-y-1.5">
        <CardTitle className="text-sm flex items-center gap-2">
          <TableIcon className="h-4 w-4" />
          {data.code && data.table ? `${data.code} / ${data.table}` : "Table Data"}
          {data.more && <span className="text-xs text-muted-foreground ml-auto">more rows available</span>}
        </CardTitle>
        {(data.code || data.scope) && (
          <div className="flex flex-wrap gap-1.5">
            {data.scope && <Badge variant="secondary" className="text-[10px] font-mono">scope: {data.scope}</Badge>}
            {data.lower_bound && <Badge variant="outline" className="text-[10px] font-mono">lower: {data.lower_bound}</Badge>}
            {data.upper_bound && <Badge variant="outline" className="text-[10px] font-mono">upper: {data.upper_bound}</Badge>}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                      {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
