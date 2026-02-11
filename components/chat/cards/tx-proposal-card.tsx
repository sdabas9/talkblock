"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileSignature, Send, Loader2, Check, X, Pencil } from "lucide-react"
import { useWallet } from "@/lib/stores/wallet-store"

interface TxAction {
  account: string
  name: string
  data: Record<string, unknown>
}

interface TxProposalCardProps {
  data: {
    type: string
    description: string
    actions: TxAction[]
    status: string
  }
  onTxError?: (error: string, actions: TxAction[]) => void
}

export function TxProposalCard({ data, onTxError }: TxProposalCardProps) {
  const { session, transact } = useWallet()
  const [signing, setSigning] = useState(false)
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [editableActions, setEditableActions] = useState<TxAction[]>(
    () => data.actions.map((a) => ({ ...a, data: { ...a.data } }))
  )

  const updateField = (actionIdx: number, fieldKey: string, value: string) => {
    setEditableActions((prev) => {
      const next = prev.map((a, i) => {
        if (i !== actionIdx) return a
        const original = data.actions[actionIdx].data[fieldKey]
        let parsed: unknown = value
        if (typeof original === "number") {
          const num = Number(value)
          if (!isNaN(num)) parsed = num
        } else if (typeof original === "boolean") {
          parsed = value === "true"
        }
        return { ...a, data: { ...a.data, [fieldKey]: parsed } }
      })
      return next
    })
  }

  function summarizeActions(actions: TxAction[]): string {
    return actions.map((action) => {
      const d = action.data
      if (action.name === "transfer" && d.from && d.to && d.quantity) {
        return `Transfer ${d.quantity} from ${d.from} to ${d.to}${d.memo ? ` (memo: ${d.memo})` : ""}`
      }
      if (action.name === "delegatebw" && d.from && d.receiver) {
        return `Delegate ${d.stake_cpu_quantity || ""} CPU, ${d.stake_net_quantity || ""} NET from ${d.from} to ${d.receiver}`
      }
      if (action.name === "undelegatebw" && d.from && d.receiver) {
        return `Undelegate ${d.unstake_cpu_quantity || ""} CPU, ${d.unstake_net_quantity || ""} NET from ${d.from} to ${d.receiver}`
      }
      if (action.name === "buyram" && d.payer && d.quant) {
        return `Buy ${d.quant} RAM for ${d.receiver || d.payer}`
      }
      if (action.name === "buyrambytes" && d.payer && d.bytes) {
        return `Buy ${d.bytes} bytes RAM for ${d.receiver || d.payer}`
      }
      if (action.name === "sellram" && d.account && d.bytes) {
        return `Sell ${d.bytes} bytes RAM from ${d.account}`
      }
      // Generic fallback
      const fields = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ")
      return `${action.account}::${action.name}(${fields})`
    }).join(" + ")
  }

  const isEdited = JSON.stringify(editableActions) !== JSON.stringify(data.actions)
  const description = isEdited ? summarizeActions(editableActions) : data.description

  const handleSign = async () => {
    setSigning(true)
    setTxError(null)
    try {
      const result = await transact(editableActions)
      const txId = result?.response?.transaction_id || result?.transaction_id || "Success"
      setTxResult(txId)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Transaction failed"
      setTxError(errorMsg)
      if (onTxError) {
        onTxError(errorMsg, editableActions)
      }
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
        <p className="text-sm">
          {description}
          {isEdited && <Badge variant="secondary" className="ml-2 text-[10px]">edited</Badge>}
        </p>
        <div className="space-y-2">
          {editableActions.map((action, actionIdx) => (
            <div key={actionIdx} className="bg-muted rounded-md p-3 text-xs space-y-2">
              <div className="flex items-center gap-1 font-medium">
                <Badge variant="outline" className="text-[10px]">{action.account}</Badge>
                <span className="text-muted-foreground">::</span>
                <span>{action.name}</span>
                <Pencil className="h-3 w-3 ml-auto text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                {Object.entries(action.data).map(([key, value]) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground">{key}</Label>
                    <Input
                      className="h-7 text-xs font-mono"
                      value={String(value ?? "")}
                      onChange={(e) => updateField(actionIdx, key, e.target.value)}
                      disabled={!!txResult}
                    />
                  </div>
                ))}
              </div>
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
