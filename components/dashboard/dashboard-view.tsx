"use client"

import { useState, useMemo, DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { DashboardPanel } from "./dashboard-panel"
import { StatStrip } from "./stat-strip"
import { getModule } from "@/lib/dashboard/modules"
import { DashboardHeader } from "./dashboard-header"
import { EmptyState } from "./empty-state"

export function DashboardView() {
  const { bookmarks } = useHistory()
  const { itemOrder, setItemOrder } = useDashboard()
  const { chainName, endpoint, hyperionEndpoint } = useChain()
  const { accountName: walletAccount } = useWallet()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const chainBookmarks = useMemo(
    () => bookmarks.filter((b) => b.chain_name === chainName),
    [bookmarks, chainName],
  )

  const orderedBookmarks = useMemo(() => {
    const orderMap = new Map(itemOrder.map((id, i) => [id, i]))
    return [...chainBookmarks].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity
      const bi = orderMap.get(b.id) ?? Infinity
      if (ai === Infinity && bi === Infinity) return 0
      return ai - bi
    })
  }, [chainBookmarks, itemOrder])

  // Zone split: tiles go to the stat strip, everything else to the module grid
  const tileBookmarks = useMemo(
    () => orderedBookmarks.filter((b) => getModule(b.tool_name) === "tile"),
    [orderedBookmarks],
  )
  const panelBookmarks = useMemo(
    () => orderedBookmarks.filter((b) => getModule(b.tool_name) !== "tile"),
    [orderedBookmarks],
  )

  const zoneOf = (id: string): "strip" | "grid" | null => {
    const bm = chainBookmarks.find((b) => b.id === id)
    if (!bm) return null
    return getModule(bm.tool_name) === "tile" ? "strip" : "grid"
  }

  const handleDragStart = (e: DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const target = (e.currentTarget as HTMLElement).dataset.bookmarkId
    if (target && target !== dragId) {
      setDropTargetId(target)
    }
  }

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault()
    setDropTargetId(null)
    if (!dragId || dragId === targetId) return
    // Reordering is constrained within a zone (tile↔tile, panel↔panel)
    if (zoneOf(dragId) !== zoneOf(targetId)) {
      setDragId(null)
      return
    }

    const currentIds = orderedBookmarks.map((b) => b.id)
    const dragIndex = currentIds.indexOf(dragId)
    const targetIndex = currentIds.indexOf(targetId)
    if (dragIndex === -1 || targetIndex === -1) {
      setDragId(null)
      return
    }

    const newOrder = [...currentIds]
    newOrder.splice(dragIndex, 1)
    newOrder.splice(targetIndex, 0, dragId)
    setItemOrder(newOrder)
    setDragId(null)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDropTargetId(null)
  }

  if (chainBookmarks.length === 0) {
    return (
      <EmptyState
        chainName={chainName}
        chainEndpoint={endpoint}
        walletAccount={walletAccount}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DashboardHeader
        chainName={chainName}
        chainEndpoint={endpoint}
        hyperionEndpoint={hyperionEndpoint}
        bookmarks={orderedBookmarks}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6 terminal-grid-bg" onDragEnd={handleDragEnd}>
        <StatStrip
          bookmarks={tileBookmarks}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          dragId={dragId}
          dropTargetId={dropTargetId}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 auto-rows-[5.5rem] gap-3 [grid-auto-flow:dense]">
          {panelBookmarks.map((bookmark) => {
            const wide = getModule(bookmark.tool_name) === "wide"
            const span = wide
              ? "md:col-span-2 xl:col-span-4 row-span-3"
              : "md:col-span-2 xl:col-span-2 row-span-3"
            return (
              <div
                key={bookmark.id}
                data-bookmark-id={bookmark.id}
                className={`min-h-0 transition-opacity ${span} ${dragId === bookmark.id ? "opacity-50" : ""} ${
                  dropTargetId === bookmark.id ? "ring-1 ring-primary" : ""
                }`}
              >
                <DashboardPanel
                  bookmark={bookmark}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
