"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { AntelopeClient, ChainInfo } from "@/lib/antelope/client"

const PRESET_CHAINS = [
  { name: "EOS Mainnet", url: "https://eos.greymass.com" },
  { name: "Jungle4 Testnet", url: "https://jungle4.greymass.com" },
  { name: "WAX Mainnet", url: "https://wax.greymass.com" },
  { name: "Telos Mainnet", url: "https://telos.greymass.com" },
  { name: "FIO Mainnet", url: "https://fio.greymass.com" },
  { name: "Libre", url: "https://libre.greymass.com" },
]

interface ChainState {
  endpoint: string | null
  chainInfo: ChainInfo | null
  chainName: string | null
  client: AntelopeClient | null
  presets: typeof PRESET_CHAINS
  connecting: boolean
  error: string | null
  connect: (endpoint: string, name?: string) => Promise<void>
  disconnect: () => void
}

const ChainContext = createContext<ChainState | null>(null)

export function ChainProvider({ children }: { children: ReactNode }) {
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null)
  const [chainName, setChainName] = useState<string | null>(null)
  const [client, setClient] = useState<AntelopeClient | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async (url: string, name?: string) => {
    setConnecting(true)
    setError(null)
    try {
      const c = new AntelopeClient(url)
      const info = await c.getInfo()
      setEndpoint(url)
      setChainInfo(info)
      setChainName(name || url)
      setClient(c)
      localStorage.setItem("antelope_endpoint", url)
      localStorage.setItem("antelope_chain_name", name || url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect")
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setEndpoint(null)
    setChainInfo(null)
    setChainName(null)
    setClient(null)
    localStorage.removeItem("antelope_endpoint")
    localStorage.removeItem("antelope_chain_name")
  }, [])

  return (
    <ChainContext.Provider
      value={{
        endpoint, chainInfo, chainName, client,
        presets: PRESET_CHAINS, connecting, error,
        connect, disconnect,
      }}
    >
      {children}
    </ChainContext.Provider>
  )
}

export function useChain() {
  const ctx = useContext(ChainContext)
  if (!ctx) throw new Error("useChain must be used within ChainProvider")
  return ctx
}
