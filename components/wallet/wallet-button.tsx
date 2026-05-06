"use client"

import { useState } from "react"
import { useWallet } from "@/lib/stores/wallet-store"
import { useChain } from "@/lib/stores/chain-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useCredits } from "@/lib/stores/credits-store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Loader2, Coins } from "lucide-react"
import { PurchaseCreditsDialog } from "@/components/billing/purchase-credits-dialog"

export function WalletButton() {
  const { accountName, connecting, error, login, cancelLogin, logout } = useWallet()
  const { chainInfo } = useChain()
  const { user } = useAuth()
  const { freeRemaining, balanceTokens } = useCredits()
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  if (!chainInfo) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Wallet className="h-4 w-4 mr-2" />
        Connect Wallet
      </Button>
    )
  }

  if (accountName) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Wallet className="h-4 w-4 mr-2 text-green-500" />
              {accountName}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {user && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Credits
                </DropdownMenuLabel>
                <div className="px-2 pb-2 text-sm">
                  {freeRemaining > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Free today</span>
                      <span className="font-medium">{freeRemaining}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-medium">{balanceTokens.toLocaleString()}</span>
                  </div>
                </div>
                <DropdownMenuItem onSelect={() => setPurchaseOpen(true)}>
                  <Coins className="h-4 w-4 mr-2" />
                  Buy Credits
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PurchaseCreditsDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
      </>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={connecting ? cancelLogin : login}
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4 mr-2" />
        )}
        {connecting ? "Cancel" : "Connect Wallet"}
      </Button>
      {error && (
        <span className="text-xs text-destructive max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
