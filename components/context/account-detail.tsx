"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, HardDrive, Cpu, Wifi, Key, Shield, Copy, Check, Database, Zap, Loader2, FileCode, Link2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { TableDetail } from "@/components/context/table-detail"
import { ActionDetail } from "@/components/context/action-detail"
import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AccountDetailProps {
  data: Record<string, any>
  expanded?: boolean
}

function ResourceDetail({ label, used, max, icon: Icon }: { label: string; used: number; max: number; icon: React.ElementType }) {
  const pct = max > 0 ? (used / max) * 100 : 0
  const formatBytes = (b: number) => {
    if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB"
    if (b >= 1024) return (b / 1024).toFixed(2) + " KB"
    return b + " bytes"
  }
  const formatUs = (us: number) => {
    if (us >= 1000000) return (us / 1000000).toFixed(2) + " s"
    if (us >= 1000) return (us / 1000).toFixed(2) + " ms"
    return us + " \u00b5s"
  }
  const format = label === "RAM" ? formatBytes : formatUs

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Used: {format(used)}</span>
        <span>Max: {format(max)}</span>
      </div>
    </div>
  )
}

interface AbiTable { name: string; index_type: string; key_names: string[]; key_types: string[]; type: string }
interface AbiAction { name: string; type: string; ricardian_contract?: string }
interface AbiStruct { name: string; base: string; fields: { name: string; type: string }[] }
interface AbiData { tables: AbiTable[]; actions: AbiAction[]; structs: AbiStruct[] }

