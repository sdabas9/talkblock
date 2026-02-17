"use client"

import { useState } from "react"
import { useChain } from "@/lib/stores/chain-store"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, Link2, Link2Off, Check, ChevronRight } from "lucide-react"

function ChainContent() {
  const { chainName, chainInfo, presets, connecting, error, connect } = useChain()
  const [customUrl, setCustomUrl] = useState("")
  const [customHyperion, setCustomHyperion] = useState("")
  const [showCustom, setShowCustom] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm text-muted-foreground">Preset Chains</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {presets.map((chain) => (
            <Button
              key={chain.url}
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={connecting}
              onClick={() => connect(chain.url, chain.name, chain.hyperion)}
            >
              {chainInfo && chainName === chain.name && (
                <Check className="h-3 w-3 mr-1 text-green-500" />
              )}
              {chain.name}
            </Button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {chainInfo && (
        <>
          <Separator />
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Chain ID</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {chainInfo.chain_id.slice(0, 16)}...
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Head Block</span>
              <span>{chainInfo.head_block_num.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Producer</span>
              <span>{chainInfo.head_block_producer}</span>
            </div>
          </div>
        </>
      )}
      <Separator />
      <div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${showCustom ? "rotate-90" : ""}`} />
          Custom Endpoints
        </button>
        {showCustom && (
          <div className="space-y-2 mt-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">RPC Endpoint</Label>
              <Input
                placeholder="https://your-rpc-endpoint.com"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Hyperion Endpoint (optional)</Label>
              <Input
                placeholder="https://your-hyperion-endpoint.com"
                value={customHyperion}
                onChange={(e) => setCustomHyperion(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={() => connect(customUrl, undefined, customHyperion || undefined)}
              disabled={connecting || !customUrl}
              className="w-full"
              size="sm"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ChainSelector({ inline }: { inline?: boolean } = {}) {
  const { chainName, chainInfo } = useChain()
  const [open, setOpen] = useState(false)

  if (inline) return <ChainContent />

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {chainInfo ? (
            <>
              <Link2 className="h-4 w-4 mr-2 text-green-500" />
              {chainName}
            </>
          ) : (
            <>
              <Link2Off className="h-4 w-4 mr-2" />
              No Chain Connected
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to Chain</DialogTitle>
        </DialogHeader>
        <ChainContent />
      </DialogContent>
    </Dialog>
  )
}
