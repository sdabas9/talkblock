"use client"

import React from "react"
import { useDetailContext } from "@/lib/stores/context-store"
import { Button } from "@/components/ui/button"
import { X, ArrowLeft, Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountDetail } from "@/components/context/account-detail"
import { BlockDetail } from "@/components/context/block-detail"
import { TransactionDetail } from "@/components/context/transaction-detail"
import { TableDetail } from "@/components/context/table-detail"
import { ActionDetail } from "@/components/context/action-detail"

class DetailErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

export function RightPanel() {
  const { type, data, clearContext, parentAccount, backToAccount, expanded, toggleExpanded } = useDetailContext()

  const open = !!type && !!data

  // Generate a key that changes when different data is selected, forcing a full remount
  const detailKey = type && data
    ? `${type}-${data.account_name || ""}${data.code || ""}${data.table || ""}${data.action_name || ""}${data.id || ""}${data.block_num || ""}`
    : "none"

  const renderDetail = () => {
    switch (type) {
      case "account":
        return <AccountDetail data={data} />
      case "block":
        return <BlockDetail data={data} />
      case "transaction":
        return <TransactionDetail data={data} />
      case "table":
        return <TableDetail data={data} />
      case "action":
        return <ActionDetail data={data} />
      default:
        return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    }
  }

  return (
    <aside
      className={cn(
        "border-l bg-muted/30 transition-all duration-300 overflow-hidden",
        "max-md:absolute max-md:right-0 max-md:z-20 max-md:h-full max-md:w-full",
        open ? (expanded ? "flex-1" : "w-[400px] max-md:w-full") : "w-0"
      )}
    >
      <div className="h-full overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              {parentAccount && (type === "table" || type === "action") && (
                <Button variant="ghost" size="icon" onClick={backToAccount} className="h-7 w-7">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <h3 className="text-sm font-medium">
                {type ? type.charAt(0).toUpperCase() + type.slice(1) + " Details" : "Details"}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleExpanded} title={expanded ? "Collapse panel" : "Expand panel"}>
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={clearContext}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DetailErrorBoundary key={detailKey} fallback={<pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>}>
            {renderDetail()}
          </DetailErrorBoundary>
        </div>
      </div>
    </aside>
  )
}
