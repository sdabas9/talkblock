"use client"

import { DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useBookmarkRefresh } from "./use-bookmark-refresh"
import { RenameLabel } from "./rename-label"
import { DashboardRenderer } from "./renderers"
import { getTypeLabel } from "@/lib/dashboard/modules"
import { formatAge } from "@/lib/antelope/refetch"
import { Button } from "@/components/ui/button"
import { GripVertical, RefreshCw, X } from "lucide-react"
import { DashboardBookmark } from "./renderers/stat-tile"

interface DashboardPanelProps {
  bookmark: DashboardBookmark
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
}

export function DashboardPanel({ bookmark, onDragStart, onDragOver, onDrop }: DashboardPanelProps) {
  const { removeBookmark } = useHistory()
  const { canRefresh, refreshing, refreshError, lastRefreshedAt, handleRefresh } = useBookmarkRefresh(bookmark)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, bookmark.id)}
      className="group h-full flex flex-col border border-border rounded-none bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border shrink-0">
        <span className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
          {getTypeLabel(bookmark.tool_name)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">·</span>
        <RenameLabel
          bookmarkId={bookmark.id}
          baseLabel={bookmark.label}
          className="flex-1 min-w-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        />
        {bookmark.chain_name && (
          <span className="font-mono text-[9px] uppercase text-muted-foreground/60 shrink-0">
            {bookmark.chain_name.split(" ")[0]}
          </span>
        )}
        {canRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => removeBookmark(bookmark.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Content — fixed module height, inner scroll */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <DashboardRenderer toolName={bookmark.tool_name} result={bookmark.result} />
      </div>

      {/* Footer — age + status dot (dot replaces the old error banner) */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-t border-border shrink-0">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            refreshing
              ? "bg-primary animate-pulse"
              : refreshError
                ? "bg-destructive"
                : "bg-muted-foreground/40"
          }`}
          title={refreshError ?? undefined}
        />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
          {lastRefreshedAt ? `Refreshed ${formatAge(lastRefreshedAt)}` : `Saved ${formatAge(bookmark.created_at)}`}
        </span>
        {refreshError && (
          <span className="font-mono text-[9px] uppercase text-destructive truncate" title={refreshError}>
            · {refreshError}
          </span>
        )}
      </div>
    </div>
  )
}
