"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { REFRESHABLE_TOOLS, refetchToolData, formatAge } from "@/lib/antelope/refetch"
import { useHistory } from "@/lib/stores/history-store"

interface DashboardHeaderProps {
  chainName: string | null
  chainEndpoint: string | null
  hyperionEndpoint: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookmarks: Array<{ id: string; tool_name: string; result: Record<string, any>; chain_endpoint: string | null }>
}

export function DashboardHeader({ chainName, chainEndpoint, hyperionEndpoint, bookmarks }: DashboardHeaderProps) {
  const { updateBookmarkResult } = useHistory()
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toISOString())
  const [, force] = useState(0)

  // Re-render every 5s so the "last synced" label updates
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [])

  const refreshable = bookmarks.filter(
    (b) => REFRESHABLE_TOOLS.has(b.tool_name) && (b.chain_endpoint || chainEndpoint),
  )

  const refreshAll = async () => {
    if (refreshing || refreshable.length === 0) return
    setRefreshing(true)
    try {
      await Promise.all(
        refreshable.map(async (b) => {
          try {
            const fresh = await refetchToolData(
              b.tool_name,
              b.result,
              b.chain_endpoint || chainEndpoint || "",
              hyperionEndpoint,
            )
            updateBookmarkResult(b.id, fresh)
          } catch {
            // Per-card failure is acceptable — the card just stays on its old data.
          }
        }),
      )
      setLastSyncedAt(new Date().toISOString())
    } finally {
      setRefreshing(false)
    }
  }

  const count = bookmarks.length
  const noun = count === 1 ? "bookmark" : "bookmarks"

  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/60">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{chainName || "No chain"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{count} {noun}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Last synced {formatAge(lastSyncedAt)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={refreshing || refreshable.length === 0}
          onClick={refreshAll}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
      </div>
    </div>
  )
}
