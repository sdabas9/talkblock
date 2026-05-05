"use client"

import { useState, useMemo, DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { DashboardCard } from "./dashboard-card"
import { getCardSize } from "@/lib/dashboard/card-sizes"
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

    const currentIds = orderedBookmarks.map((b) => b.id)
    const dragIndex = currentIds.indexOf(dragId)
    const targetIndex = currentIds.indexOf(targetId)
    if (dragIndex === -1 || targetIndex === -1) return

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
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 [grid-auto-flow:dense]"
          onDragEnd={handleDragEnd}
        >
          {orderedBookmarks.map((bookmark) => {
            const size = getCardSize(bookmark.tool_name)
            const span = size === "wide" ? "lg:col-span-2" : ""
            return (
              <div
                key={bookmark.id}
                data-bookmark-id={bookmark.id}
                className={`transition-opacity ${span} ${dragId === bookmark.id ? "opacity-50 scale-95" : ""} ${
                  dropTargetId === bookmark.id ? "ring-2 ring-primary rounded-xl" : ""
                }`}
              >
                <DashboardCard
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
