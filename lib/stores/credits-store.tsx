"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"

interface CreditTransaction {
  type: "deposit" | "usage"
  tlos_amount: number | null
  tx_hash: string | null
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  model: string | null
  token_units_delta: number
  balance_after: number
  created_at: string
}

interface CreditsState {
  balanceTokens: number
  totalDepositedTlos: number
  todayRequestCount: number
  freeRemaining: number
  todayInputTokens: number
  todayOutputTokens: number
  recentTransactions: CreditTransaction[]
  appWalletAccount: string
  loading: boolean
  refresh: () => Promise<void>
}

const CreditsContext = createContext<CreditsState | null>(null)

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { chainInfo } = useChain()
  const { accountName } = useWallet()
  const [balanceTokens, setBalanceTokens] = useState(0)
  const [totalDepositedTlos, setTotalDepositedTlos] = useState(0)
  const [todayRequestCount, setTodayRequestCount] = useState(0)
  const [freeRemaining, setFreeRemaining] = useState(5)
  const [todayInputTokens, setTodayInputTokens] = useState(0)
  const [todayOutputTokens, setTodayOutputTokens] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<CreditTransaction[]>([])
  const [appWalletAccount, setAppWalletAccount] = useState("")
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const chainId = chainInfo?.chain_id
    if (!chainId || !accountName) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ chainId, accountName })
      const res = await fetch(`/api/credits?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setBalanceTokens(data.balance_tokens ?? 0)
      setTotalDepositedTlos(data.total_deposited_tlos ?? 0)
      setTodayRequestCount(data.today?.request_count ?? 0)
      setFreeRemaining(data.today?.free_remaining ?? 5)
      setTodayInputTokens(data.today?.total_input_tokens ?? 0)
      setTodayOutputTokens(data.today?.total_output_tokens ?? 0)
      setRecentTransactions(data.recent_transactions ?? [])
      setAppWalletAccount(data.app_wallet_account ?? "")
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [chainInfo?.chain_id, accountName])

  // Fetch on mount and when chain/account changes
  useEffect(() => {
    if (chainInfo?.chain_id && accountName) refresh()
  }, [chainInfo?.chain_id, accountName, refresh])

  return (
    <CreditsContext.Provider
      value={{
        balanceTokens,
        totalDepositedTlos,
        todayRequestCount,
        freeRemaining,
        todayInputTokens,
        todayOutputTokens,
        recentTransactions,
        appWalletAccount,
        loading,
        refresh,
      }}
    >
      {children}
    </CreditsContext.Provider>
  )
}

export function useCredits() {
  const ctx = useContext(CreditsContext)
  if (!ctx) throw new Error("useCredits must be used within CreditsProvider")
  return ctx
}
