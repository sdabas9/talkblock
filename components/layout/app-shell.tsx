"use client"

import { PanelProvider } from "@/lib/stores/panel-store"
import { ChainProvider } from "@/lib/stores/chain-store"
import { LLMProvider } from "@/lib/stores/llm-store"
import { WalletProvider } from "@/lib/stores/wallet-store"
import { Header } from "./header"
import { LeftPanel } from "./left-panel"
import { RightPanel } from "./right-panel"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChainProvider>
      <WalletProvider>
        <LLMProvider>
          <PanelProvider>
            <div className="h-screen flex flex-col">
              <Header />
              <div className="flex-1 flex overflow-hidden">
                <LeftPanel />
                <main className="flex-1 flex flex-col overflow-hidden">
                  {children}
                </main>
                <RightPanel />
              </div>
            </div>
          </PanelProvider>
        </LLMProvider>
      </WalletProvider>
    </ChainProvider>
  )
}
