"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileSignature, Send, Loader2, Check, X, Pencil, Link2, Terminal, Copy } from "lucide-react"
import { useWallet } from "@/lib/stores/wallet-store"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"

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
  const { chainName, endpoint, hyperionEndpoint } = useChain()
  const { setContext } = useDetailContext()
  const [signing, setSigning] = useState(false)
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showCleos, setShowCleos] = useState(false)
  const [cleosCopied, setCleosCopied] = useState(false)
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

  const cleosCommand = editableActions.map((action) => {
    const dataJson = JSON.stringify(action.data)
    const perm = session?.actor ? `${session.actor}@${session.permission || "active"}` : "<account>@active"
    return `cleos${endpoint ? ` -u ${endpoint}` : ""} push action ${action.account} ${action.name} '${dataJson}' -p ${perm}`
  }).join(" && \\\n")

  const handleSign = async () => {
    setSigning(true)
    setTxError(null)
    try {
      const result = await transact(editableActions)
      const txId = result?.response?.transaction_id || result?.transaction_id || "Success"
      setTxResult(txId)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Transaction failed"
      // User closed the signing modal — not a real error
      const cancelled = /modal closed|cancelled|canceled|user rejected|rejected by user/i.test(errorMsg)
      if (cancelled) {
        // Just reset signing state, don't show error
      } else {
        setTxError(errorMsg)
        if (onTxError) {
          onTxError(errorMsg, editableActions)
        }
      }
    } finally {
      setSigning(false)
    }
  }

  if (dismissed) {
    return (
      <div className="my-2 text-xs text-muted-foreground/60 italic">
        Transaction proposal dismissed
      </div>
    )
  }

  return (
    <Card className="my-2 max-w-md border-primary/50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          Transaction Proposal
          <Badge variant={txResult ? "default" : "outline"} className={`ml-auto text-xs ${txResult ? "bg-green-600 hover:bg-green-600" : ""}`}>
            {txResult ? "Executed" : txError ? "Failed" : data.status === "pending_signature" ? "Pending" : data.status}
          </Badge>
          {!txResult && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setDismissed(true)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
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
        <div>
          <button
            onClick={() => setShowCleos((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Terminal className="h-3 w-3" />
            {showCleos ? "Hide" : "Show"} cleos command
          </button>
          {showCleos && (
            <div className="mt-1.5 relative group/cleos">
              <pre className="text-[11px] font-mono bg-zinc-950 text-zinc-300 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {cleosCommand}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cleosCommand)
                  setCleosCopied(true)
                  setTimeout(() => setCleosCopied(false), 2000)
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors opacity-0 group-hover/cleos:opacity-100"
                title="Copy command"
              >
                {cleosCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-zinc-400" />}
              </button>
            </div>
          )}
        </div>
        {txResult ? (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Check className="h-4 w-4 shrink-0" />
            <button
              onClick={async () => {
                try {
                  const ep = endpoint || hyperionEndpoint
                  if (!ep) return
                  const res = await fetch("/api/lookup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "transaction",
                      id: txResult,
                      endpoint: endpoint || "",
                      hyperionEndpoint: hyperionEndpoint || "",
                    }),
                  })
                  if (res.ok) {
                    const tx = await res.json()
                    setContext("transaction", tx)
                  }
                } catch { /* ignore fetch errors */ }
              }}
              className="font-mono text-xs truncate cursor-pointer"
              title="View transaction details"
            >
              {txResult}
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/?chain=${encodeURIComponent(chainName || "")}&tx=${encodeURIComponent(txResult)}`
                navigator.clipboard.writeText(url)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
              title="Copy shareable link"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Link2 className="h-3 w-3 text-muted-foreground" />}
            </button>
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
