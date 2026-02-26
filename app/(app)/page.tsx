"use client"

import { useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ChatPanel } from "@/components/chat/chat-panel"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { fetchAccountData, fetchBlockData, fetchTxData, fetchTableData, fetchActionData } from "@/lib/antelope/lookup"

function HomeContent() {
  const searchParams = useSearchParams()
  const { presets, connect, chainName, endpoint, hyperionEndpoint, connecting } = useChain()
  const { view, setView } = usePanels()
  const { setContext } = useDetailContext()
  const handledRef = useRef(false)

  const txParam = searchParams.get("tx")
  const accountParam = searchParams.get("account")
  const blockParam = searchParams.get("block")
  const chainParam = searchParams.get("chain")
  const tableParam = searchParams.get("table")
  const codeParam = searchParams.get("code")
  const scopeParam = searchParams.get("scope")
  const lowerBoundParam = searchParams.get("lower_bound")
  const upperBoundParam = searchParams.get("upper_bound")
  const reverseParam = searchParams.get("reverse")
  const actionParam = searchParams.get("action")

  const hasParam = txParam || accountParam || blockParam || (tableParam && codeParam) || (actionParam && codeParam)

  useEffect(() => {
    if (!hasParam || handledRef.current) return

    // If we need to connect to a different chain first, do that
    if (chainParam && chainParam !== chainName) {
      const preset = presets.find((p) => p.name === chainParam)
      if (preset) {
        connect(preset.url, preset.name, preset.hyperion)
        return // Wait for connection to complete
      }
    }

    // If still connecting or no endpoint yet, wait
    if (connecting || !endpoint) return

    handledRef.current = true
    document.cookie = "chain_selected=1; path=/; max-age=31536000; SameSite=Lax"
    setView("chat")

    // Open the panel immediately with a loading placeholder BEFORE clearing URL
    const linkType = accountParam ? "account"
      : blockParam ? "block"
      : txParam ? "transaction"
      : (tableParam && codeParam) ? "table"
      : (actionParam && codeParam) ? "action"
      : null
    if (linkType) {
      setContext(linkType, { _loading: true }, { expand: true })
    }

    // Clear URL params without triggering Next.js router re-render
    window.history.replaceState({}, "", "/")

    // Fetch real data and replace the placeholder
    if (accountParam) {
      fetchAccountData(accountParam, endpoint)
        .then((data) => setContext("account", data, { expand: true }))
        .catch(() => {})
    }
    if (blockParam) {
      fetchBlockData(blockParam, endpoint)
        .then((data) => setContext("block", data, { expand: true }))
        .catch(() => {})
    }
    if (txParam) {
      fetchTxData(txParam, endpoint, hyperionEndpoint)
        .then((data) => { if (data) setContext("transaction", data, { expand: true }) })
        .catch(() => {})
    }
    if (tableParam && codeParam) {
      Promise.all([
        fetchAccountData(codeParam, endpoint),
        fetchTableData(codeParam, tableParam, endpoint, {
          scope: scopeParam || undefined,
          lower_bound: lowerBoundParam || undefined,
          upper_bound: upperBoundParam || undefined,
          reverse: reverseParam === "true",
        }),
      ]).then(([accountData, tableData]) => {
        // Set account first so parentAccount gets saved on account→table transition
        setContext("account", accountData, { expand: true })
        setContext("table", tableData, { expand: true })
      }).catch(() => {})
    }
    if (actionParam && codeParam && !tableParam) {
      const initialValues: Record<string, string> = {}
      searchParams.forEach((value, key) => {
        if (key.startsWith("field_")) {
          initialValues[key.slice(6)] = value
        }
      })
      Promise.all([
        fetchAccountData(codeParam, endpoint),
        fetchActionData(codeParam, actionParam, endpoint, Object.keys(initialValues).length > 0 ? initialValues : undefined),
      ]).then(([accountData, actionData]) => {
        setContext("account", accountData, { expand: true })
        setContext("action", actionData, { expand: true })
      }).catch(() => {})
    }
  }, [hasParam, txParam, accountParam, blockParam, chainParam, chainName, endpoint, hyperionEndpoint, connecting, presets, connect, setView, setContext, tableParam, codeParam, scopeParam, lowerBoundParam, upperBoundParam, reverseParam, actionParam, searchParams])

  // Hide chat while deep link params are in the URL (before effect clears them)
  const showChat = view === "chat" && !hasParam

  return (
    <>
      <div className={showChat ? "flex flex-col flex-1 overflow-hidden" : "hidden"}>
        <ChatPanel />
      </div>
      {view === "dashboard" && !hasParam && <DashboardView />}
    </>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
