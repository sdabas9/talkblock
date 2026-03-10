"use client"

import { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef, ReactNode } from "react"

type ContextType = "account" | "block" | "transaction" | "table" | "action" | null

export type RecentAccount = {
  account_name: string
  chain_name: string
  timestamp: number
}

const RECENT_KEY = "recent_accounts"
const MAX_RECENTS = 10

function loadRecents(): RecentAccount[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
  } catch {
    return []
  }
}

interface PreviousContext {
  type: ContextType
  data: any
}

interface ContextState {
  type: ContextType
  data: any
  setContext: (type: ContextType, data: any, options?: { expand?: boolean }) => void
  clearContext: () => void
  parentAccount: any
  backToAccount: () => void
  previousContext: PreviousContext | null
  goBack: () => void
  recentAccounts: RecentAccount[]
  clearRecents: () => void
  expanded: boolean
  toggleExpanded: () => void
}

const DetailContext = createContext<ContextState | null>(null)

export function ContextProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<ContextType>(null)
  const [data, setData] = useState<any>(null)
  const [parentAccount, setParentAccount] = useState<any>(null)
  const [previousContext, setPreviousContext] = useState<PreviousContext | null>(null)
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([])
  const [expanded, setExpanded] = useState(false)

  // Set expanded before first paint when opening a shared link
  useLayoutEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get("account") || p.get("tx") || p.get("block")
      || (p.get("table") && p.get("code"))
      || (p.get("action") && p.get("code"))) {
      setExpanded(true)
    }
  }, [])
  const typeRef = useRef<ContextType>(null)
  const dataRef = useRef<any>(null)

  useEffect(() => { setRecentAccounts(loadRecents()) }, [])

  const setContext = useCallback((t: ContextType, d: any, options?: { expand?: boolean }) => {
    // Save parent account when navigating from account to table/action
    if (typeRef.current === "account" && dataRef.current && (t === "table" || t === "action")) {
      setParentAccount(dataRef.current)
    }
    if (t === "account") {
      setParentAccount(null)
    }

    // Save previous context for back navigation (block→tx, etc.)
    // Skip for account→table/action (handled by parentAccount) and fresh navigations
    const isAccountSubNav = typeRef.current === "account" && (t === "table" || t === "action")
    if (typeRef.current && dataRef.current && typeRef.current !== t && !isAccountSubNav) {
      setPreviousContext({ type: typeRef.current, data: dataRef.current })
    } else if (!isAccountSubNav) {
      setPreviousContext(null)
    }

    typeRef.current = t
    dataRef.current = d
    setType(t)
    setData(d)
    if (options?.expand) setExpanded(true)

    if (t === "account" && d?.account_name) {
      const chainName = localStorage.getItem("antelope_chain_name") || ""
      setRecentAccounts((prev) => {
        const deduped = prev.filter(
          (r) => !(r.account_name === d.account_name && r.chain_name === chainName)
        )
        const next = [{ account_name: d.account_name, chain_name: chainName, timestamp: Date.now() }, ...deduped].slice(0, MAX_RECENTS)
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
        return next
      })
    }
  }, [])

  const clearContext = useCallback(() => {
    typeRef.current = null
    dataRef.current = null
    setType(null)
    setData(null)
    setParentAccount(null)
    setPreviousContext(null)
    setExpanded(false)
    document.documentElement.classList.remove("shared-link")
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const backToAccount = useCallback(() => {
    setParentAccount((prev: any) => {
      if (!prev) return prev
      typeRef.current = "account"
      dataRef.current = prev
      setType("account")
      setData(prev)
      return null
    })
  }, [])

  const goBack = useCallback(() => {
    setPreviousContext((prev) => {
      if (!prev) return prev
      typeRef.current = prev.type
      dataRef.current = prev.data
      setType(prev.type)
      setData(prev.data)
      return null
    })
  }, [])

  const clearRecents = useCallback(() => {
    setRecentAccounts([])
    localStorage.removeItem(RECENT_KEY)
  }, [])

  return (
    <DetailContext.Provider value={{ type, data, setContext, clearContext, parentAccount, backToAccount, previousContext, goBack, recentAccounts, clearRecents, expanded, toggleExpanded }}>
      {children}
    </DetailContext.Provider>
  )
}

export function useDetailContext() {
  const ctx = useContext(DetailContext)
  if (!ctx) throw new Error("useDetailContext must be used within ContextProvider")
  return ctx
}
