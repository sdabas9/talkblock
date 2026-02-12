"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftRight, ArrowRight } from "lucide-react"

interface Transfer {
  from?: string
  to?: string
  quantity?: string
  symbol?: string
  memo?: string
  contract?: string
  timestamp?: string
  "@timestamp"?: string
  act?: {
    data?: { from?: string; to?: string; quantity?: string; memo?: string }
  }
  [key: string]: unknown
}

interface TransfersCardProps {
  data: {
    transfers: Transfer[]
    account?: string
  }
}

export function TransfersCard({ data }: TransfersCardProps) {
  const { transfers, account } = data

  if (!transfers || transfers.length === 0) {
    return (
      <Card className="my-2 max-w-lg">
        <CardContent className="px-4 py-3 text-sm text-muted-foreground">
          No transfers found
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="my-2 max-w-lg overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          Transfer History
          {account && (
            <Badge variant="secondary" className="ml-auto text-xs">{account}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Time</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">From</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground"></th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">To</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Memo</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tx, i) => {
                const actData = tx.act?.data
                const from = tx.from || actData?.from || "—"
                const to = tx.to || actData?.to || "—"
                const quantity = tx.quantity || actData?.quantity || "—"
                const memo = tx.memo || actData?.memo || ""
                const ts = tx.timestamp || tx["@timestamp"]
                const time = ts ? new Date(ts).toLocaleString() : "—"
                const isOutgoing = account && from === account

                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{time}</td>
                    <td className={`px-3 py-1.5 whitespace-nowrap ${isOutgoing ? "font-medium" : ""}`}>{from}</td>
                    <td className="px-1 py-1.5">
                      <ArrowRight className={`h-3 w-3 ${isOutgoing ? "text-red-500" : "text-green-500"}`} />
                    </td>
                    <td className={`px-3 py-1.5 whitespace-nowrap ${!isOutgoing ? "font-medium" : ""}`}>{to}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-medium">{quantity}</td>
                    <td className="px-3 py-1.5 max-w-[150px] truncate text-muted-foreground" title={memo}>{memo}</td>
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
