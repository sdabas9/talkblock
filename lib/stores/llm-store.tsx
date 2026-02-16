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

function apiKeyStorageKey(provider: string) {
  return `llm_api_key_${provider}`
}

interface LLMState {
  config: LLMConfig | null
  hasApiKey: boolean
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

  // Load config from localStorage on mount; force BYOK when unauthed
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
    // Without Supabase, built-in mode can't work — force BYOK
    const effectiveMode = !isAuthed && (!mode || mode === "builtin") ? "byok" : mode
    if (effectiveMode) {
      setLLMModeState(effectiveMode)
      localStorage.setItem("llm_mode", effectiveMode)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyBuiltinDefaults = useCallback(() => {
    const defaultModel = DEFAULT_MODELS.chutes[0]
    setConfig({ provider: "chutes", model: defaultModel })
    localStorage.setItem("llm_provider", "chutes")
    localStorage.setItem("llm_model", defaultModel)
    return { llm_provider: "chutes" as const, llm_model: defaultModel }
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
          applyBuiltinDefaults()
        }
      })
      .catch(console.error)
  }, [isAuthed, applyBuiltinDefaults])

  const setLLMMode = useCallback((mode: LLMMode) => {
    setLLMModeState(mode)
    localStorage.setItem("llm_mode", mode)
    const serverPayload: Record<string, unknown> = { llm_mode: mode }
    if (mode === "builtin") {
      Object.assign(serverPayload, applyBuiltinDefaults())
    }
    if (isAuthed) syncToServer(serverPayload)
  }, [isAuthed, syncToServer, applyBuiltinDefaults])

  const setProvider = useCallback((provider: LLMProviderType) => {
    const defaultModel = DEFAULT_MODELS[provider][0]
    setConfig({ provider, model: defaultModel })
    localStorage.setItem("llm_provider", provider)
    localStorage.setItem("llm_model", defaultModel)
    setHasApiKey(!!localStorage.getItem(apiKeyStorageKey(provider)))
    if (isAuthed) syncToServer({ llm_provider: provider, llm_model: defaultModel })
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
    if (!config) return null
    const apiKey = localStorage.getItem(apiKeyStorageKey(config.provider))
    if (!apiKey) return null
    return { provider: config.provider, model: config.model, apiKey }
  }, [llmMode, isAuthed, config])

  const isConfigured = llmMode === "builtin"
    ? !!user
    : !!(config?.provider && config?.model && hasApiKey)

  return (
    <LLMContext.Provider
      value={{
        config,
        hasApiKey,
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
