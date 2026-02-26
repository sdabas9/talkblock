"use client"

import { useState, useEffect } from "react"
import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Link2, Bookmark, Trash2, User, Box, FileText, Database, Coins, Shield, Users, FileSignature, ChevronDown, Clock, MessageSquare, LayoutDashboard } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"
import { fetchAccountData } from "@/lib/antelope/lookup"

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
  const { leftOpen, view, setView } = usePanels()
  const { chainInfo, chainName, endpoint, hyperionEndpoint, presets } = useChain()
  const { bookmarks, removeBookmark } = useHistory()
  const { recentAccounts, clearRecents, setContext } = useDetailContext()
  const [chainExpanded, setChainExpanded] = useState(false)
  const [rpcUp, setRpcUp] = useState(false)
  const [hyperionUp, setHyperionUp] = useState(false)
  const [liveInfo, setLiveInfo] = useState(chainInfo)

  // Sync liveInfo when chainInfo changes (e.g. on connect/disconnect)
  useEffect(() => { setLiveInfo(chainInfo) }, [chainInfo])

  // Check endpoint health + refresh chain info locally (no global store update)
  useEffect(() => {
    if (!endpoint) { setRpcUp(false); setHyperionUp(false); return }

    const check = async () => {
      // RPC health + local info refresh
      try {
        const r = await fetch(`${endpoint}/v1/chain/get_info`, { method: "POST", body: "{}", signal: AbortSignal.timeout(5000) })
        setRpcUp(r.ok)
        if (r.ok) {
          const info = await r.json()
          setLiveInfo(info)
        }
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
    }

    check()
    const id = setInterval(check, 300_000)
    return () => clearInterval(id)
  }, [endpoint, hyperionEndpoint])

  const handleBookmarkClick = (bookmark: typeof bookmarks[0]) => {
    window.dispatchEvent(new CustomEvent("bookmark-show", { detail: bookmark }))
  }

  const handleRecentClick = async (accountName: string, recentChainName: string) => {
    // If different chain, resolve endpoint from presets
    let ep = endpoint
    if (recentChainName && recentChainName !== chainName) {
      const preset = presets.find((p: { name: string }) => p.name === recentChainName)
      if (preset) ep = preset.url
    }
    if (!ep) return
    try {
      const data = await fetchAccountData(accountName, ep)
      setContext("account", data)
    } catch {
      // silently fail
    }
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
          {liveInfo ? (
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
                    <span className="font-mono">{liveInfo.head_block_num.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Producer</span>
                    <span className="font-mono">{liveInfo.head_block_producer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chain ID</span>
                    <Badge variant="secondary" className="font-mono text-[9px]">
                      {liveInfo.chain_id.slice(0, 12)}...
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not connected</p>
          )}
        </div>

        <Separator />

        {/* View Toggle — show only the other view */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs justify-start gap-1.5"
          onClick={() => setView(view === "chat" ? "dashboard" : "chat")}
        >
          {view === "chat" ? (
            <><LayoutDashboard className="h-3.5 w-3.5" /> Dashboard</>
          ) : (
            <><MessageSquare className="h-3.5 w-3.5" /> Chat</>
          )}
        </Button>

        {view === "chat" && (
        <>
        <Separator />

        {/* Bookmarks */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bookmark className="h-3 w-3" />
            Bookmarks
          </h3>
          {(() => {
            const chainBookmarks = bookmarks.filter((b) => b.chain_name === chainName)
            return chainBookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookmarks yet</p>
          ) : (
            <div className="space-y-0">
              {chainBookmarks.map((bookmark) => {
                const Icon = TOOL_ICONS[bookmark.tool_name] || FileText
                return (
                  <div key={bookmark.id} className="flex items-center gap-1.5 group">
                    <button
                      className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors text-left truncate flex-1 cursor-pointer"
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
          )
          })()}
        </div>

        {/* Recent Accounts */}
        {(() => {
          const chainRecents = recentAccounts.filter((r) => r.chain_name === chainName)
          return chainRecents.length > 0 && (
        <>
        <Separator />
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span className="flex-1">Recent</span>
            <button
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors normal-case tracking-normal cursor-pointer"
              onClick={clearRecents}
            >
              Clear
            </button>
          </h3>
          <div className="space-y-1">
            {chainRecents.map((r) => (
              <button
                key={`${r.chain_name}-${r.account_name}`}
                className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors text-left truncate w-full cursor-pointer"
                onClick={() => handleRecentClick(r.account_name, r.chain_name)}
              >
                <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{r.account_name}</span>
              </button>
            ))}
          </div>
        </div>
        </>
        )
        })()}
        </>
        )}
      </div>
    </aside>
  )
}
