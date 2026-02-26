"use client"

import React, { useState, useCallback } from "react"
import { useDetailContext } from "@/lib/stores/context-store"
import { useChain } from "@/lib/stores/chain-store"
import { Button } from "@/components/ui/button"
import { X, ArrowLeft, Maximize2, Minimize2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountDetail } from "@/components/context/account-detail"
import { BlockDetail } from "@/components/context/block-detail"
import { TransactionDetail } from "@/components/context/transaction-detail"
import { TableDetail } from "@/components/context/table-detail"
import { ActionDetail } from "@/components/context/action-detail"
import { fetchAccountData } from "@/lib/antelope/lookup"

class DetailErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

export function RightPanel() {
  const { type, data, clearContext, parentAccount, backToAccount, setContext, expanded, toggleExpanded } = useDetailContext()
  const { endpoint } = useChain()
  const [navLoading, setNavLoading] = useState(false)

  const open = !!type && !!data

  // Determine the account name to navigate back to for orphan panels (opened via shared link, no parentAccount)
  const orphanAccountName = !parentAccount
    ? type === "table" ? data?.code
    : type === "action" ? data?.account_name
    : type === "transaction" ? (data?.actions?.[0]?.act?.account || data?.actions?.[0]?.account)
    : null
    : null

  const goToAccount = useCallback(async () => {
    if (!orphanAccountName || !endpoint) return
    setNavLoading(true)
    try {
      const accountData = await fetchAccountData(orphanAccountName, endpoint)
      setContext("account", accountData)
    } catch { /* ignore */ }
    finally { setNavLoading(false) }
  }, [orphanAccountName, endpoint, setContext])

  // Generate a key that changes when different data is selected, forcing a full remount
  // In expanded mode, keep key stable across account→table/action transitions to avoid remount flash
  const showExpandedAccount = expanded && parentAccount && (type === "table" || type === "action")
  const isExpandedAccount = expanded && type === "account"
  const detailKey = type && data
    ? (showExpandedAccount || isExpandedAccount)
      ? `account-expanded-${parentAccount?.account_name || data.account_name || ""}`
      : `${type}-${expanded}-${data.account_name || ""}${data.code || ""}${data.table || ""}${data.action_name || ""}${data.id || ""}${data.block_num || ""}`
    : "none"

  const renderDetail = () => {
    switch (type) {
      case "account":
        return <AccountDetail data={data} expanded={expanded} />
      case "block":
        return <BlockDetail data={data} />
      case "transaction":
        return <TransactionDetail data={data} />
      case "table":
        if (expanded && parentAccount) {
          return <AccountDetail data={parentAccount} expanded={expanded} initialTable={data.table} initialTableData={data} />
        }
        return <TableDetail data={data} />
      case "action":
        if (expanded && parentAccount) {
          return <AccountDetail data={parentAccount} expanded={expanded} initialAction={data.action_name} initialActionData={data} />
        }
        return <ActionDetail data={data} />
      default:
        return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    }
  }

  return (
    <aside
      data-right-panel
      className={cn(
        "border-l bg-muted/30 transition-all duration-300 overflow-hidden",
        "max-md:absolute max-md:right-0 max-md:z-20 max-md:h-full max-md:w-full",
        open ? (expanded ? "flex-1" : "w-[400px] max-md:w-full") : "w-0"
      )}
    >
      <div className="h-full overflow-y-auto">
        {data?._loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading {type} data...</span>
          </div>
        ) : open ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={toggleExpanded} className="h-7 w-7" title={expanded ? "Collapse panel" : "Expand panel"}>
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <h3 className="text-sm font-medium">
                  {expanded && parentAccount && (type === "table" || type === "action")
                    ? "Account Details"
                    : type ? type.charAt(0).toUpperCase() + type.slice(1) + " Details" : "Details"}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={clearContext}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DetailErrorBoundary key={detailKey} fallback={<pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>}>
              {renderDetail()}
            </DetailErrorBoundary>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
