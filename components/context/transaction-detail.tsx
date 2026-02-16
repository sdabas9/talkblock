"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRightLeft, Link2, Check } from "lucide-react"
import { useChain } from "@/lib/stores/chain-store"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TransactionDetailProps {
  data: Record<string, any>
}

function normalizeAction(a: Record<string, unknown>) {
  const act = a.act as Record<string, unknown> | undefined
  return {
    account: (act?.account || a.account || "") as string,
    name: (act?.name || a.name || "") as string,
    data: ((act?.data || a.data || {}) as Record<string, unknown>),
  }
}

function getStatus(data: Record<string, unknown>): string {
  if (data.status) return String(data.status)
  if (data.executed === true) return "executed"
  if (data.executed === false) return "failed"
  return "unknown"
}

export function TransactionDetail({ data }: TransactionDetailProps) {
  const { chainName } = useChain()
  const [copied, setCopied] = useState(false)

  const status = getStatus(data)
  const actions = ((data.actions || []) as Record<string, unknown>[]).map(normalizeAction)

  const copyLink = () => {
    const url = `${window.location.origin}/?chain=${encodeURIComponent(chainName || "")}&tx=${encodeURIComponent(data.id)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Transaction</h2>
        <Badge variant={status === "executed" ? "default" : "secondary"} className={`ml-auto ${status === "executed" ? "bg-green-600 hover:bg-green-600" : ""}`}>
          {status}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Transaction ID</span>
          <button
            onClick={copyLink}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Copy shareable link"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Link2 className="h-3 w-3 text-muted-foreground" />}
          </button>
        </div>
        <p className="text-xs font-mono break-all bg-muted p-2 rounded">{data.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Block</span>
          <p className="font-medium">{data.block_num?.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Time</span>
          <p className="font-medium">{data.block_time}</p>
        </div>
      </div>

      {actions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Actions ({actions.length})</h3>
            {actions.map((action, i) => (
              <div key={i} className="bg-muted rounded-md p-3 text-xs space-y-2">
                <div className="flex items-center gap-1 font-medium">
                  <Badge variant="outline" className="text-[10px]">{action.account}</Badge>
                  <span className="text-muted-foreground">::</span>
                  <span>{action.name}</span>
                </div>
                <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(action.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
