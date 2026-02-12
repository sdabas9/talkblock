"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity } from "lucide-react"

interface Action {
  block?: number
  timestamp?: string
  contract?: string
  action?: string
  actors?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

interface ActionsCardProps {
  data: {
    actions: Action[]
    total?: { value: number; relation: string }
  }
}

export function ActionsCard({ data }: ActionsCardProps) {
  const { actions, total } = data

  if (!actions || actions.length === 0) {
    return (
      <Card className="my-2 max-w-lg">
        <CardContent className="px-4 py-3 text-sm text-muted-foreground">
          No actions found
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="my-2 max-w-lg overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Action History
          {total && (
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {actions.length} of {total.value.toLocaleString()}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Contract</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Actor</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((act, i) => {
                const ts = act.timestamp || act["@timestamp"] as string | undefined
                const time = ts ? new Date(ts).toLocaleString() : "—"
                const dataSummary = act.data
                  ? Object.entries(act.data).map(([k, v]) => `${k}:${typeof v === "string" ? v : JSON.stringify(v)}`).join(", ")
                  : "—"

                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{time}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px]">{String(act.contract || "—")}</Badge>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-medium">{String(act.action || "—")}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{String(act.actors || "—")}</td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate" title={dataSummary}>{dataSummary}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
