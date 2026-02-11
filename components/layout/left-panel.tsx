"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Link2, Bookmark, Trash2, User, Box, FileText, Database, Coins, Shield, Users, FileSignature } from "lucide-react"

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

function buildQuery(toolName: string, result: Record<string, any>): string {
  switch (toolName) {
    case "get_account": return `Look up account ${result.account_name}`
    case "get_block": return `Show me block ${result.block_num || result.id}`
    case "get_transaction": return `Show transaction ${(result.id || "").slice(0, 16)}`
    case "get_table_rows": return `Show table rows for ${result.code || ""}:${result.table || ""} scope ${result.scope || ""}`
    case "get_currency_balance": return `Check token balances for ${result.account || ""}`
    case "get_abi": return `Show ABI for ${result.account_name || ""}`
    case "get_producers": return `Show block producers`
    case "build_transaction": {
      const actions = result.actions || []
      const desc = result.description || ""
      if (desc) return `Build a transaction to ${desc}`
      if (actions.length === 1) return `Build a ${actions[0].name} transaction on ${actions[0].account} with data ${JSON.stringify(actions[0].data)}`
      return `Build a transaction with ${actions.length} actions: ${JSON.stringify(actions)}`
    }
    default: return `Look up ${result.label || toolName}`
  }
}

export function LeftPanel() {
  const { leftOpen } = usePanels()
  const { chainInfo, chainName } = useChain()
  const { bookmarks, removeBookmark } = useHistory()

  const handleBookmarkClick = (bookmark: typeof bookmarks[0]) => {
    const query = buildQuery(bookmark.tool_name, bookmark.result)
    window.dispatchEvent(new CustomEvent("bookmark-query", { detail: query }))
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
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium truncate ml-2">{chainName}</span>
              </div>
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
          ) : (
            <p className="text-xs text-muted-foreground">Not connected</p>
          )}
        </div>

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
                    {bookmark.chain_name && (
                      <Badge variant="outline" className="text-[8px] shrink-0">
                        {bookmark.chain_name.split(" ")[0]}
                      </Badge>
                    )}
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
      </div>
    </aside>
  )
}
