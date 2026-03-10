"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Box, Clock, User } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"
import { useChain } from "@/lib/stores/chain-store"
import { fetchTxData } from "@/lib/antelope/lookup"

interface BlockDetailProps {
  data: {
    block_num: number
    id: string
    timestamp: string
    producer: string
    confirmed: number
    transaction_count: number
    transactions?: Array<{
      id: string
      status: string
      cpu_usage_us: number
      net_usage_words: number
      actions?: Array<{ account: string; name: string }>
    }>
  }
}

export function BlockDetail({ data }: BlockDetailProps) {
  const { setContext } = useDetailContext()
  const { endpoint, hyperionEndpoint } = useChain()

  const handleTxClick = async (txId: string) => {
    if (!txId || !endpoint) return
    try {
      const txData = await fetchTxData(txId, endpoint, hyperionEndpoint)
      if (txData) setContext("transaction", txData)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Box className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Block #{data.block_num.toLocaleString()}</h2>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{data.timestamp}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Producer: {data.producer}</span>
        </div>
        <div>
          <Badge variant="secondary">{data.transaction_count} transactions</Badge>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Block ID</span>
        <p className="text-xs font-mono break-all bg-muted p-2 rounded">{data.id}</p>
      </div>

      {data.transactions && data.transactions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Transactions</h3>
            {data.transactions.map((tx, i) => (
              <div key={i} className="bg-muted rounded-md p-2 text-xs space-y-1 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleTxClick(tx.id)}>
                <div className="font-mono truncate text-primary">{tx.id}</div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>Status: {tx.status}</span>
                  <span>CPU: {tx.cpu_usage_us}µs</span>
                  <span>NET: {tx.net_usage_words}w</span>
                </div>
                {tx.actions && tx.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tx.actions.map((a, j) => (
                      <Badge key={j} variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
                        {a.account}::{a.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
