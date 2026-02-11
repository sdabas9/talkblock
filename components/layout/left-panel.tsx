"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Link2, Star, Clock, Trash2, Search } from "lucide-react"

export function LeftPanel() {
  const { leftOpen } = usePanels()
  const { chainInfo, chainName } = useChain()
  const { recentSearches, bookmarks, removeBookmark, clearHistory } = useHistory()

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
            <Star className="h-3 w-3" />
            Bookmarks
          </h3>
          {bookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookmarks yet</p>
          ) : (
            <div className="space-y-1">
              {bookmarks.map((account) => (
                <div key={account} className="flex items-center justify-between group">
                  <button className="text-xs hover:text-primary transition-colors text-left truncate flex-1">
                    {account}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeBookmark(account)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Recent Searches */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Recent
            </h3>
            {recentSearches.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={clearHistory}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {recentSearches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent searches</p>
          ) : (
            <div className="space-y-1">
              {recentSearches.slice(0, 10).map((query, i) => (
                <button
                  key={i}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors text-left truncate w-full flex items-center gap-1.5"
                >
                  <Search className="h-3 w-3 shrink-0" />
                  <span className="truncate">{query}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
