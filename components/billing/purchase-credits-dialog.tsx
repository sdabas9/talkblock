"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Check, AlertCircle, Coins, Wallet } from "lucide-react"
import { useWallet } from "@/lib/stores/wallet-store"
import { useCredits } from "@/lib/stores/credits-store"
import { useChain } from "@/lib/stores/chain-store"

const PRESET_AMOUNTS = [1, 5, 10]

const TELOS_CHAIN_ID = "4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11"
const VAULTA_CHAIN_ID = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906"

interface PaymentTokenOption {
  symbol: string
  contract: string
  // Display rate (must match app_config.credits_per_<symbol> server-side; the
  // server's value is authoritative for crediting, this is just for the receipt UI).
  creditsPerUnit: number
}

interface PaymentChainOption {
  key: "telos" | "vaulta"
  label: string
  chainId: string
  rpcUrl: string
  tokens: PaymentTokenOption[]
}

const PAYMENT_CHAINS: PaymentChainOption[] = [
  {
    key: "telos",
    label: "Telos",
    chainId: TELOS_CHAIN_ID,
    rpcUrl: "https://telos.greymass.com",
    tokens: [{ symbol: "TLOS", contract: "eosio.token", creditsPerUnit: 50 }],
  },
  {
    key: "vaulta",
    label: "Vaulta",
    chainId: VAULTA_CHAIN_ID,
    rpcUrl: "https://eos.greymass.com",
    tokens: [
      { symbol: "A", contract: "core.vaulta", creditsPerUnit: 250 },
      { symbol: "EOS", contract: "eosio.token", creditsPerUnit: 250 },
    ],
  },
]

