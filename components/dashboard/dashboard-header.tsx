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
    <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-border">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span>{chainName || "No chain"}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{count} {noun}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Synced {formatAge(lastSyncedAt)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="font-mono text-[10px] uppercase tracking-widest rounded-none"
          disabled={refreshing || refreshable.length === 0}
          onClick={refreshAll}
        >
          <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
      </div>
    </div>
  )
}
