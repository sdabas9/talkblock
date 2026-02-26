"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useLLM } from "@/lib/stores/llm-store"
import { useCredits } from "@/lib/stores/credits-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { ChainSelector } from "@/components/chain/chain-selector"
import { LLMSettings } from "@/components/settings/llm-settings"
import { UsageSummary } from "@/components/billing/usage-summary"
import { WalletButton } from "@/components/wallet/wallet-button"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PanelLeft, Sun, Moon, SunMoon, Settings, Link2, Bot } from "lucide-react"
import { useState, useEffect } from "react"

type Theme = "light" | "dusk" | "dim" | "dark"
const THEME_CYCLE: Theme[] = ["light", "dusk", "dim", "dark"]
const THEME_LABELS: Record<Theme, string> = {
  light: "Light", dusk: "Dusk", dim: "Dim", dark: "Dark",
}
const DARK_CLASSES: Theme[] = ["dusk", "dim", "dark"]

function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark")
  useEffect(() => {
    const el = document.documentElement
    const found = DARK_CLASSES.find((c) => el.classList.contains(c))
    setTheme((found as Theme) || "light")
  }, [])
  const cycle = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setTheme(next)
    document.documentElement.classList.remove(...DARK_CLASSES)
    if (next !== "light") document.documentElement.classList.add(next)
    localStorage.setItem("theme", next)
  }
  return { theme, cycle, label: THEME_LABELS[theme] }
}

function UsageIndicator() {
  const { user } = useAuth()
  const { llmMode } = useLLM()
  const { freeRemaining, balanceTokens } = useCredits()

  if (!user || llmMode !== "builtin") return null

  return (
    <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-muted">
      {freeRemaining > 0 ? (
        <>{freeRemaining} free left</>
      ) : balanceTokens > 0 ? (
        <>{Math.round(balanceTokens / 1000)}k tokens</>
      ) : (
        <span className="text-yellow-600 dark:text-yellow-400">No credits</span>
      )}
    </span>
  )
}

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { toggleLeft, setView } = usePanels()
  const { clearContext } = useDetailContext()
  const theme = useTheme()
  const { user } = useAuth()
  const { llmMode } = useLLM()

  const goHome = () => {
    clearContext()
    setView("chat")
  }

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-2">
        <button onClick={goHome} className="text-lg font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer" title="Go to chat">
          <svg viewBox="0 0 48 48" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8C4 4.686 6.686 2 10 2H38C41.314 2 44 4.686 44 8V32C44 35.314 41.314 38 38 38H28L20 46V38H10C6.686 38 4 35.314 4 32V8Z" fill="#6366f1"/>
            <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M24 10V24M24 24L36 17M24 24L12 17M24 24V38" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
          </svg>
          <span>Talk<span className="font-normal">block</span></span>
        </button>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 dark:bg-zinc-900">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-6 min-h-[420px]">
              <Tabs defaultValue="chain">
                <TabsList className="w-full">
                  <TabsTrigger value="chain" className="flex-1 gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Chain
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex-1 gap-1.5">
                    <Bot className="h-3.5 w-3.5" />
                    AI
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="chain" className="mt-4">
                  <ChainSelector inline />
                </TabsContent>
                <TabsContent value="ai" className="mt-4 space-y-6">
                  <LLMSettings inline />
                  {user && llmMode === "builtin" && (
                    <>
                      <Separator />
                      <section>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Usage & Credits</h3>
                        <UsageSummary />
                      </section>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" size="icon" onClick={toggleLeft}>
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <UsageIndicator />
        <WalletButton />
        <Button variant="ghost" size="sm" onClick={theme.cycle} title={`Theme: ${theme.label}`} className="gap-1.5 px-2">
          {theme.theme === "light" ? <Sun className="h-4 w-4" /> : theme.theme === "dark" ? <Moon className="h-4 w-4" /> : <SunMoon className="h-4 w-4" />}
          <span className="text-xs hidden sm:inline">{theme.label}</span>
        </Button>
      </div>
    </header>
  )
}
