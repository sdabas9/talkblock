"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

type ContextType = "account" | "block" | "transaction" | "table" | "action" | null

interface ContextState {
  type: ContextType
  data: any
  setContext: (type: ContextType, data: any) => void
  clearContext: () => void
}

const DetailContext = createContext<ContextState | null>(null)

export function ContextProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<ContextType>(null)
  const [data, setData] = useState<any>(null)

  const setContext = useCallback((t: ContextType, d: any) => {
    setType(t)
    setData(d)
  }, [])

  const clearContext = useCallback(() => {
    setType(null)
    setData(null)
  }, [])

  return (
    <DetailContext.Provider value={{ type, data, setContext, clearContext }}>
      {children}
    </DetailContext.Provider>
  )
}

export function useDetailContext() {
  const ctx = useContext(DetailContext)
  if (!ctx) throw new Error("useDetailContext must be used within ContextProvider")
  return ctx
}
