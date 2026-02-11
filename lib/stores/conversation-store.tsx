"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

interface Conversation {
  id: string
  title: string
  chain_name: string | null
  chain_endpoint: string | null
  created_at: string
  updated_at: string
}

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  createConversation: (chainName?: string, chainEndpoint?: string) => Promise<string>
  setActiveConversation: (id: string | null) => void
  deleteConversation: (id: string) => Promise<void>
  saveMessage: (conversationId: string, role: string, parts: unknown[]) => Promise<void>
  loadMessages: (conversationId: string) => Promise<Array<{ role: string; parts: unknown[] }>>
  refreshConversations: () => Promise<void>
}

const ConversationContext = createContext<ConversationState | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversation] = useState<string | null>(null)

  const getToken = () => localStorage.getItem("auth_token") || ""

  const refreshConversations = useCallback(async () => {
    const token = getToken()
    if (!token) return
    const res = await fetch("/api/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (Array.isArray(data)) setConversations(data)
  }, [])

  useEffect(() => {
    if (user) refreshConversations()
    else {
      setConversations([])
      setActiveConversation(null)
    }
  }, [user, refreshConversations])

  const createConversation = useCallback(async (chainName?: string, chainEndpoint?: string) => {
    const token = getToken()
    if (!token) return "" // No-op without auth
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: "New conversation", chainName, chainEndpoint }),
    })
    const data = await res.json()
    setConversations((prev) => [data, ...prev])
    setActiveConversation(data.id)
    return data.id
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    const token = getToken()
    await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConversationId === id) setActiveConversation(null)
  }, [activeConversationId])

  const saveMessage = useCallback(async (conversationId: string, role: string, parts: unknown[]) => {
    const token = getToken()
    if (!token || !conversationId) return // No-op without auth
    await fetch(`/api/conversations/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, parts }),
    })
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    const token = getToken()
    const res = await fetch(`/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    return data.messages || []
  }, [])

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeConversationId,
        createConversation,
        setActiveConversation,
        deleteConversation,
        saveMessage,
        loadMessages,
        refreshConversations,
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversations() {
  const ctx = useContext(ConversationContext)
  if (!ctx) throw new Error("useConversations must be used within ConversationProvider")
  return ctx
}
