"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AccountDetail } from "@/components/context/account-detail"
import { BlockDetail } from "@/components/context/block-detail"
import { TransactionDetail } from "@/components/context/transaction-detail"

export function RightPanel() {
  const { rightOpen, closeRight } = usePanels()
  const { type, data, clearContext } = useDetailContext()

  const handleClose = () => {
    closeRight()
    clearContext()
  }

  const renderDetail = () => {
    if (!type || !data) {
      return (
        <p className="text-sm text-muted-foreground">
          Click on any item in the chat to view details here.
        </p>
      )
    }
    switch (type) {
      case "account":
        return <AccountDetail data={data} />
      case "block":
        return <BlockDetail data={data} />
      case "transaction":
        return <TransactionDetail data={data} />
      default:
        return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    }
  }

  return (
    <aside
      className={cn(
        "border-l bg-muted/30 transition-all duration-300 overflow-hidden",
        "max-md:absolute max-md:right-0 max-md:z-20 max-md:h-full max-md:w-full",
        rightOpen ? "w-[400px] max-md:w-full" : "w-0"
      )}
    >
      <div className="h-full overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">
              {type ? type.charAt(0).toUpperCase() + type.slice(1) + " Details" : "Details"}
            </h3>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {renderDetail()}
        </div>
      </div>
    </aside>
  )
}
