"use client"

import { useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChatPanel } from "@/components/chat/chat-panel"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"

function TxParamHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { presets, connect, chainName, connecting } = useChain()
  const { setView } = usePanels()
  const handledRef = useRef(false)

  const txParam = searchParams.get("tx")
  const chainParam = searchParams.get("chain")

  useEffect(() => {
    if (!txParam || handledRef.current) return

    // If we need to connect to a different chain first, do that
    if (chainParam && chainParam !== chainName) {
      const preset = presets.find((p) => p.name === chainParam)
      if (preset) {
        connect(preset.url, preset.name, preset.hyperion)
        return // Wait for connection to complete
      }
    }

    // If still connecting, wait
    if (connecting) return

    // Connected — store the pending lookup for ChatPanel to pick up
    handledRef.current = true
    setView("chat")
    sessionStorage.setItem("pending_tx_lookup", txParam)
    router.replace("/")
  }, [txParam, chainParam, chainName, connecting, presets, connect, setView, router])

  return null
}

export default function Home() {
  const { view } = usePanels()
  return (
    <>
      <Suspense>
        <TxParamHandler />
      </Suspense>
      <div className={view === "chat" ? "flex flex-col flex-1 overflow-hidden" : "hidden"}>
        <ChatPanel />
      </div>
      {view === "dashboard" && <DashboardView />}
    </>
  )
}