const KNOWN_CHAINS: { label: string; chainId: string }[] = [
  { label: "EOS Mainnet", chainId: VAULTA_CHAIN_ID },
  { label: "Jungle4 Testnet", chainId: "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d" },
  { label: "WAX Mainnet", chainId: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4" },
  { label: "Telos Mainnet", chainId: TELOS_CHAIN_ID },
  { label: "FIO Mainnet", chainId: "21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a044a31" },
  { label: "Libre", chainId: "38b1d7815474d0c60683ecbea321d723e83f5da6ae5f1c1f9fecc69d9ba96571" },
]

type PurchaseState = "idle" | "signing" | "verifying" | "success" | "error"

interface PaymentSession {
  actor: string
  permission: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transact: (args: any) => Promise<any>
}

export function PurchaseCreditsDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { session: appSession } = useWallet()
  const { refresh, appWalletAccount } = useCredits()
  const { chainInfo } = useChain()
  const [open, setOpen] = useState(false)

  // Selected payment chain + token
  const [paymentChainKey, setPaymentChainKey] = useState<"telos" | "vaulta">("telos")
  const paymentChain = PAYMENT_CHAINS.find((c) => c.key === paymentChainKey)!
  const [paymentSymbol, setPaymentSymbol] = useState<string>(paymentChain.tokens[0].symbol)
  const paymentToken = paymentChain.tokens.find((t) => t.symbol === paymentSymbol) ?? paymentChain.tokens[0]

  const [amount, setAmount] = useState<number>(1)
  const [customAmount, setCustomAmount] = useState("")
  const [state, setState] = useState<PurchaseState>("idle")
  const [error, setError] = useState("")
  const [creditsCredited, setCreditsCredited] = useState(0)

  // Target chain+account for the credits
  const [targetChainId, setTargetChainId] = useState("")
  const [targetAccount, setTargetAccount] = useState("")

  // Standalone payment-chain wallet (independent of app chain)
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [paymentConnecting, setPaymentConnecting] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentKitRef = useRef<{ kit: any; chainKey: string } | null>(null)

  // If the app is already on the selected payment chain with a wallet, reuse that session
  const isAppOnPaymentChain = chainInfo?.chain_id === paymentChain.chainId
  const activePaymentSession = isAppOnPaymentChain && appSession ? appSession : paymentSession
  const paymentActor = activePaymentSession?.actor ? String(activePaymentSession.actor) : null

  // When user changes payment chain, reset the cached wallet kit (different chain id)
  useEffect(() => {
    setPaymentSession(null)
    paymentKitRef.current = null
    // Also reset the selected token to the chain's default
    setPaymentSymbol(paymentChain.tokens[0].symbol)
  }, [paymentChainKey, paymentChain.tokens])

  // Auto-fill target from current chain+wallet when dialog opens
  useEffect(() => {
    if (open) {
      if (chainInfo?.chain_id) setTargetChainId(chainInfo.chain_id)
      if (appSession?.actor) setTargetAccount(String(appSession.actor))
      // Default payment chain to whatever the app is on, if it's a known one
      if (chainInfo?.chain_id === VAULTA_CHAIN_ID) setPaymentChainKey("vaulta")
      else if (chainInfo?.chain_id === TELOS_CHAIN_ID) setPaymentChainKey("telos")
    }
  }, [open, chainInfo?.chain_id, appSession?.actor])

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount

  // Initialize SessionKit lazily for the selected payment chain
  const initPaymentKit = useCallback(async () => {
    if (paymentKitRef.current && paymentKitRef.current.chainKey === paymentChainKey) {
      return paymentKitRef.current.kit
    }
    const { SessionKit } = await import("@wharfkit/session")
    const { WebRenderer } = await import("@wharfkit/web-renderer")
    const { WalletPluginAnchor } = await import("@wharfkit/wallet-plugin-anchor")
    const kit = new SessionKit({
      appName: "Talkblock",
      chains: [{ id: paymentChain.chainId, url: paymentChain.rpcUrl }],
      ui: new WebRenderer(),
      walletPlugins: [new WalletPluginAnchor()],
    })
    paymentKitRef.current = { kit, chainKey: paymentChainKey }
    return kit
  }, [paymentChainKey, paymentChain.chainId, paymentChain.rpcUrl])

  const connectPaymentWallet = useCallback(async () => {
    setPaymentConnecting(true)
    setError("")
    try {
      const kit = await initPaymentKit()
      const result = await kit.login()
      if (result?.session) {
        const s = result.session
        setPaymentSession({
          actor: String(s.actor),
          permission: String(s.permission),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transact: (args: any) => s.transact(args),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect"
      if (!msg.toLowerCase().includes("cancel")) {
        setError(msg)
      }
    } finally {
      setPaymentConnecting(false)
    }
  }, [initPaymentKit])

  const handlePurchase = async () => {
    if (!activePaymentSession || !effectiveAmount || effectiveAmount <= 0 || !targetChainId || !targetAccount) return

    setState("signing")
    setError("")

    try {
      const actor = String(activePaymentSession.actor)
      const permission = isAppOnPaymentChain && appSession
        ? String(appSession.permission)
        : String((activePaymentSession as PaymentSession).permission)

      const actions = [{
        account: paymentToken.contract,
        name: "transfer",
        authorization: [{ actor, permission }],
        data: {
          from: actor,
          to: appWalletAccount,
          quantity: `${effectiveAmount.toFixed(4)} ${paymentToken.symbol}`,
          memo: `talkblock-credit:${targetChainId}:${targetAccount}`,
        },
      }]

      const result = await activePaymentSession.transact({ actions })

      const txId = result?.resolved?.transaction?.id || result?.transaction?.id || result?.response?.transaction_id
      if (!txId) {
        throw new Error("Could not get transaction ID from wallet response")
      }

      setState("verifying")
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const token = localStorage.getItem("auth_token")
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`

      const verifyRes = await fetch("/api/credits/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({
          transactionId: String(txId),
          chainId: targetChainId,
          accountName: targetAccount,
          paymentChain: paymentChainKey,
        }),
      })

      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Verification failed")
      }

      setCreditsCredited(verifyData.credits_credited ?? verifyData.tokens_credited ?? 0)
      setState("success")
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed"
      if (!msg.toLowerCase().includes("cancel")) {
        setError(msg)
        setState("error")
      } else {
        setState("idle")
      }
    }
  }

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => {
      setState("idle")
      setError("")
      setCreditsCredited(0)
      setCustomAmount("")
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Coins className="h-4 w-4 mr-2" />
            Buy Credits
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
        </DialogHeader>

        {state === "success" ? (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Credits Added!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {creditsCredited.toLocaleString()} credits added to {targetAccount}.
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target chain + account */}
            <div className="space-y-3">
              <div>
                <Label className="mb-2 block">Credit Target Chain</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={targetChainId}
                  onChange={(e) => setTargetChainId(e.target.value)}
                >
                  <option value="">Select chain...</option>
                  {KNOWN_CHAINS.map((c) => (
                    <option key={c.chainId} value={c.chainId}>
                      {c.label}
                    </option>
                  ))}
                  {targetChainId && !KNOWN_CHAINS.some((c) => c.chainId === targetChainId) && (
                    <option value={targetChainId}>{targetChainId.slice(0, 16)}...</option>
                  )}
                </select>
              </div>
              <div>
                <Label className="mb-2 block">Credit Target Account</Label>
                <Input
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  placeholder="e.g. myaccount"
                />
              </div>
            </div>

            {/* Payment chain + token */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-2 block">Pay With Chain</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentChainKey}
                  onChange={(e) => setPaymentChainKey(e.target.value as "telos" | "vaulta")}
                >
                  {PAYMENT_CHAINS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-2 block">Token</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentSymbol}
                  onChange={(e) => setPaymentSymbol(e.target.value)}
                >
                  {paymentChain.tokens.map((t) => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Select Amount ({paymentToken.symbol})</Label>
              <div className="flex gap-2">
                {PRESET_AMOUNTS.map((a) => (
                  <Button
                    key={a}
                    variant={!customAmount && amount === a ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => { setAmount(a); setCustomAmount("") }}
                  >
                    {a} {paymentToken.symbol}
                  </Button>
                ))}
              </div>
              <div className="mt-2">
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{effectiveAmount} {paymentToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credits received</span>
                <span className="font-medium">{(effectiveAmount * paymentToken.creditsPerUnit).toLocaleString()} credits</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Rate</span>
                <span>1 {paymentToken.symbol} = {paymentToken.creditsPerUnit.toLocaleString()} credits</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Payment section */}
            {activePaymentSession ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span>Paying from: <span className="font-medium">{paymentActor}</span> ({paymentChain.label})</span>
                </div>
                <Button
                  className="w-full"
                  onClick={handlePurchase}
                  disabled={!appWalletAccount || !targetChainId || !targetAccount || state === "signing" || state === "verifying" || !effectiveAmount || effectiveAmount <= 0}
                >
                  {state === "signing" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing with Wallet...</>
                  ) : state === "verifying" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying on chain...</>
                  ) : (
                    <>Pay {effectiveAmount} {paymentToken.symbol}</>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                variant="outline"
                onClick={connectPaymentWallet}
                disabled={paymentConnecting}
              >
                {paymentConnecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
                ) : (
                  <><Wallet className="h-4 w-4 mr-2" />Connect {paymentChain.label} Wallet to Pay</>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
