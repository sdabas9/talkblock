"use client"

import { DragEvent } from "react"
import { useHistory } from "@/lib/stores/history-store"
import { useBookmarkRefresh } from "../use-bookmark-refresh"
import { RenameLabel } from "../rename-label"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from "lucide-react"

export interface DashboardBookmark {
  id: string
  tool_name: string
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
  chain_name: string | null
  chain_endpoint: string | null
  created_at: string
}

interface StatTileProps {
  bookmark: DashboardBookmark
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
}

interface TileSpec {
  accent: "value" | "identity" // value → primary top border, identity → chart-2
  value: string
  sub?: string
  bars?: { cpu: number; net: number; ram: number }
}

function pct(used?: number, max?: number): number {
  if (!used || !max || max <= 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTileSpec(toolName: string, result: Record<string, any>): TileSpec {
  switch (toolName) {
    case "get_currency_balance": {
      const balances: string[] = result.balances || []
      const extra = balances.length > 1 ? ` · +${balances.length - 1} more` : ""
      return {
        accent: "value",
        value: balances[0] || "—",
        sub: `${result.account || ""}${extra}`,
      }
    }
    case "get_creator":
      return {
        accent: "identity",
        value: String(result.creator || "?"),
        sub: result.timestamp
          ? `created ${new Date(String(result.timestamp)).toLocaleDateString()}`
          : String(result.account || ""),
      }
    case "get_key_accounts": {
      const names: string[] = result.account_names || []
      return {
        accent: "identity",
        value: `${names.length} account${names.length === 1 ? "" : "s"}`,
        sub: names[0] || "none",
      }
    }
    case "get_account": {
      // Tolerate both the normalized refetch shape and the raw RPC shape
      // that EmptyState suggestions store (core_liquid_balance, ram_usage…).
      const balance = result.balance ?? result.core_liquid_balance ?? "0"
      const ram = result.ram ?? { used: result.ram_usage, quota: result.ram_quota }
      const cpu = result.cpu ?? result.cpu_limit ?? {}
      const net = result.net ?? result.net_limit ?? {}
      return {
        accent: "identity",
        value: String(result.account_name || "?"),
        sub: String(balance),
        bars: {
          cpu: pct(Number(cpu.used), Number(cpu.max)),
          net: pct(Number(net.used), Number(net.max)),
          ram: pct(Number(ram.used), Number(ram.quota)),
        },
      }
    }
    default:
      return { accent: "value", value: "—" }
  }
}

function ResourceBars({ bars }: { bars: { cpu: number; net: number; ram: number } }) {
  const items: Array<[string, number]> = [["CPU", bars.cpu], ["NET", bars.net], ["RAM", bars.ram]]
  return (
    <div className="flex gap-2 mt-auto pt-1">
      {items.map(([name, value]) => (
        <div key={name} className="flex-1 min-w-0">
          <div className="h-1 bg-muted">
            <div
              className={value >= 90 ? "h-full bg-destructive" : "h-full bg-primary"}
              style={{ width: `${value}%` }}
            />
          </div>
          <div className="font-mono text-[8px] text-muted-foreground mt-0.5">{name} {value}%</div>
        </div>
      ))}
    </div>
  )
}

export function StatTile({ bookmark, onDragStart, onDragOver, onDrop }: StatTileProps) {
  const { removeBookmark } = useHistory()
  const { canRefresh, refreshing, refreshError, handleRefresh } = useBookmarkRefresh(bookmark)
  const spec = getTileSpec(bookmark.tool_name, bookmark.result)
  const accentClass = spec.accent === "value" ? "border-t-primary" : "border-t-chart-2"

  return (
    <div
      draggable
      data-bookmark-id={bookmark.id}
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, bookmark.id)}
      className={`group h-full flex flex-col border border-border ${accentClass} border-t-2 rounded-none bg-card p-3 cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <RenameLabel
          bookmarkId={bookmark.id}
          baseLabel={bookmark.label}
          className="flex-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
        />
        {refreshError && (
          <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" title={refreshError} />
        )}
        {canRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => removeBookmark(bookmark.id)}
        >
          <X className="h-2.5 w-2.5" />
        </Button>
      </div>
      <div className="font-mono text-xl tabular-nums truncate leading-tight mt-0.5">{spec.value}</div>
      {spec.sub && (
        <div className="font-mono text-[10px] text-muted-foreground truncate">{spec.sub}</div>
      )}
      {spec.bars && <ResourceBars bars={spec.bars} />}
    </div>
  )
}
