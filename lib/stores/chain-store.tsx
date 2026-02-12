"use client"

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react"
import { AntelopeClient, ChainInfo } from "@/lib/antelope/client"

const PRESET_CHAINS = [
  { name: "EOS Mainnet", url: "https://eos.greymass.com", hyperion: "https://eos.hyperion.eosrio.io" },
  { name: "Jungle4 Testnet", url: "https://jungle4.greymass.com", hyperion: "https://jungle.eosusa.io" },
  { name: "WAX Mainnet", url: "https://wax.greymass.com", hyperion: "https://wax.eosrio.io" },
  { name: "Telos Mainnet", url: "https://telos.greymass.com", hyperion: "https://mainnet.telos.net" },
  { name: "FIO Mainnet", url: "https://fio.greymass.com", hyperion: "https://fio.cryptolions.io" },
  { name: "Libre", url: "https://libre.greymass.com", hyperion: "https://libre.eosusa.io" },
]

interface ChainState {
  endpoint: string | null
  hyperionEndpoint: string | null
  chainInfo: ChainInfo | null
  chainName: string | null
  client: AntelopeClient | null
  presets: typeof PRESET_CHAINS
  connecting: boolean
  error: string | null
  connect: (endpoint: string, name?: string, hyperion?: string) => Promise<void>
  disconnect: () => void
  refreshInfo: () => Promise<void>
}

const ChainContext = createContext<ChainState | null>(null)

export function ChainProvider({ children }: { children: ReactNode }) {
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [hyperionEndpoint, setHyperionEndpoint] = useState<string | null>(null)
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null)
  const [chainName, setChainName] = useState<string | null>(null)
  const [client, setClient] = useState<AntelopeClient | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async (url: string, name?: string, hyperion?: string) => {
    setConnecting(true)
    setError(null)
    try {
      const c = new AntelopeClient(url)
      const info = await c.getInfo()
      setEndpoint(url)
      setChainInfo(info)
      setChainName(name || url)
      setClient(c)
      // Resolve Hyperion endpoint: explicit param > preset lookup > none
      const resolvedHyperion = hyperion || PRESET_CHAINS.find((p) => p.url === url)?.hyperion || null
      setHyperionEndpoint(resolvedHyperion)
      localStorage.setItem("antelope_endpoint", url)
      localStorage.setItem("antelope_chain_name", name || url)
      if (resolvedHyperion) {
        localStorage.setItem("antelope_hyperion", resolvedHyperion)
      } else {
        localStorage.removeItem("antelope_hyperion")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect")
    } finally {
      setConnecting(false)
    }
  }, [])

  // Auto-restore chain from localStorage on mount (set by login page)
  useEffect(() => {
    const savedEndpoint = localStorage.getItem("antelope_endpoint")
    const savedName = localStorage.getItem("antelope_chain_name")
    const savedHyperion = localStorage.getItem("antelope_hyperion")
    if (savedEndpoint) {
      connect(savedEndpoint, savedName || undefined, savedHyperion || undefined)
    }
  }, [connect])

  const refreshInfo = useCallback(async () => {
    if (!client) return
    try {
      const info = await client.getInfo()
      setChainInfo(info)
    } catch {
      // silently ignore refresh errors
    }
  }, [client])

  const disconnect = useCallback(() => {
    setEndpoint(null)
    setHyperionEndpoint(null)
    setChainInfo(null)
    setChainName(null)
    setClient(null)
    localStorage.removeItem("antelope_endpoint")
    localStorage.removeItem("antelope_chain_name")
    localStorage.removeItem("antelope_hyperion")
  }, [])

  const value = useMemo(() => ({
    endpoint, hyperionEndpoint, chainInfo, chainName, client,
    presets: PRESET_CHAINS, connecting, error,
    connect, disconnect, refreshInfo,
  }), [endpoint, hyperionEndpoint, chainInfo, chainName, client, connecting, error, connect, disconnect, refreshInfo])

  return (
    <ChainContext.Provider value={value}>
      {children}
    </ChainContext.Provider>
  )
}

export function useChain() {
  const ctx = useContext(ChainContext)
  if (!ctx) throw new Error("useChain must be used within ChainProvider")
  return ctx
}
