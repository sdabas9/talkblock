"use client"

import { PanelProvider } from "@/lib/stores/panel-store"
import { AuthProvider } from "@/lib/stores/auth-store"
import { ChainProvider } from "@/lib/stores/chain-store"
import { LLMProvider } from "@/lib/stores/llm-store"
import { WalletProvider } from "@/lib/stores/wallet-store"
import { ConversationProvider } from "@/lib/stores/conversation-store"
import { ContextProvider } from "@/lib/stores/context-store"
import { HistoryProvider } from "@/lib/stores/history-store"
import { DashboardProvider } from "@/lib/stores/dashboard-store"
import { CreditsProvider } from "@/lib/stores/credits-store"
import { Header } from "./header"
import { LeftPanel } from "./left-panel"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
    <ChainProvider>
      <WalletProvider>
        <LLMProvider>
          <CreditsProvider>
          <ConversationProvider>
          <ContextProvider>
            <HistoryProvider>
            <DashboardProvider>
              <PanelProvider>
              <div className="h-screen flex flex-col">
                <Header />
                <div className="flex-1 flex overflow-hidden relative">
                  <LeftPanel />
                  <main className="flex-1 flex flex-col overflow-hidden">
                    {children}
                  </main>
                </div>
              </div>
              </PanelProvider>
            </DashboardProvider>
            </HistoryProvider>
          </ContextProvider>
          </ConversationProvider>
          </CreditsProvider>
        </LLMProvider>
      </WalletProvider>
    </ChainProvider>
    </AuthProvider>
  )
}
