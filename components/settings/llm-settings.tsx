"use client"

import { useLLM, LLMProviderType, getModelLabel } from "@/lib/stores/llm-store"
import { useAuth } from "@/lib/stores/auth-store"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Settings, Save, Loader2, Check, Lock, Pencil } from "lucide-react"
import { useState } from "react"

const ALL_PROVIDERS: { value: string; label: string; description: string }[] = [
  { value: "builtin", label: "Built-in", description: "5 requests/day, wallet required" },
  { value: "anthropic", label: "Anthropic", description: "Claude Sonnet, Opus, Haiku" },
  { value: "openai", label: "OpenAI", description: "GPT-4o, o1, o3-mini" },
  { value: "google", label: "Google", description: "Gemini 2.0 Flash, Pro" },
  { value: "chutes", label: "Chutes", description: "DeepSeek, Kimi (your key)" },
]

function LLMContent() {
  const { llmMode, setLLMMode, config, hasApiKey, isConfigured, setProvider, setApiKey, setModel, getModelsForProvider } = useLLM()
  const { user } = useAuth()
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [modelSaved, setModelSaved] = useState(false)
  const [editingKey, setEditingKey] = useState(false)

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return
    setSaving(true)
    try {
      await setApiKey(apiKeyInput.trim())
      setApiKeyInput("")
      setEditingKey(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleModelChange = (model: string) => {
    setModel(model)
    setModelSaved(true)
    setTimeout(() => setModelSaved(false), 2000)
  }

  const handleProviderSelect = (value: string) => {
    if (value === "builtin") {
      setLLMMode("builtin")
    } else {
      setLLMMode("byok")
      setProvider(value as LLMProviderType)
    }
    setModelSaved(false)
    setEditingKey(false)
    setApiKeyInput("")
  }

  // Determine the active provider key for highlighting
  const activeProvider = llmMode === "builtin" ? "builtin" : (config?.provider || "")
  const needsApiKey = llmMode === "byok"
  const models = llmMode === "builtin"
    ? getModelsForProvider("chutes")
    : config?.provider ? getModelsForProvider(config.provider) : []

  return (
    <div className="space-y-4">
      {/* Provider grid */}
      <div>
        <Label className="text-xs text-muted-foreground">Provider</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {ALL_PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => handleProviderSelect(p.value)}
              className={`text-left rounded-lg border-2 px-3 py-2 transition-colors ${
                activeProvider === p.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {activeProvider === p.value && <Check className="h-3 w-3 text-primary shrink-0" />}
                <span className="text-sm font-medium">{p.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* API key (only for BYOK providers) */}
      {needsApiKey && config?.provider && (
        <div>
          <Label className="text-xs">API Key</Label>
          {hasApiKey && !editingKey ? (
            <div className="flex items-center justify-between mt-1 h-8 rounded-md border bg-muted/50 px-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3 text-green-500" />
                <span>Key saved securely</span>
              </div>
              <button
                onClick={() => setEditingKey(true)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-2.5 w-2.5" />
                Change
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-1">
              <Input
                type="password"
                placeholder="Enter your API key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="h-8 text-xs"
                autoFocus={editingKey}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSaveKey}
                disabled={!apiKeyInput.trim() || saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Stored locally in your browser. Never sent to our server.
          </p>
        </div>
      )}

      {/* Model selector */}
      {models.length > 0 && (llmMode === "builtin" ? user : config?.provider) && (
        <div>
          <Label className="text-xs">Model</Label>
          <Select value={config?.model || ""} onValueChange={handleModelChange}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {getModelLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modelSaved && (
            <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" /> Model updated
            </p>
          )}
        </div>
      )}

      {/* Status summary */}
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
        {isConfigured ? (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span>
              <span className="font-medium">{getModelLabel(config?.model || "")}</span>
              <span className="text-muted-foreground"> via {llmMode === "builtin" ? "Built-in" : config?.provider}</span>
            </span>
          </div>
        ) : llmMode === "builtin" && !user ? (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500 shrink-0" />
            <span className="text-muted-foreground">Connect a wallet to use the built-in AI</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500 shrink-0" />
            <span className="text-muted-foreground">{needsApiKey && !hasApiKey ? "Enter an API key to activate" : "Select a provider"}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function LLMSettings({ trigger, inline }: { trigger?: React.ReactNode; inline?: boolean } = {}) {
  const { isConfigured } = useLLM()

  if (inline) return <LLMContent />

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="relative">
            <Settings className="h-4 w-4" />
            {isConfigured && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LLM Settings</DialogTitle>
        </DialogHeader>
        <LLMContent />
      </DialogContent>
    </Dialog>
  )
}
