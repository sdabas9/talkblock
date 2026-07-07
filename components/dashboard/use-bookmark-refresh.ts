"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { refetchToolData, REFRESHABLE_TOOLS } from "@/lib/antelope/refetch"

export interface RefreshableBookmark {
  id: string
  tool_name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
  chain_endpoint: string | null
}

export function useBookmarkRefresh(bookmark: RefreshableBookmark) {
  const { hyperionEndpoint } = useChain()
  const { updateBookmarkResult } = useHistory()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const canRefresh = REFRESHABLE_TOOLS.has(bookmark.tool_name) && !!bookmark.chain_endpoint

  const handleRefresh = useCallback(async () => {
    if (!bookmark.chain_endpoint || refreshing) return
    setRefreshing(true)
    setRefreshError(null)
    try {
      const newResult = await refetchToolData(
        bookmark.tool_name,
        bookmark.result,
        bookmark.chain_endpoint,
        hyperionEndpoint
      )
      if (!newResult.error) {
        updateBookmarkResult(bookmark.id, newResult)
        setLastRefreshedAt(new Date().toISOString())
      } else {
        setRefreshError(newResult.error)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refresh failed"
      setRefreshError(msg === "Failed to fetch" ? "Chain endpoint unreachable" : msg)
    } finally {
      setRefreshing(false)
    }
  }, [bookmark, hyperionEndpoint, refreshing, updateBookmarkResult])

  // Auto-refresh on mount
  const didAutoRefresh = useRef(false)
  useEffect(() => {
    if (!didAutoRefresh.current && canRefresh) {
      didAutoRefresh.current = true
      handleRefresh()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { canRefresh, refreshing, refreshError, lastRefreshedAt, handleRefresh }
}
