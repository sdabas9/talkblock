"use client"

import { useChat, UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useMemo, useCallback, useState } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { MarkdownContent } from "./markdown-content"
import { useLLM } from "@/lib/stores/llm-store"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useCredits } from "@/lib/stores/credits-store"
import { LLMSettings } from "@/components/settings/llm-settings"
import { PurchaseCreditsDialog } from "@/components/billing/purchase-credits-dialog"
import { Button } from "@/components/ui/button"
import { Bot, Settings, Wallet, Key, AlertCircle } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { isToolUIPart, isReasoningUIPart, getToolName } from "ai"
import { ToolResultRenderer } from "./cards/tool-result-renderer"
import { ReasoningContent } from "./reasoning-content"
import { refetchToolData, REFRESHABLE_TOOLS, formatAge } from "@/lib/antelope/refetch"

export function ChatPanel() {
  const { isConfigured, getClientConfig, llmMode } = useLLM()
  const { endpoint, hyperionEndpoint, chainName, chainInfo } = useChain()
  const { accountName, login: walletLogin, connecting: walletConnecting } = useWallet()
  const { user } = useAuth()
  const credits = useCredits()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [outOfCredits, setOutOfCredits] = useState(false)

  const endpointRef = useRef(endpoint)
  const hyperionRef = useRef(hyperionEndpoint)
  const accountRef = useRef(accountName)
  const chainIdRef = useRef(chainInfo?.chain_id)
  const chainNameRef = useRef(chainName)
  endpointRef.current = endpoint
  hyperionRef.current = hyperionEndpoint
  accountRef.current = accountName
  chainIdRef.current = chainInfo?.chain_id
  chainNameRef.current = chainName

  const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string || "{}")
    body.chainEndpoint = endpointRef.current || ""
    body.hyperionEndpoint = hyperionRef.current || ""
    body.walletAccount = accountRef.current || ""
    body.chainId = chainIdRef.current || ""
    body.chainName = chainNameRef.current || ""
    const token = localStorage.getItem("auth_token")
    const headers: Record<string, string> = {
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    // Always send LLM config as fallback (server uses DB if authed, body if not)
    const clientConfig = getClientConfig()
    if (clientConfig) {
      body.llmConfig = clientConfig
    }
    const response = await fetch(input, {
      ...init,
      headers,
      body: JSON.stringify(body),
    })

    // Handle 402 (out of credits)
    if (response.status === 402) {
      setOutOfCredits(true)
      throw new Error("Out of credits")
    }

    setOutOfCredits(false)
    return response
  }, [getClientConfig])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: customFetch,
      }),
    [customFetch]
  )

  const { messages, sendMessage, setMessages, status } = useChat({ transport })

  const isLoading = status === "submitted" || status === "streaming"

  // Refresh credits after each completed chat response
  const prevStatusRef = useRef(status)
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      if (user && llmMode === "builtin") {
        credits.refresh()
      }
    }
    prevStatusRef.current = status
  }, [status, user, llmMode, credits])

  // Clear out-of-credits banner when balance is replenished
  useEffect(() => {
    if (outOfCredits && (credits.balanceTokens > 0 || credits.freeRemaining > 0)) {
      setOutOfCredits(false)
    }
  }, [outOfCredits, credits.balanceTokens, credits.freeRemaining])


  const handleTxError = useCallback((error: string, actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => {
    sendMessage({
      text: `[Transaction Error: ${error}]\nFailed actions: ${JSON.stringify(actions)}\nPlease analyze the error and build a corrected transaction.`,
    })
  }, [sendMessage])

  const handleSend = useCallback(async (text: string) => {
    setOutOfCredits(false)
    sendMessage({ text })
  }, [sendMessage])

  // Clear chat on chain or account change
  const prevChainRef = useRef(endpoint)
  const prevAccountRef = useRef(accountName)
  useEffect(() => {
    const chainChanged = prevChainRef.current !== endpoint
    const accountChanged = prevAccountRef.current !== accountName
    prevChainRef.current = endpoint
    prevAccountRef.current = accountName

    if (chainChanged || accountChanged) {
      setMessages([])
    }
  }, [endpoint, accountName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for bookmark card display from left panel
  useEffect(() => {
    const handler = async (e: Event) => {
      const bookmark = (e as CustomEvent).detail
      if (!bookmark?.tool_name || !bookmark?.result) return

      let resultData = bookmark.result
      let refreshed = false
      // Refresh with latest data if possible
      if (REFRESHABLE_TOOLS.has(bookmark.tool_name) && bookmark.chain_endpoint) {
        try {
          resultData = await refetchToolData(
            bookmark.tool_name,
            bookmark.result,
            bookmark.chain_endpoint,
            hyperionRef.current || null
          )
          refreshed = true
        } catch {
          // Fall back to stored data on error
        }
      }

      const now = new Date()
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      const staleNote = refreshed
        ? `Refreshed at ${timeStr}`
        : `Saved ${formatAge(bookmark.created_at)}`

      const cardMessage: UIMessage = {
        id: `bookmark-${bookmark.id}-${Date.now()}`,
        role: "assistant",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parts: [
          {
            type: `tool-${bookmark.tool_name}`,
            toolCallId: `bookmark-${bookmark.id}`,
            state: "output-available",
            input: {},
            output: resultData,
          } as any,
          {
            type: "text",
            text: staleNote,
          },
        ],
      }
      setMessages((prev) => [...prev, cardMessage])
    }
    window.addEventListener("bookmark-show", handler)
    return () => window.removeEventListener("bookmark-show", handler)
  }, [setMessages])


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  if (!isConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <svg viewBox="0 0 48 48" fill="none" className="h-16 w-16" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 8C4 4.686 6.686 2 10 2H38C41.314 2 44 4.686 44 8V32C44 35.314 41.314 38 38 38H28L20 46V38H10C6.686 38 4 35.314 4 32V8Z" fill="#6366f1"/>
          <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M24 10V24M24 24L36 17M24 24L12 17M24 24V38" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
        </svg>
        <h2 className="text-xl font-semibold">Welcome to Talkblock</h2>
        {accountName ? (
          <>
            <p className="text-muted-foreground text-center max-w-md">
              Wallet connected as <span className="font-medium text-foreground">{accountName}</span>. Add an API key to start chatting.
            </p>
            <LLMSettings trigger={
              <Button variant="default" size="lg">
                <Key className="h-4 w-4 mr-2" />
                Configure API Key
              </Button>
            } />
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-center max-w-md">
              Chat with the blockchain using AI. Connect a wallet for 5 free requests per day, or bring your own API key.
            </p>
            <div className="flex gap-3">
              <Button variant="default" size="lg" onClick={walletLogin} disabled={walletConnecting}>
                <Wallet className="h-4 w-4 mr-2" />
                {walletConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
              <LLMSettings trigger={
                <Button variant="outline" size="lg">
                  <Key className="h-4 w-4 mr-2" />
                  Use Own API Key
                </Button>
              } />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {chainName && (
        <div className="px-4 py-1 border-b">
          <span className="text-xs text-muted-foreground">
            Connected to: <span className="font-medium text-foreground">{chainName}</span>
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-4">
              <svg viewBox="0 0 48 48" fill="none" className="h-14 w-14" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 8C4 4.686 6.686 2 10 2H38C41.314 2 44 4.686 44 8V32C44 35.314 41.314 38 38 38H28L20 46V38H10C6.686 38 4 35.314 4 32V8Z" fill="#6366f1"/>
                <path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M24 10V24M24 24L36 17M24 24L12 17M24 24V38" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"/>
              </svg>
              <h2 className="text-lg font-semibold">Talk<span className="font-normal">block</span></h2>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                {[
                  { label: "Look up my account", query: accountName ? `Show me details about the ${accountName} account` : "Tell me about the eosio account" },
                  { label: "Check my token balances", query: accountName ? `What tokens does ${accountName} hold?` : "What tokens does eosio.token hold?" },
                  { label: "Top block producers", query: "Show me the top block producers" },
                  { label: "Transfer tokens", query: accountName ? `Build a transfer of 1 unit of the native token from ${accountName} to ` : "Build a transfer of 1 unit of the native token from myaccount to " },
                ].map((suggestion) => (
                  <button
                    key={suggestion.label}
                    className="text-left text-sm px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => handleSend(suggestion.query)}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            (() => {
              // Extract table references from all messages in the conversation
              const allTableRefs = messages.flatMap((m) =>
                m.parts
                  .filter((p) => isToolUIPart(p) && getToolName(p) === "get_table_rows" && p.state === "output-available")
                  .map((p) => (p as { output: Record<string, unknown> }).output)
              )
              // Extract ABI references (contract name + table list)
              const allAbiRefs = messages.flatMap((m) =>
                m.parts
                  .filter((p) => isToolUIPart(p) && (getToolName(p) === "get_abi" || getToolName(p) === "get_abi_snapshot") && p.state === "output-available")
                  .map((p) => (p as { output: Record<string, unknown> }).output)
              )
              // Find the last build_transaction result so we can hide earlier duplicates
              let lastTxMsgId: string | null = null
              let lastTxPartIdx = -1
              messages.forEach((m) => {
                m.parts.forEach((p, pi) => {
                  if (isToolUIPart(p) && getToolName(p) === "build_transaction" && p.state === "output-available") {
                    lastTxMsgId = m.id
                    lastTxPartIdx = pi
                  }
                })
              })
              return messages
              .filter((message) => {
                // Hide system trigger messages from display
                if (message.role === "user" && message.parts.length === 1 && message.parts[0].type === "text") {
                  const text = (message.parts[0] as { type: "text"; text: string }).text
                  if (text.startsWith("[System:") || text.startsWith("[Transaction Error:")) return false
                }
                return true
              })
              .map((message, idx) => (
              <ChatMessage key={`${message.id}-${idx}`} role={message.role as "user" | "assistant"}>
                {message.parts.map((part, i) => {
                  // Deduplicate build_transaction: only show the last one across the entire conversation
                  if (isToolUIPart(part) && getToolName(part) === "build_transaction" && part.state === "output-available") {
                    if (message.id !== lastTxMsgId || i !== lastTxPartIdx) return null
                  }
                  if (part.type === "text") {
                    if (message.role === "assistant") {
                      // Bookmark age labels — render as subtle timestamp
                      if (part.text.startsWith("Refreshed at ") || part.text.startsWith("Saved ")) {
                        return (
                          <span key={i} className="text-[11px] text-muted-foreground/70 italic">
                            {part.text}
                          </span>
                        )
                      }
                      return <MarkdownContent key={i} content={part.text} tableRefs={allTableRefs} abiRefs={allAbiRefs} />
                    }
                    return <span key={i}>{part.text}</span>
                  }
                  if (isReasoningUIPart(part)) {
                    return null
                  }
                  if (isToolUIPart(part)) {
                    const toolName = getToolName(part)
                    if (part.state === "output-available") {
                      return (
                        <ToolResultRenderer
                          key={i}
                          toolName={toolName}
                          result={part.output as Record<string, unknown>}
                          onTxError={handleTxError}
                        />
                      )
                    }
                    // Hide "Calling..." if this tool already has a completed result in the same message
                    const hasResult = message.parts.some(
                      (p) => isToolUIPart(p) && getToolName(p) === toolName && p.state === "output-available"
                    )
                    if (hasResult) return null
                    return (
                      <div key={i} className="text-xs text-muted-foreground animate-pulse my-1">
                        Calling {toolName}...
                      </div>
                    )
                  }
                  return null
                })}
              </ChatMessage>
            ))
            })()
          )}

          {outOfCredits && (
            <div className="mx-4 my-3 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4" />
                Out of credits
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;ve used all 5 free requests today. Purchase credits to continue chatting.
              </p>
              <div className="mt-3">
                <PurchaseCreditsDialog />
              </div>
            </div>
          )}

          {isLoading && (() => {
            const lastMsg = messages[messages.length - 1]
            const hasContent = lastMsg?.role === "assistant" && lastMsg.parts.length > 0
            return hasContent ? (
              <div className="flex items-center gap-1.5 px-8 py-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <div className="flex gap-3 px-4 py-3">
                <Avatar className="h-8 w-8 border flex items-center justify-center bg-primary/10 shrink-0">
                  <Bot className="h-4 w-4" />
                </Avatar>
                <div className="flex items-center gap-1 px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={!isConfigured}
        placeholder={
          !endpoint
            ? "Connect to a chain first, or ask a general question..."
            : "Ask anything about the blockchain..."
        }
      />
    </div>
  )
}
