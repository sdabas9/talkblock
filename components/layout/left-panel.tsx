"use client"

import { useState, useEffect } from "react"
import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Link2, Bookmark, Trash2, User, Box, FileText, Database, Coins, Shield, Users, FileSignature, ChevronDown } from "lucide-react"

const TOOL_ICONS: Record<string, React.ElementType> = {
  get_account: User,
  get_block: Box,
  get_transaction: FileText,
  get_table_rows: Database,
  get_currency_balance: Coins,
  get_abi: Shield,
  get_producers: Users,
  build_transaction: FileSignature,
}

export function LeftPanel() {
  const { leftOpen, view } = usePanels()
  const { chainInfo, chainName, endpoint, hyperionEndpoint, refreshInfo } = useChain()
  const { bookmarks, removeBookmark } = useHistory()
  const [chainExpanded, setChainExpanded] = useState(false)
  const [rpcUp, setRpcUp] = useState(false)
  const [hyperionUp, setHyperionUp] = useState(false)

  // Check endpoint health + refresh chain info periodically
  useEffect(() => {
    if (!endpoint) { setRpcUp(false); setHyperionUp(false); return }

    const check = async () => {
      // RPC health
      try {
        const r = await fetch(`${endpoint}/v1/chain/get_info`, { method: "POST", body: "{}", signal: AbortSignal.timeout(5000) })
        setRpcUp(r.ok)
      } catch { setRpcUp(false) }

      // Hyperion health
      if (hyperionEndpoint) {
        try {
          const r = await fetch(`${hyperionEndpoint}/v2/health`, { signal: AbortSignal.timeout(5000) })
          setHyperionUp(r.ok)
        } catch { setHyperionUp(false) }
      } else {
        setHyperionUp(false)
      }

      refreshInfo()
    }

    check()
    const id = setInterval(check, 300_000)
    return () => clearInterval(id)
  }, [endpoint, hyperionEndpoint, refreshInfo])

  const handleBookmarkClick = (bookmark: typeof bookmarks[0]) => {
    window.dispatchEvent(new CustomEvent("bookmark-show", { detail: bookmark }))
  }

  return (
    <aside
      className={cn(
        "border-r bg-muted/30 transition-all duration-300 overflow-hidden shrink-0",
        "max-md:absolute max-md:z-20 max-md:h-full",
        leftOpen ? "w-60" : "w-0"
      )}
    >
      <div className="h-full overflow-y-auto p-4 space-y-4">
        {/* Chain Info */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Link2 className="h-3 w-3" />
            Chain
          </h3>
          {chainInfo ? (
            <div className="text-xs">
              <button
                onClick={() => setChainExpanded((v) => !v)}
                className="flex items-center gap-1.5 w-full hover:text-primary transition-colors"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    rpcUp && hyperionUp && "bg-green-500",
                    rpcUp && !hyperionUp && "bg-yellow-500",
                    !rpcUp && hyperionUp && "bg-orange-500",
                    !rpcUp && !hyperionUp && "bg-red-500",
                  )}
                  title={
                    rpcUp && hyperionUp ? "RPC + Hyperion connected"
                    : rpcUp ? "RPC only (no Hyperion)"
                    : hyperionUp ? "Hyperion only (no RPC)"
                    : "Disconnected"
                  }
                />
                <span className="font-medium truncate flex-1 text-left">{chainName}</span>
                <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", chainExpanded && "rotate-180")} />
              </button>
              {chainExpanded && (
                <div className="space-y-1.5 mt-2 pt-2 border-t border-border/50">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Head Block</span>
                    <span className="font-mono">{chainInfo.head_block_num.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Producer</span>
                    <span className="font-mono">{chainInfo.head_block_producer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain ID</span>
                    <Badge variant="secondary" className="font-mono text-[9px]">
                      {chainInfo.chain_id.slice(0, 12)}...
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not connected</p>
          )}
        </div>

        {view === "chat" && (
        <>
        <Separator />

        {/* Bookmarks */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bookmark className="h-3 w-3" />
            Bookmarks
          </h3>
          {bookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookmarks yet</p>
          ) : (
            <div className="space-y-1">
              {bookmarks.map((bookmark) => {
                const Icon = TOOL_ICONS[bookmark.tool_name] || FileText
                return (
                  <div key={bookmark.id} className="flex items-center gap-2 group">
                    <button
                      className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors text-left truncate flex-1"
                      onClick={() => handleBookmarkClick(bookmark)}
                    >
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{bookmark.label}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => removeBookmark(bookmark.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </aside>
  )
}
