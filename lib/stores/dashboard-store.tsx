"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"

interface DashboardState {
  itemOrder: string[]
  customLabels: Record<string, string>
  setItemOrder: (order: string[]) => void
  setCustomLabel: (id: string, label: string) => void
  removeCustomLabel: (id: string) => void
}

const DashboardContext = createContext<DashboardState | null>(null)

const LS_KEY = "explorer_dashboard"

interface StoredDashboard {
  itemOrder: string[]
  customLabels: Record<string, string>
}

function loadFromStorage(): StoredDashboard {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        itemOrder: Array.isArray(parsed.itemOrder) ? parsed.itemOrder : [],
        customLabels: parsed.customLabels && typeof parsed.customLabels === "object" ? parsed.customLabels : {},
      }
    }
  } catch {}
  return { itemOrder: [], customLabels: {} }
}

function saveToStorage(data: StoredDashboard) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [itemOrder, setItemOrderState] = useState<string[]>([])
  const [customLabels, setCustomLabelsState] = useState<Record<string, string>>({})

  useEffect(() => {
    const stored = loadFromStorage()
    setItemOrderState(stored.itemOrder)
    setCustomLabelsState(stored.customLabels)
  }, [])

  const setItemOrder = useCallback((order: string[]) => {
    setItemOrderState(order)
    setCustomLabelsState((labels) => {
      saveToStorage({ itemOrder: order, customLabels: labels })
      return labels
    })
  }, [])

  const setCustomLabel = useCallback((id: string, label: string) => {
    setCustomLabelsState((prev) => {
      const updated = { ...prev, [id]: label }
      setItemOrderState((order) => {
        saveToStorage({ itemOrder: order, customLabels: updated })
        return order
      })
      return updated
    })
  }, [])

  const removeCustomLabel = useCallback((id: string) => {
    setCustomLabelsState((prev) => {
      const { [id]: _, ...rest } = prev
      setItemOrderState((order) => {
        saveToStorage({ itemOrder: order, customLabels: rest })
        return order
      })
      return rest
    })
  }, [])

  return (
    <DashboardContext.Provider value={{ itemOrder, customLabels, setItemOrder, setCustomLabel, removeCustomLabel }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider")
  return ctx
}
