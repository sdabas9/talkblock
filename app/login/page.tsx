"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Globe, ArrowRight, Sun, Moon } from "lucide-react"

const PRESET_CHAINS = [
  { name: "EOS Mainnet", url: "https://eos.greymass.com" },
  { name: "Jungle4 Testnet", url: "https://jungle4.greymass.com" },
  { name: "WAX Mainnet", url: "https://wax.greymass.com" },
  { name: "Telos Mainnet", url: "https://telos.greymass.com" },
  { name: "FIO Mainnet", url: "https://fio.greymass.com" },
  { name: "Libre", url: "https://libre.greymass.com" },
]

export default function LoginPage() {
  const router = useRouter()
  const [selectedChain, setSelectedChain] = useState<string>("")
  const [customEndpoint, setCustomEndpoint] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  const endpoint = selectedChain === "custom" ? customEndpoint : selectedChain
  const chainName = PRESET_CHAINS.find(c => c.url === selectedChain)?.name || customEndpoint

  const handleEnter = async () => {
    if (!endpoint) return
    setConnecting(true)
    setError(null)

    try {
      // Verify chain is reachable
      const infoRes = await fetch(`${endpoint}/v1/chain/get_info`, { method: "POST" })
      if (!infoRes.ok) throw new Error("Failed to connect to chain")

      // Store chain info for the app to pick up
      localStorage.setItem("antelope_endpoint", endpoint)
      localStorage.setItem("antelope_chain_name", chainName)

      // Set a cookie so middleware knows they've selected a chain
      document.cookie = `chain_selected=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

      // Redirect to app
      router.push("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={toggleTheme}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <svg viewBox="0 0 48 48" fill="none" className="h-7 w-7" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8C4 4.686 6.686 2 10 2H38C41.314 2 44 4.686 44 8V32C44 35.314 41.314 38 38 38H28L20 46V38H10C6.686 38 4 35.314 4 32V8Z" fill="#6366f1"/>
              <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M24 10V24M24 24L36 17M24 24L12 17M24 24V38" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
            </svg>
            Talk<span className="font-normal">block</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select a chain to get started
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select Chain</Label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a chain..." />
              </SelectTrigger>
              <SelectContent>
                {PRESET_CHAINS.map((chain) => (
                  <SelectItem key={chain.url} value={chain.url}>
                    {chain.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom RPC Endpoint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedChain === "custom" && (
            <div>
              <Label>RPC Endpoint</Label>
              <Input
                className="mt-1"
                placeholder="https://your-node.com"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleEnter}
            disabled={!endpoint || connecting}
          >
            {connecting ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5 mr-2" />
            )}
            {connecting ? "Connecting..." : "Enter Explorer"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Connect your wallet later from the header for full features.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
