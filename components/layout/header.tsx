"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { ChainSelector } from "@/components/chain/chain-selector"
import { Button } from "@/components/ui/button"
import { PanelLeft, PanelRight, Settings, Wallet } from "lucide-react"

export function Header() {
  const { toggleLeft, toggleRight } = usePanels()

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleLeft}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Antelope Explorer</h1>
      </div>
      <div className="flex items-center gap-2">
        <ChainSelector />
        <Button variant="outline" size="sm" id="wallet-connect">
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
        <Button variant="ghost" size="icon" id="settings-btn">
          <Settings className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleRight}>
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
