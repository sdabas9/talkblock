"use client"

import { useState } from "react"
import { Bookmark, User, Coins, Activity, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AntelopeClient } from "@/lib/antelope/client"
import { useHistory } from "@/lib/stores/history-store"

interface EmptyStateProps {
  chainName: string | null
  chainEndpoint: string | null
  walletAccount: string | null
}

interface Suggestion {
  id: string
  toolName: string
  title: string
  description: string
  icon: typeof User
  buildLabel: (account: string) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch: (client: AntelopeClient, account: string) => Promise<Record<string, any>>
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: "watch-account",
    toolName: "get_account",
    title: "Watch my account",
    description: "Track balance, RAM, CPU, NET, staking, and more on the dashboard.",
    icon: User,
    buildLabel: (account) => account,
    fetch: async (client, account) => {
      const info = await client.getAccount(account)
      return info as unknown as Record<string, any>
    },
  },
  {
    id: "my-tokens",
    toolName: "get_currency_balance",
    title: "My token balances",
    description: "See your eosio.token balance for the connected chain.",
    icon: Coins,
    buildLabel: (account) => `Balances for ${account}`,
    fetch: async (client, account) => {
      const balances = await client.getCurrencyBalance("eosio.token", account)
      return { account, balances }
    },
  },
  {
    id: "my-activity",
    toolName: "get_actions",
    title: "My recent activity",
    description: "Your latest on-chain actions, refreshed when you load the dashboard.",
    icon: Activity,
    buildLabel: (account) => `Actions for ${account}`,
    fetch: async (_client, _account) => {
      // get_actions needs Hyperion, not RPC; if not available, show graceful error
      throw new Error("Hyperion required for action history; connect a chain with Hyperion to enable")
    },
  },
]

export function EmptyState({ chainName, chainEndpoint, walletAccount }: EmptyStateProps) {
  const { addBookmark } = useHistory()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const handleAdd = async (suggestion: Suggestion) => {
    if (!walletAccount || !chainEndpoint) return
    setBusyId(suggestion.id)
    setErrorId(null)
    try {
      const client = new AntelopeClient(chainEndpoint)
      const result = await suggestion.fetch(client, walletAccount)
      await addBookmark({
        toolName: suggestion.toolName,
        label: suggestion.buildLabel(walletAccount),
        result,
        chainName: chainName || undefined,
        chainEndpoint: chainEndpoint || undefined,
      })
    } catch {
      setErrorId(suggestion.id)
    } finally {
      setBusyId(null)
    }
  }

  if (!walletAccount) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-3">
          <Bookmark className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">No bookmarks yet</h2>
          <p className="text-sm text-muted-foreground">
            Chat with the blockchain and bookmark results to build your dashboard.
          </p>
          <p className="text-xs text-muted-foreground">Connect a wallet to see suggestions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-2 pb-2">
          <Bookmark className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">No bookmarks for {chainName || "this chain"} yet</h2>
          <p className="text-sm text-muted-foreground">Get started with one of these:</p>
        </div>
        <div className="space-y-2">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon
            const busy = busyId === s.id
            const failed = errorId === s.id
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 border border-border rounded-none bg-card hover:bg-muted/30 transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm">{s.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {failed ? "Couldn't load — try again." : s.description}
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleAdd(s)}>
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
