"use client"

import { useLLM, LLMProviderType } from "@/lib/stores/llm-store"
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

const PROVIDERS: { value: LLMProviderType; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
]

function LLMContent() {
  const { config, hasApiKey, isConfigured, setProvider, setApiKey, setModel, getModelsForProvider } = useLLM()
  const { user } = useAuth()
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

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <Select
          value={config?.provider || ""}
          onValueChange={(v) => setProvider(v as LLMProviderType)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {config?.provider && (
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
              {user ? "Stored securely on server. Never exposed to the browser after saving." : "Stored locally in your browser. Connect a wallet to save securely on server."}
            </p>
          </div>
          <div>
            <Label>Model</Label>
            <Select value={config.model} onValueChange={setModel}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getModelsForProvider(config.provider).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
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
