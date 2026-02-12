"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

interface Bookmark {
  id: string
  tool_name: string
  label: string
  result: Record<string, any>
  chain_name: string | null
  chain_endpoint: string | null
  created_at: string
}

interface HistoryState {
  bookmarks: Bookmark[]
  addBookmark: (bookmark: { toolName: string; label: string; result: Record<string, any>; chainName?: string; chainEndpoint?: string }) => Promise<void>
  removeBookmark: (id: string) => Promise<void>
  isBookmarked: (toolName: string, label: string) => boolean
  updateBookmarkLabel: (id: string, label: string) => void
  updateBookmarkResult: (id: string, result: Record<string, any>) => void
}

const HistoryContext = createContext<HistoryState | null>(null)

const LS_KEY = "explorer_bookmarks"

function loadLocalBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(bookmarks))
}

export function HistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  const isAuthed = !!user

  // Load bookmarks: from server if authed, from localStorage if not
  useEffect(() => {
    if (isAuthed) {
      const token = localStorage.getItem("auth_token")
      if (!token) return
      fetch("/api/bookmarks", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setBookmarks(data)
        })
        .catch(console.error)
    } else {
      setBookmarks(loadLocalBookmarks())
    }
  }, [isAuthed])

  const addBookmark = useCallback(async (bookmark: { toolName: string; label: string; result: Record<string, any>; chainName?: string; chainEndpoint?: string }) => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      // Server mode
      try {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(bookmark),
        })
        const data = await res.json()
        if (data.id) {
          setBookmarks((prev) => [data, ...prev])
        }
      } catch (e) {
        console.error("Failed to save bookmark:", e)
      }
    } else {
      // localStorage mode
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        tool_name: bookmark.toolName,
        label: bookmark.label,
        result: bookmark.result,
        chain_name: bookmark.chainName || null,
        chain_endpoint: bookmark.chainEndpoint || null,
        created_at: new Date().toISOString(),
      }
      setBookmarks((prev) => {
        const updated = [newBookmark, ...prev]
        saveLocalBookmarks(updated)
        return updated
      })
    }
  }, [])

  const removeBookmark = useCallback(async (id: string) => {
    const token = localStorage.getItem("auth_token")
    if (token) {
      try {
        await fetch(`/api/bookmarks/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (e) {
        console.error("Failed to delete bookmark:", e)
      }
    }
    setBookmarks((prev) => {
      const updated = prev.filter((b) => b.id !== id)
      if (!token) saveLocalBookmarks(updated)
      return updated
    })
  }, [])

  const isBookmarked = useCallback((toolName: string, label: string) => {
    return bookmarks.some((b) => b.tool_name === toolName && b.label === label)
  }, [bookmarks])

  const updateBookmarkResult = useCallback((id: string, result: Record<string, any>) => {
    const token = localStorage.getItem("auth_token")
    setBookmarks((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, result } : b))
      if (!token) saveLocalBookmarks(updated)
      return updated
    })
    if (token) {
      fetch(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ result }),
      }).catch(console.error)
    }
  }, [])

  const updateBookmarkLabel = useCallback((id: string, label: string) => {
    const token = localStorage.getItem("auth_token")
    setBookmarks((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, label } : b))
      if (!token) saveLocalBookmarks(updated)
      return updated
    })
    if (token) {
      fetch(`/api/bookmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label }),
      }).catch(console.error)
    }
  }, [])

  return (
    <HistoryContext.Provider value={{ bookmarks, addBookmark, removeBookmark, isBookmarked, updateBookmarkLabel, updateBookmarkResult }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider")
  return ctx
}
