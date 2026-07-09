"use client"

import { DragEvent } from "react"
import { StatTile, DashboardBookmark } from "./renderers/stat-tile"

interface StatStripProps {
  bookmarks: DashboardBookmark[]
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
  dragId: string | null
  dropTargetId: string | null
}

export function StatStrip({ bookmarks, onDragStart, onDragOver, onDrop, dragId, dropTargetId }: StatStripProps) {
  if (bookmarks.length === 0) return null
  return (
    <div className="flex flex-wrap gap-3 mb-3">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          data-bookmark-id={bookmark.id}
          className={`h-28 w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-[280px] transition-opacity ${
            dragId === bookmark.id ? "opacity-50" : ""
          } ${dropTargetId === bookmark.id ? "ring-1 ring-primary" : ""}`}
        >
          <StatTile
            bookmark={bookmark}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        </div>
      ))}
    </div>
  )
}
