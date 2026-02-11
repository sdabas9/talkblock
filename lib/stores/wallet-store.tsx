"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react"
import { useChain } from "@/lib/stores/chain-store"
import { useAuth } from "@/lib/stores/auth-store"

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
  cancelLogin: () => void
  logout: () => Promise<void>
  transact: (actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => Promise<any>
}

const WalletContext = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { endpoint, chainInfo } = useChain()
  const auth = useAuth()
  const [session, setSession] = useState<WalletSession | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionKit, setSessionKit] = useState<any>(null)
  const abortRef = useRef(false)

  // Initialize SessionKit when chain changes — logout previous session
  useEffect(() => {
    setSession(null)
    setAccountName(null)
    auth.logout()

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
          appName: "Talkblock",
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

        // Try to restore previous session (with timeout)
        try {
          const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
          const restored = await Promise.race([kit.restore(), timeout])
          if (restored) {
            setSession({
              actor: String(restored.actor),
              permission: String(restored.permission),
              chain: { id: String(restored.chain.id) },
              transact: (args: any) => restored.transact(args),
            })
            setAccountName(String(restored.actor))
            // Re-authenticate so bookmarks/conversations load from DB
            if (chainInfo?.chain_id) {
              auth.login(String(restored.actor), chainInfo.chain_id).catch(console.error)
            }
          }
        } catch {
          // No previous session, that's fine
        }
      } catch (e) {
        console.error("Failed to initialize SessionKit:", e)
      }
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, chainInfo])

  const cancelLogin = useCallback(() => {
    abortRef.current = true
    setConnecting(false)
    setError(null)
  }, [])

  const login = useCallback(async () => {
    if (!sessionKit) {
      setError("Connect to a chain first")
      return
    }
    abortRef.current = false
    setConnecting(true)
    setError(null)
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Wallet connection timed out. Make sure Anchor wallet is installed.")), 30000)
      )
      const result = await Promise.race([sessionKit.login(), timeout]) as any
      if (abortRef.current || !result?.session) {
        setConnecting(false)
        return
      }
      const s = result.session
      setSession({
        actor: String(s.actor),
        permission: String(s.permission),
        chain: { id: String(s.chain.id) },
        transact: (args: any) => s.transact(args),
      })
      setAccountName(String(s.actor))
      if (chainInfo?.chain_id) {
        auth.login(String(s.actor), chainInfo.chain_id).catch(console.error)
      }
    } catch (e: any) {
      if (abortRef.current) return
      const msg = e?.message || String(e) || "Login failed"
      if (!msg.toLowerCase().includes("cancel")) {
        setError(msg)
      }
    }
    setConnecting(false)
  }, [sessionKit, chainInfo, auth])

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
    auth.logout()
  }, [sessionKit, session, auth])

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
      value={{ session, accountName, connecting, error, login, cancelLogin, logout, transact }}
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
