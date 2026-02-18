"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

export type LLMProviderType = "anthropic" | "openai" | "google" | "chutes"
export type LLMMode = "builtin" | "byok"

interface LLMConfig {
  provider: LLMProviderType
  model: string
}

const DEFAULT_MODELS: Record<LLMProviderType, string[]> = {
  anthropic: ["claude-sonnet-4-5-20250929", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  google: ["gemini-2.0-flash", "gemini-2.0-pro"],
  chutes: ["moonshotai/Kimi-K2-Thinking-TEE", "deepseek-ai/DeepSeek-V3-0324-TEE"],
}

export const CHUTES_MODEL_LABELS: Record<string, string> = {
  "deepseek-ai/DeepSeek-V3-0324-TEE": "DeepSeek V3 TEE",
  "moonshotai/Kimi-K2-Thinking-TEE": "Kimi K2 Thinking TEE",
}


export function getModelLabel(model: string): string {
  if (CHUTES_MODEL_LABELS[model]) return CHUTES_MODEL_LABELS[model]
  // Strip org prefix for models like "deepseek-ai/DeepSeek-V3"
  const parts = model.split("/")
  return parts[parts.length - 1]
}

function apiKeyStorageKey(provider: string) {
  return `llm_api_key_${provider}`
}

interface LLMState {
  config: LLMConfig | null
  hasApiKey: boolean
  availableModels: string[]
  isConfigured: boolean
  llmMode: LLMMode
  setLLMMode: (mode: LLMMode) => void
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
  const [llmMode, setLLMModeState] = useState<LLMMode>("builtin")

  const isAuthed = !!user

  // Load config from localStorage on mount
  useEffect(() => {
    const provider = localStorage.getItem("llm_provider") as LLMProviderType | null
    const model = localStorage.getItem("llm_model")
    const mode = localStorage.getItem("llm_mode") as LLMMode | null
    if (provider && model) {
      setConfig({ provider, model })
      setHasApiKey(!!localStorage.getItem(apiKeyStorageKey(provider)))
    }
    // Migrate old single key to per-provider if it exists
    const legacyKey = localStorage.getItem("llm_api_key")
    if (legacyKey && provider) {
      localStorage.setItem(apiKeyStorageKey(provider), legacyKey)
      localStorage.removeItem("llm_api_key")
      setHasApiKey(true)
    }
    if (mode) setLLMModeState(mode)
  }, [])

  // When authed, sync non-key settings from server
  useEffect(() => {
    if (!isAuthed) return
    const token = localStorage.getItem("auth_token")
    if (!token) return
    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const serverMode = data.llm_mode || "builtin"
        setLLMModeState(serverMode)
        localStorage.setItem("llm_mode", serverMode)

        if (data.llm_provider && data.llm_model) {
          setConfig({ provider: data.llm_provider, model: data.llm_model })
          localStorage.setItem("llm_provider", data.llm_provider)
          localStorage.setItem("llm_model", data.llm_model)
          setHasApiKey(!!localStorage.getItem(apiKeyStorageKey(data.llm_provider)))
        } else if (serverMode === "builtin") {
          const defaultModel = DEFAULT_MODELS.chutes[0]
          setConfig({ provider: "chutes", model: defaultModel })
          localStorage.setItem("llm_provider", "chutes")
          localStorage.setItem("llm_model", defaultModel)
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

  const setLLMMode = useCallback((mode: LLMMode) => {
    setLLMModeState(mode)
    localStorage.setItem("llm_mode", mode)
    if (mode === "builtin") {
      const defaultModel = DEFAULT_MODELS.chutes[0]
      setConfig({ provider: "chutes", model: defaultModel })
      localStorage.setItem("llm_provider", "chutes")
      localStorage.setItem("llm_model", defaultModel)
    }
    if (isAuthed) {
      if (mode === "builtin") {
        const defaultModel = DEFAULT_MODELS.chutes[0]
        syncToServer({ llm_mode: mode, llm_provider: "chutes", llm_model: defaultModel })
      } else {
        syncToServer({ llm_mode: mode })
      }
    }
  }, [isAuthed, syncToServer])

  const setProvider = useCallback((provider: LLMProviderType) => {
    const models = DEFAULT_MODELS[provider]
    const newConfig = { provider, model: models[0] }
    setConfig(newConfig)
    localStorage.setItem("llm_provider", provider)
    localStorage.setItem("llm_model", models[0])
    setHasApiKey(!!localStorage.getItem(apiKeyStorageKey(provider)))
    if (isAuthed) syncToServer({ llm_provider: provider, llm_model: models[0] })
  }, [isAuthed, syncToServer])

  const setApiKey = useCallback(async (apiKey: string) => {
    const provider = localStorage.getItem("llm_provider")
    if (!provider) return
    localStorage.setItem(apiKeyStorageKey(provider), apiKey)
    setHasApiKey(!!apiKey)
  }, [])

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

  const getClientConfig = useCallback(() => {
    // In builtin mode, only skip if user is actually authed (Supabase available)
    if (llmMode === "builtin" && isAuthed) return null
    const provider = localStorage.getItem("llm_provider")
    const model = localStorage.getItem("llm_model")
    if (!provider || !model) return null
    const apiKey = localStorage.getItem(apiKeyStorageKey(provider))
    if (!apiKey) return null
    return { provider, model, apiKey }
  }, [llmMode, isAuthed])

  const isConfigured = llmMode === "builtin"
    ? !!user
    : !!(config?.provider && config?.model && hasApiKey)

  return (
    <LLMContext.Provider
      value={{
        config,
        hasApiKey,
        availableModels: config ? DEFAULT_MODELS[config.provider] || [] : [],
        isConfigured,
        llmMode,
        setLLMMode,
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
