"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft, Link2, Check } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"
import { useChain } from "@/lib/stores/chain-store"
import { isAccountName, fetchAccountData } from "@/lib/antelope/lookup"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TransactionCardProps {
  data: Record<string, any>
}

// Normalize action from either RPC format { account, name } or Hyperion format { act: { account, name } }
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

export function TransactionCard({ data }: TransactionCardProps) {
  const { setContext } = useDetailContext()
  const { chainName, endpoint } = useChain()
  const [copied, setCopied] = useState(false)

  const status = getStatus(data)
  const actions = ((data.actions || []) as Record<string, unknown>[]).map(normalizeAction)

  const onAccountClick = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    if (!endpoint) return
    try {
      setContext("account", await fetchAccountData(name, endpoint))
    } catch { /* ignore */ }
  }

  // Render a clickable account name span
  const acct = (name: unknown) => {
    const s = String(name || "")
    if (!s || !isAccountName(s)) return <span>{s}</span>
    return (
      <span
        className="text-primary cursor-pointer"
        onClick={(e) => onAccountClick(e, s)}
        title="View account details"
      >
        {s}
      </span>
    )
  }

  // Build summary JSX for an action
  const summarizeAction = (name: string, d: Record<string, unknown>) => {
    if (!d || Object.keys(d).length === 0) return null
    if (name === "transfer" && d.from && d.to && d.quantity) {
      return <>{acct(d.from)} → {acct(d.to)}: {String(d.quantity)}{d.memo ? ` (${d.memo})` : ""}</>
    }
    if (name === "buyram" && d.payer && d.quant) {
      return <>{acct(d.payer)} buys {String(d.quant)} RAM for {acct(d.receiver || d.payer)}</>
    }
    if (name === "delegatebw" && d.from) {
      return <>{acct(d.from)} → {acct(d.receiver)}: {String(d.stake_cpu_quantity || "0")} CPU, {String(d.stake_net_quantity || "0")} NET</>
    }
    return null
  }

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}/?chain=${encodeURIComponent(chainName || "")}&tx=${encodeURIComponent(data.id)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card onClick={() => setContext("transaction", data)} className="my-2 max-w-md cursor-pointer hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Transaction
          <Badge variant={status === "executed" ? "default" : "secondary"} className={`ml-auto text-xs ${status === "executed" ? "bg-green-600 hover:bg-green-600" : ""}`}>
            {status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1 text-xs">
        <div className="flex items-center gap-1">
          <span className="font-mono text-muted-foreground truncate">{data.id}</span>
          <button
            onClick={copyLink}
            className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
            title="Copy shareable link"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Link2 className="h-3 w-3 text-muted-foreground" />}
          </button>
        </div>
        <div className="text-muted-foreground">Block: {data.block_num?.toLocaleString()} | {data.block_time}</div>
        <div className="space-y-1.5 pt-1">
          {actions.map((action, i) => {
            const summary = summarizeAction(action.name, action.data)
            return (
              <div key={i}>
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-accent"
                    onClick={(e) => onAccountClick(e, action.account)}
                  >
                    {action.account}
                  </Badge>
                  <span className="text-muted-foreground">::</span>
                  <span className="font-medium">{action.name}</span>
                </div>
                {summary && (
                  <div className="text-[11px] text-muted-foreground pl-1 truncate">{summary}</div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
