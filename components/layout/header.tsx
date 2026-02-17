"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useConversations } from "@/lib/stores/conversation-store"
import { useLLM } from "@/lib/stores/llm-store"
import { useCredits } from "@/lib/stores/credits-store"
import { ChainSelector } from "@/components/chain/chain-selector"
import { LLMSettings } from "@/components/settings/llm-settings"
import { UsageSummary } from "@/components/billing/usage-summary"
import { WalletButton } from "@/components/wallet/wallet-button"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PanelLeft, MessageSquare, Plus, Trash2, LayoutDashboard, Sun, Moon, Settings, Link2, Bot } from "lucide-react"
import { useState, useEffect } from "react"

function useTheme() {
  const [dark, setDark] = useState(true)
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }
  return { dark, toggle }
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
  const { toggleLeft, view, setView } = usePanels()
  const theme = useTheme()
  const { user } = useAuth()
  const { llmMode } = useLLM()
  const { conversations, activeConversationId, setActiveConversation, createConversation, deleteConversation } = useConversations()

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold flex items-center gap-1.5">
          <svg viewBox="0 0 48 48" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8C4 4.686 6.686 2 10 2H38C41.314 2 44 4.686 44 8V32C44 35.314 41.314 38 38 38H28L20 46V38H10C6.686 38 4 35.314 4 32V8Z" fill="#6366f1"/>
            <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M24 10V24M24 24L36 17M24 24L12 17M24 24V38" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
          </svg>
          <span>Talk<span className="font-normal">block</span></span>
        </h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto px-6 pb-6">
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
        <div className="flex items-center border rounded-md overflow-hidden ml-2">
          <Button
            variant={view === "chat" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none h-7 px-2.5 text-xs"
            onClick={() => setView("chat")}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chat
          </Button>
          <Button
            variant={view === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none h-7 px-2.5 text-xs"
            onClick={() => setView("dashboard")}
          >
            <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
            Dashboard
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <UsageIndicator />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chats
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => setActiveConversation(null)}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </DropdownMenuItem>
              {conversations.length > 0 && <DropdownMenuSeparator />}
              {conversations.slice(0, 20).map((conv) => (
                <DropdownMenuItem
                  key={conv.id}
                  className="flex items-center justify-between"
                  onClick={() => setActiveConversation(conv.id)}
                >
                  <span className="truncate text-xs flex-1">
                    {conv.title}
                    {conv.chain_name && (
                      <span className="text-muted-foreground ml-1">({conv.chain_name})</span>
                    )}
                  </span>
                  {activeConversationId === conv.id && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 ml-2" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1 shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <WalletButton />
        <Button variant="ghost" size="icon" onClick={theme.toggle}>
          {theme.dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
