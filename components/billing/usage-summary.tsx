"use client"

import { useCredits } from "@/lib/stores/credits-store"
import { PurchaseCreditsDialog } from "./purchase-credits-dialog"
import { Badge } from "@/components/ui/badge"

export function UsageSummary() {
  const { todayRequestCount, freeRemaining, balanceTokens, todayInputTokens, todayOutputTokens } = useCredits()

  const totalTodayTokens = todayInputTokens + todayOutputTokens

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted p-2.5">
          <div className="text-muted-foreground text-xs">Free requests</div>
          <div className="font-medium mt-0.5">
            {freeRemaining > 0 ? (
              <>{freeRemaining} of 5 remaining</>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400">All used</span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-muted p-2.5">
          <div className="text-muted-foreground text-xs">Credit balance</div>
          <div className="font-medium mt-0.5">
            {balanceTokens > 0 ? (
              <>{Math.round(balanceTokens / 1000)}k tokens</>
            ) : (
              <span className="text-muted-foreground">0</span>
            )}
          </div>
        </div>
      </div>
      {totalTodayTokens > 0 && (
        <div className="text-xs text-muted-foreground">
          Tokens used today: {Math.round(totalTodayTokens / 1000)}k
          <span className="ml-2">(in: {Math.round(todayInputTokens / 1000)}k / out: {Math.round(todayOutputTokens / 1000)}k)</span>
        </div>
      )}
      <PurchaseCreditsDialog />
    </div>
  )
}