export function AccountDetail({ data, expanded }: AccountDetailProps) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const { endpoint, chainName } = useChain()
  const { setContext } = useDetailContext()
  const [abi, setAbi] = useState<AbiData | null>(null)
  const [abiLoading, setAbiLoading] = useState(false)
  const [abiChecked, setAbiChecked] = useState(false)

  // Expanded mode: account search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)

  // Expanded mode: inline table/action selection
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [inlineTableData, setInlineTableData] = useState<any>(null)
  const [inlineActionData, setInlineActionData] = useState<any>(null)
  const [inlineLoading, setInlineLoading] = useState(false)

  useEffect(() => {
    if (!endpoint || !data.account_name) return
    setAbiLoading(true)
    fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "abi", id: data.account_name, endpoint }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.abi) setAbi(result.abi)
      })
      .catch(() => {})
      .finally(() => { setAbiLoading(false); setAbiChecked(true) })
  }, [endpoint, data.account_name])

  useEffect(() => {
    setSelectedTable(null)
    setSelectedAction(null)
    setInlineTableData(null)
    setInlineActionData(null)
  }, [data.account_name])

  const handleTableClick = async (tableName: string) => {
    if (!endpoint) return
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "table",
          code: data.account_name,
          table: tableName,
          scope: data.account_name,
          endpoint,
        }),
      })
      if (res.ok) {
        const tableData = await res.json()
        setContext("table", tableData)
      }
    } catch {}
  }

  const handleActionClick = (actionName: string) => {
    if (!abi) return
    const action = abi.actions.find((a) => a.name === actionName)
    if (!action) return
    const struct = abi.structs.find((s) => s.name === action.type)
    setContext("action", {
      account_name: data.account_name,
      action_name: actionName,
      fields: struct?.fields || [],
    })
  }

  const handleAccountSearch = async () => {
    const q = searchQuery.trim()
    if (!q || !endpoint) return
    setSearchLoading(true)
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "account", id: q, endpoint }),
      })
      if (res.ok) {
        const accountData = await res.json()
        if (accountData.account_name) {
          setContext("account", accountData)
          setSearchQuery("")
        }
      }
    } catch {}
    finally { setSearchLoading(false) }
  }

  const handleInlineTableClick = async (tableName: string) => {
    if (!endpoint) return
    setSelectedTable(tableName)
    setSelectedAction(null)
    setInlineActionData(null)
    setInlineLoading(true)
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "table",
          code: data.account_name,
          table: tableName,
          scope: data.account_name,
          endpoint,
        }),
      })
      if (res.ok) {
        const tableData = await res.json()
        setInlineTableData(tableData)
      }
    } catch {}
    finally { setInlineLoading(false) }
  }

  const handleInlineActionClick = (actionName: string) => {
    if (!abi) return
    setSelectedAction(actionName)
    setSelectedTable(null)
    setInlineTableData(null)
    const action = abi.actions.find((a) => a.name === actionName)
    if (!action) return
    const struct = abi.structs.find((s) => s.name === action.type)
    setInlineActionData({
      account_name: data.account_name,
      action_name: actionName,
      fields: struct?.fields || [],
    })
  }

  const ram = data.ram || { used: 0, quota: 0 }
  const cpu = data.cpu || { used: 0, available: 0, max: 0 }
  const net = data.net || { used: 0, available: 0, max: 0 }

  return (
    <div className="space-y-4">
      {expanded && (
        <div className="flex gap-2 mb-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAccountSearch()}
            placeholder="Search account..."
            className="h-8 text-sm font-mono"
          />
          <Button
            variant="default"
            size="sm"
            className="h-8 px-3 shrink-0"
            onClick={handleAccountSearch}
            disabled={searchLoading || !searchQuery.trim()}
          >
            {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Compact header for expanded mode */}
      {expanded ? (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{data.account_name}</span>
          <Badge variant="secondary" className="text-xs">{data.balance || "0"}</Badge>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.account_name)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="Copy account name"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{data.account_name}</h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(data.account_name)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="p-0.5 rounded hover:bg-accent transition-colors"
              title="Copy account name"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/?chain=${encodeURIComponent(chainName || "")}&account=${encodeURIComponent(data.account_name)}`
                navigator.clipboard.writeText(url)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
              className="p-0.5 rounded hover:bg-accent transition-colors"
              title="Copy shareable link"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">{data.balance || "0"}</Badge>
          </div>
        </>
      )}

      {/* Non-expanded: show resources, staking, permissions, voting */}
      {!expanded && (
        <>
          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Resources</h3>
            <ResourceDetail label="RAM" used={ram.used || 0} max={ram.quota || 0} icon={HardDrive} />
            <ResourceDetail label="CPU" used={cpu.used || 0} max={cpu.max || 0} icon={Cpu} />
            <ResourceDetail label="NET" used={net.used || 0} max={net.max || 0} icon={Wifi} />
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Staking</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">CPU Staked:</span>
                <p className="font-medium">{data.cpu_staked || "0"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">NET Staked:</span>
                <p className="font-medium">{data.net_staked || "0"}</p>
              </div>
            </div>
          </div>

          {data.permissions && data.permissions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Permissions
                </h3>
                {data.permissions.map((perm: any) => (
                  <div key={perm.name} className="bg-muted rounded-md p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{perm.name}</Badge>
                      {perm.parent && <span className="text-muted-foreground">parent: {perm.parent}</span>}
                      <span className="text-muted-foreground">threshold: {perm.threshold}</span>
                    </div>
                    {(perm.keys || []).map((k: any, i: number) => (
                      <div key={i} className="flex items-center gap-1 text-muted-foreground pl-2">
                        <Key className="h-3 w-3" />
                        <span className="font-mono truncate">{k.key}</span>
                        <span>w:{k.weight}</span>
                      </div>
                    ))}
                    {(perm.accounts || []).map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-1 text-muted-foreground pl-2">
                        <User className="h-3 w-3" />
                        <span>{a.permission?.actor}@{a.permission?.permission}</span>
                        <span>w:{a.weight}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {data.voter_info && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Voting</h3>
                <p className="text-xs text-muted-foreground">
                  Staked: {data.voter_info.staked?.toLocaleString() || 0}
                </p>
                {data.voter_info.producers?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {data.voter_info.producers.map((p: any) => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ABI loading - both modes */}
      {abiLoading && (
        <>
          <Separator />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading contract...
          </div>
        </>
      )}

      {/* Non-expanded: original contract button layout */}
      {abiChecked && abi && !expanded && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              Contract
            </h3>

            {abi.tables.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Tables ({abi.tables.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {abi.tables.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => handleTableClick(t.name)}
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {abi.actions.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Actions ({abi.actions.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {abi.actions.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => handleActionClick(a.name)}
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Expanded: side-by-side layout */}
      {abiChecked && abi && expanded && (
        <>
          <Separator />
          <div className="flex gap-4 min-h-0" style={{ height: "calc(100vh - 200px)" }}>
            {/* Left: Tables & Actions lists */}
            <div className="w-48 shrink-0 flex flex-col gap-3 overflow-y-auto">
              {abi.tables.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 sticky top-0 bg-muted/30 py-1">
                    <Database className="h-3 w-3" />
                    Tables ({abi.tables.length})
                  </h4>
                  <div className="space-y-0.5">
                    {abi.tables.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => handleInlineTableClick(t.name)}
                        className={cn(
                          "w-full text-left text-[11px] font-mono px-2 py-1 rounded transition-colors",
                          selectedTable === t.name
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {abi.actions.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 sticky top-0 bg-muted/30 py-1">
                    <Zap className="h-3 w-3" />
                    Actions ({abi.actions.length})
                  </h4>
                  <div className="space-y-0.5">
                    {abi.actions.map((a) => (
                      <button
                        key={a.name}
                        onClick={() => handleInlineActionClick(a.name)}
                        className={cn(
                          "w-full text-left text-[11px] font-mono px-2 py-1 rounded transition-colors",
                          selectedAction === a.name
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Inline content area */}
            <div className="flex-1 overflow-y-auto border-l pl-4">
              {inlineLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              )}
              {!inlineLoading && selectedTable && inlineTableData && (
                <TableDetail data={inlineTableData} key={selectedTable + '-' + data.account_name} />
              )}
              {!inlineLoading && selectedAction && inlineActionData && (
                <ActionDetail data={inlineActionData} />
              )}
              {!inlineLoading && !selectedTable && !selectedAction && (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Select a table or action to view
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Expanded: no contract state */}
      {abiChecked && !abi && expanded && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No contract deployed on this account.
        </div>
      )}
    </div>
  )
}
