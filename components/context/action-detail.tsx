"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Zap, Send, Loader2, Check, X, Link2, Terminal, Copy } from "lucide-react"
import { useWallet } from "@/lib/stores/wallet-store"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"

interface ActionField {
  name: string
  type: string
}

interface ActionDetailProps {
  data: {
    account_name: string
    action_name: string
    fields: ActionField[]
  }
}

export function ActionDetail({ data }: ActionDetailProps) {
  const { session, transact } = useWallet()
  const { chainName, endpoint, hyperionEndpoint } = useChain()
  const { setContext } = useDetailContext()

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of data.fields) {
      initial[f.name] = ""
    }
    return initial
  })
  const [signing, setSigning] = useState(false)
  const [txResult, setTxResult] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCleos, setShowCleos] = useState(false)
  const [cleosCopied, setCleosCopied] = useState(false)

  const parseValue = (value: string, type: string): unknown => {
    if (type.startsWith("uint") || type.startsWith("int") || type === "float64" || type === "float32") {
      const num = Number(value)
      return isNaN(num) ? value : num
    }
    if (type === "bool") return value === "true" || value === "1"
    // JSON types like arrays/objects
    if (value.startsWith("[") || value.startsWith("{")) {
      try { return JSON.parse(value) } catch { return value }
    }
    return value
  }

  const buildActionData = (): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const f of data.fields) {
      result[f.name] = parseValue(values[f.name] || "", f.type)
    }
    return result
  }

  const cleosCommand = (() => {
    const actionData = buildActionData()
    const dataJson = JSON.stringify(actionData)
    const perm = session?.actor ? `${session.actor}@${session.permission || "active"}` : "<account>@active"
    return `cleos${endpoint ? ` -u ${endpoint}` : ""} push action ${data.account_name} ${data.action_name} '${dataJson}' -p ${perm}`
  })()

  const handleSign = async () => {
    setSigning(true)
    setTxError(null)
    try {
      const actionData = buildActionData()
      const result = await transact([
        { account: data.account_name, name: data.action_name, data: actionData },
      ])
      const txId = result?.response?.transaction_id || result?.transaction_id || "Success"
      setTxResult(txId)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Transaction failed"
      const cancelled = /modal closed|cancelled|canceled|user rejected|rejected by user/i.test(errorMsg)
      if (!cancelled) {
        setTxError(errorMsg)
      }
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5" />
        <h2 className="text-lg font-semibold truncate">{data.action_name}</h2>
      </div>

      <Badge variant="secondary" className="text-[10px] font-mono">
        {data.account_name}
      </Badge>

      <Separator />

      {/* Field inputs */}
      <div className="space-y-2.5">
        {data.fields.map((field) => (
          <div key={field.name} className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              {field.name}
              <span className="text-[10px] text-muted-foreground font-mono">({field.type})</span>
            </Label>
            <Input
              className="h-7 text-xs font-mono"
              value={values[field.name] || ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
              placeholder={field.type}
              disabled={!!txResult}
            />
          </div>
        ))}
      </div>

      {/* Cleos command */}
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

      <Separator />

      {/* Sign / result / error */}
      {txResult ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-500">
            <Check className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">Executed</span>
          </div>
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
              } catch { /* ignore */ }
            }}
            className="font-mono text-xs text-primary truncate cursor-pointer block w-full text-left bg-muted p-2 rounded"
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
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Link2 className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy shareable link"}
          </button>
        </div>
      ) : txError ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <X className="h-4 w-4 shrink-0" />
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
    </div>
  )
}
