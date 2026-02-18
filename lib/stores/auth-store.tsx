"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface AuthUser {
  id: string
  accountName: string
  chainId: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (accountName: string, chainId: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem("auth_user")
    const token = localStorage.getItem("auth_token")
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored)
        setUser(parsed)
        const supabase = createClient()
        supabase?.auth.setSession({ access_token: token, refresh_token: "" })
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (accountName: string, chainId: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountName, chainId }),
    })

    if (!res.ok) {
      // Supabase auth is optional — silently skip if unavailable
      return
    }

    const { token, user: userData } = await res.json()

    const supabase = createClient()
    if (supabase) {
      await supabase.auth.setSession({ access_token: token, refresh_token: "" })
    }

    localStorage.setItem("auth_token", token)
    localStorage.setItem("auth_user", JSON.stringify(userData))
    document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
    document.cookie = `auth_user=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    document.cookie = "auth_token=; path=/; max-age=0"
    document.cookie = "auth_user=; path=/; max-age=0"
    setUser(null)
    const supabase = createClient()
    supabase?.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
