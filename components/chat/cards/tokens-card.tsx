"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Coins } from "lucide-react"

interface Token {
  symbol?: string
  amount?: number
  contract?: string
  precision?: number
  [key: string]: unknown
}

interface TokensCardProps {
  data: {
    tokens: Token[]
    account?: string
  }
}

export function TokensCard({ data }: TokensCardProps) {
  const { tokens, account } = data

  if (!tokens || tokens.length === 0) {
    return (
      <Card className="my-2 max-w-md">
        <CardContent className="px-4 py-3 text-sm text-muted-foreground">
          No tokens found
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="my-2 max-w-md overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Token Holdings
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
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Symbol</th>
                <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Contract</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5 whitespace-nowrap font-medium">{String(token.symbol || "—")}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-right font-mono">
                    {token.amount !== undefined ? Number(token.amount).toLocaleString(undefined, { maximumFractionDigits: token.precision || 4 }) : "—"}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px]">{String(token.contract || "—")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
