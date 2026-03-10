"use client"

import { useState, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { isAccountName, isTxId, fetchAccountData, fetchBlockData, fetchTxData } from "@/lib/antelope/lookup"

type DetectedType = "Account" | "Transaction" | "Block" | null

function detectType(input: string): DetectedType {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null
  if (isTxId(trimmed)) return "Transaction"
  if (/^\d+$/.test(trimmed)) return "Block"
  if (isAccountName(trimmed)) return "Account"
  return null
}

export function SidebarSearch() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { endpoint, hyperionEndpoint } = useChain()
  const { setContext } = useDetailContext()

  const detected = detectType(query)

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed || !detected || !endpoint) return

    setLoading(true)
    setError("")

    try {
      if (detected === "Account") {
        const data = await fetchAccountData(trimmed, endpoint)
        setContext("account", data)
      } else if (detected === "Block") {
        const data = await fetchBlockData(trimmed, endpoint)
        setContext("block", data)
      } else if (detected === "Transaction") {
        const data = await fetchTxData(trimmed, endpoint, hyperionEndpoint)
        setContext("transaction", data)
      }
      setQuery("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed")
    } finally {
      setLoading(false)
    }
  }, [query, detected, endpoint, hyperionEndpoint, setContext])

  return (
    <div className="space-y-1">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError("") }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
          placeholder="Search account, tx, block..."
          className="w-full text-xs bg-background border border-border rounded-md pl-2 pr-16 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          disabled={!endpoint || loading}
        />
        <div className="absolute right-1 flex items-center gap-1">
          {detected && !loading && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-normal">
              {detected}
            </Badge>
          )}
          <button
            onClick={handleSubmit}
            disabled={!detected || loading || !endpoint}
            className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors cursor-pointer"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  )
}
