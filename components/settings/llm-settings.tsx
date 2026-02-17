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
import { Settings, Save, Loader2, Check } from "lucide-react"
import { useState } from "react"

const BYOK_PROVIDERS: { value: LLMProviderType; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
  { value: "chutes", label: "Chutes" },
]

function BuiltinPanel() {
  const { config, setModel, getModelsForProvider, isConfigured } = useLLM()
  const { user } = useAuth()

  return (
    <div className="space-y-4">
      {!user && (
        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Connect a wallet to use the built-in AI. 5 free requests per day included.
        </div>
      )}

      <div>
        <Label>Model</Label>
        <Select
          value={config?.model || ""}
          onValueChange={setModel}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {getModelsForProvider("chutes").map((m) => (
              <SelectItem key={m} value={m}>
                {getModelLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        {isConfigured ? (
          <Badge variant="default" className="bg-green-600">Active</Badge>
        ) : (
          <Badge variant="secondary">Connect wallet</Badge>
        )}
      </div>
    </div>
  )
}

function BYOKPanel() {
  const { config, hasApiKey, isConfigured, setProvider, setApiKey, setModel, getModelsForProvider } = useLLM()
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return
    setSaving(true)
    try {
      await setApiKey(apiKeyInput.trim())
      setApiKeyInput("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const provider = config?.provider || ""

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v as LLMProviderType)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {BYOK_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {provider && (
        <>
          <div>
            <Label>API Key</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="password"
                placeholder={hasApiKey ? "Key saved securely" : "Enter your API key"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleSaveKey}
                disabled={!apiKeyInput.trim() || saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Stored locally in your browser. Never sent to our server.
            </p>
          </div>
          <div>
            <Label>Model</Label>
            <Select value={config?.model || ""} onValueChange={setModel}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getModelsForProvider(provider as LLMProviderType).map((m) => (
                  <SelectItem key={m} value={m}>
                    {getModelLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        {isConfigured ? (
          <Badge variant="default" className="bg-green-600">Configured</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </div>
    </div>
  )
}

function LLMContent() {
  const { llmMode, setLLMMode } = useLLM()

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border overflow-hidden">
        <button
          className={`flex-1 py-1.5 px-3 text-sm font-medium transition-colors ${
            llmMode === "builtin"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted text-muted-foreground"
          }`}
          onClick={() => setLLMMode("builtin")}
        >
          Built-in (Free)
        </button>
        <button
          className={`flex-1 py-1.5 px-3 text-sm font-medium transition-colors ${
            llmMode === "byok"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted text-muted-foreground"
          }`}
          onClick={() => setLLMMode("byok")}
        >
          Bring Your Own Key
        </button>
      </div>

      {llmMode === "builtin" ? <BuiltinPanel /> : <BYOKPanel />}
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
