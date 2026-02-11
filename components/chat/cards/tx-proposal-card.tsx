"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileSignature, Send, Loader2, Check, X } from "lucide-react"
import { useWallet } from "@/lib/stores/wallet-store"

interface TxProposalCardProps {
  data: {
    type: string
    description: string
    actions: Array<{
      account: string
      name: string
      data: Record<string, unknown>
    }>
    status: string
  }
}

export function TxProposalCard({ data }: TxProposalCardProps) {
  const { session, transact } = useWallet()
  const [signing, setSigning] = useState(false)
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const handleSign = async () => {
    setSigning(true)
    setTxError(null)
    try {
      const result = await transact(data.actions)
      const txId = result?.response?.transaction_id || result?.transaction_id || "Success"
      setTxResult(txId)
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Transaction failed")
    } finally {
      setSigning(false)
    }
  }

  return (
    <Card className="my-2 max-w-md border-primary/50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Transaction Proposal
          <Badge variant="outline" className="ml-auto text-xs">
            {txResult ? "Broadcast" : txError ? "Failed" : data.status === "pending_signature" ? "Pending" : data.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <p className="text-sm">{data.description}</p>
        <div className="space-y-2">
          {data.actions.map((action, i) => (
            <div key={i} className="bg-muted rounded-md p-2 text-xs space-y-1">
              <div className="flex items-center gap-1 font-medium">
                <Badge variant="outline" className="text-[10px]">{action.account}</Badge>
                <span className="text-muted-foreground">::</span>
                <span>{action.name}</span>
              </div>
              <pre className="text-muted-foreground overflow-x-auto">
                {JSON.stringify(action.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
        {txResult ? (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Check className="h-4 w-4" />
            <span className="font-mono text-xs truncate">{txResult}</span>
          </div>
        ) : txError ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <X className="h-4 w-4" />
              <span className="text-xs">{txError}</span>
            </div>
            <Button className="w-full" size="sm" onClick={handleSign} disabled={!session}>
              <Send className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <Button className="w-full" size="sm" onClick={handleSign} disabled={signing || !session}>
            {signing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {!session ? "Connect Wallet First" : signing ? "Signing..." : "Sign & Broadcast"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
