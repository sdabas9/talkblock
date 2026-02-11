"use client"

import { useWallet } from "@/lib/stores/wallet-store"
import { useChain } from "@/lib/stores/chain-store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Loader2 } from "lucide-react"

export function WalletButton() {
  const { accountName, connecting, error, login, cancelLogin, logout } = useWallet()
  const { chainInfo } = useChain()

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Wallet className="h-4 w-4 mr-2 text-green-500" />
            {accountName}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
