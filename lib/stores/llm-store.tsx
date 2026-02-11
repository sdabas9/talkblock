"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

export type LLMProviderType = "anthropic" | "openai" | "google"

interface LLMConfig {
  provider: LLMProviderType
  model: string
}

const DEFAULT_MODELS: Record<LLMProviderType, string[]> = {
  anthropic: ["claude-sonnet-4-5-20250929", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  google: ["gemini-2.0-flash", "gemini-2.0-pro"],
}

interface LLMState {
  config: LLMConfig | null
  hasApiKey: boolean
  availableModels: string[]
  isConfigured: boolean
  setProvider: (provider: LLMProviderType) => void
  setApiKey: (key: string) => Promise<void>
  setModel: (model: string) => void
  getModelsForProvider: (provider: LLMProviderType) => string[]
  getClientConfig: () => { provider: string; model: string; apiKey: string } | null
}

const LLMContext = createContext<LLMState | null>(null)

export function LLMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)

  const isAuthed = !!user

  // Load config from localStorage on mount (always the client-side source of truth)
  useEffect(() => {
    const provider = localStorage.getItem("llm_provider") as LLMProviderType | null
    const model = localStorage.getItem("llm_model")
    const key = localStorage.getItem("llm_api_key")
    if (provider && model) {
      setConfig({ provider, model })
    }
    setHasApiKey(!!key)
  }, [])

  // When authed, also sync from server (server may have settings from another session)
  useEffect(() => {
    if (!isAuthed) return
    const token = localStorage.getItem("auth_token")
    if (!token) return
    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.llm_provider && data.llm_model) {
          setConfig({ provider: data.llm_provider, model: data.llm_model })
          localStorage.setItem("llm_provider", data.llm_provider)
          localStorage.setItem("llm_model", data.llm_model)
        }
        if (data.has_api_key) {
          setHasApiKey(true)
        }
      })
      .catch(console.error)
  }, [isAuthed])

  const syncToServer = useCallback(async (updates: Record<string, unknown>) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      })
    } catch {
      // Server sync failed silently — localStorage is still the source of truth
    }
  }, [])

  const setProvider = useCallback((provider: LLMProviderType) => {
    const models = DEFAULT_MODELS[provider]
    const newConfig = { provider, model: models[0] }
    setConfig(newConfig)
    localStorage.setItem("llm_provider", provider)
    localStorage.setItem("llm_model", models[0])
    if (isAuthed) syncToServer({ llm_provider: provider, llm_model: models[0] })
  }, [isAuthed, syncToServer])

  const setApiKey = useCallback(async (apiKey: string) => {
    localStorage.setItem("llm_api_key", apiKey)
    setHasApiKey(!!apiKey)
    if (isAuthed) syncToServer({ llm_api_key: apiKey })
  }, [isAuthed, syncToServer])

  const setModel = useCallback((model: string) => {
    if (!config) return
    const newConfig = { ...config, model }
    setConfig(newConfig)
    localStorage.setItem("llm_model", model)
    if (isAuthed) syncToServer({ llm_model: model })
  }, [config, isAuthed, syncToServer])

  const getModelsForProvider = useCallback((provider: LLMProviderType) => {
    return DEFAULT_MODELS[provider]
  }, [])

  // Returns client-side LLM config (for chat requests without auth token)
  const getClientConfig = useCallback(() => {
    const provider = localStorage.getItem("llm_provider")
    const model = localStorage.getItem("llm_model")
    const apiKey = localStorage.getItem("llm_api_key")
    if (!provider || !model || !apiKey) return null
    return { provider, model, apiKey }
  }, [])

  return (
    <LLMContext.Provider
      value={{
        config,
        hasApiKey,
        availableModels: config ? DEFAULT_MODELS[config.provider] : [],
        isConfigured: !!(config?.provider && config?.model && hasApiKey),
        setProvider,
        setApiKey,
        setModel,
        getModelsForProvider,
        getClientConfig,
      }}
    >
      {children}
    </LLMContext.Provider>
  )
}

export function useLLM() {
  const ctx = useContext(LLMContext)
  if (!ctx) throw new Error("useLLM must be used within LLMProvider")
  return ctx
}
