"use client"

import { useState, useMemo, DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { DashboardCard } from "./dashboard-card"
import { Bookmark } from "lucide-react"

export function DashboardView() {
  const { bookmarks } = useHistory()
  const { itemOrder, setItemOrder } = useDashboard()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const orderedBookmarks = useMemo(() => {
    const orderMap = new Map(itemOrder.map((id, i) => [id, i]))
    return [...bookmarks].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity
      const bi = orderMap.get(b.id) ?? Infinity
      if (ai === Infinity && bi === Infinity) return 0
      return ai - bi
    })
  }, [bookmarks, itemOrder])

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

  if (bookmarks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-3">
          <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-lg font-medium text-muted-foreground">No bookmarks yet</h2>
          <p className="text-sm text-muted-foreground">
            Chat with the blockchain and bookmark results to build your dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" onDragEnd={handleDragEnd}>
        {orderedBookmarks.map((bookmark) => (
          <div
            key={bookmark.id}
            data-bookmark-id={bookmark.id}
            className={`transition-opacity ${dragId === bookmark.id ? "opacity-50" : ""} ${
              dropTargetId === bookmark.id ? "ring-2 ring-primary rounded-lg" : ""
            }`}
          >
            <DashboardCard
              bookmark={bookmark}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
