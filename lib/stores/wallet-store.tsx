"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useChain } from "@/lib/stores/chain-store"

// Wharfkit types - import dynamically since they're browser-only
interface WalletSession {
  actor: string
  permission: string
  chain: { id: string }
  transact: (args: { actions: any[] }) => Promise<any>
}

interface WalletState {
  session: WalletSession | null
  accountName: string | null
  connecting: boolean
  error: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  transact: (actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => Promise<any>
}

const WalletContext = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { endpoint, chainInfo } = useChain()
  const [session, setSession] = useState<WalletSession | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionKit, setSessionKit] = useState<any>(null)

  // Initialize SessionKit when chain changes
  useEffect(() => {
    if (!endpoint || !chainInfo) {
      setSessionKit(null)
      return
    }

    const init = async () => {
      try {
        const { SessionKit } = await import("@wharfkit/session")
        const { WebRenderer } = await import("@wharfkit/web-renderer")
        const { WalletPluginAnchor } = await import("@wharfkit/wallet-plugin-anchor")

        const kit = new SessionKit({
          appName: "Antelope Explorer",
          chains: [
            {
              id: chainInfo.chain_id,
              url: endpoint,
            },
          ],
          ui: new WebRenderer(),
          walletPlugins: [new WalletPluginAnchor()],
        })

        setSessionKit(kit)

        // Try to restore previous session
        try {
          const restored = await kit.restore()
          if (restored) {
            setSession({
              actor: String(restored.actor),
              permission: String(restored.permission),
              chain: { id: String(restored.chain.id) },
              transact: (args: any) => restored.transact(args),
            })
            setAccountName(String(restored.actor))
          }
        } catch {
          // No previous session, that's fine
        }
      } catch (e) {
        console.error("Failed to initialize SessionKit:", e)
      }
    }

    init()
  }, [endpoint, chainInfo])

  const login = useCallback(async () => {
    if (!sessionKit) {
      setError("Connect to a chain first")
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const result = await sessionKit.login()
      const s = result.session
      setSession({
        actor: String(s.actor),
        permission: String(s.permission),
        chain: { id: String(s.chain.id) },
        transact: (args: any) => s.transact(args),
      })
      setAccountName(String(s.actor))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed")
    } finally {
      setConnecting(false)
    }
  }, [sessionKit])

  const logout = useCallback(async () => {
    if (sessionKit && session) {
      try {
        await sessionKit.logout()
      } catch {
        // Ignore logout errors
      }
    }
    setSession(null)
    setAccountName(null)
  }, [sessionKit, session])

  const transact = useCallback(async (actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => {
    if (!session) throw new Error("No wallet connected")

    const formattedActions = actions.map((action) => ({
      account: action.account,
      name: action.name,
      authorization: [{ actor: session.actor, permission: session.permission }],
      data: action.data,
    }))

    const result = await session.transact({ actions: formattedActions })
    return result
  }, [session])

  return (
    <WalletContext.Provider
      value={{ session, accountName, connecting, error, login, logout, transact }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within WalletProvider")
  return ctx
}
