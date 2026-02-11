"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"

interface TransactionCardProps {
  data: {
    id: string
    block_num: number
    block_time: string
    actions: Array<{ account: string; name: string; data: Record<string, unknown> }>
    status: string
  }
}

export function TransactionCard({ data }: TransactionCardProps) {
  const { setContext } = useDetailContext()

  return (
    <Card onClick={() => setContext("transaction", data)} className="my-2 max-w-md cursor-pointer hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Transaction
          <Badge variant={data.status === "executed" ? "default" : "secondary"} className="ml-auto text-xs">
            {data.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1 text-xs">
        <div className="font-mono text-muted-foreground truncate">{data.id}</div>
        <div className="text-muted-foreground">Block: {data.block_num?.toLocaleString()} | {data.block_time}</div>
        <div className="space-y-1 pt-1">
          {data.actions?.map((action, i) => (
            <div key={i} className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px]">{action.account}</Badge>
              <span className="text-muted-foreground">::</span>
              <span className="font-medium">{action.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
