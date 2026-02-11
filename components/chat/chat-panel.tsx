"use client"

import { useChat, UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useMemo, useCallback } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { MarkdownContent } from "./markdown-content"
import { useLLM } from "@/lib/stores/llm-store"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useConversations } from "@/lib/stores/conversation-store"
import { LLMSettings } from "@/components/settings/llm-settings"
import { Button } from "@/components/ui/button"
import { Bot, MessageSquare, Settings } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { isToolUIPart, getToolName } from "ai"
import { ToolResultRenderer } from "./cards/tool-result-renderer"

export function ChatPanel() {
  const { isConfigured, getClientConfig } = useLLM()
  const { endpoint, chainName } = useChain()
  const { accountName } = useWallet()
  const { user } = useAuth()
  const {
    activeConversationId,
    createConversation,
    saveMessage,
    loadMessages,
  } = useConversations()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeConvRef = useRef(activeConversationId)
  activeConvRef.current = activeConversationId

  const endpointRef = useRef(endpoint)
  const accountRef = useRef(accountName)
  endpointRef.current = endpoint
  accountRef.current = accountName

  const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string || "{}")
    body.chainEndpoint = endpointRef.current || ""
    body.walletAccount = accountRef.current || ""
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
    return fetch(input, {
      ...init,
      headers,
      body: JSON.stringify(body),
    })
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

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId).then((msgs) => {
        const chatMessages = msgs.map((m: { role: string; parts: unknown[] }, i: number) => ({
          id: `loaded-${i}`,
          role: m.role as "system" | "user" | "assistant",
          parts: m.parts,
        })) as UIMessage[]
        setMessages(chatMessages)
      })
    } else {
      setMessages([])
    }
  }, [activeConversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save new messages to DB when they appear (not while streaming)
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    if (!activeConvRef.current) return
    if (messages.length <= prevMsgCountRef.current) {
      prevMsgCountRef.current = messages.length
      return
    }
    const newMessages = messages.slice(prevMsgCountRef.current)
    prevMsgCountRef.current = messages.length
    for (const msg of newMessages) {
      if (status !== "streaming") {
        saveMessage(activeConvRef.current, msg.role, msg.parts)
      }
    }
  }, [messages, status, saveMessage])

  const handleTxError = useCallback((error: string, actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => {
    sendMessage({
      text: `[Transaction Error: ${error}]\nFailed actions: ${JSON.stringify(actions)}\nPlease analyze the error and build a corrected transaction.`,
    })
  }, [sendMessage])

  // Auto-create conversation on first message send
  const handleSend = useCallback(async (text: string) => {
    if (!activeConvRef.current) {
      const convId = await createConversation(chainName || undefined, endpoint || undefined)
      activeConvRef.current = convId
    }
    sendMessage({ text })
  }, [sendMessage, createConversation, chainName, endpoint])

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
      activeConvRef.current = null
    }
  }, [endpoint, accountName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for bookmark queries from left panel
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent).detail
      if (typeof query === "string" && query) handleSend(query)
    }
    window.addEventListener("bookmark-query", handler)
    return () => window.removeEventListener("bookmark-query", handler)
  }, [handleSend])

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
        <p className="text-muted-foreground text-center max-w-md">
          Configure your LLM provider to start chatting with the blockchain.
        </p>
        <LLMSettings trigger={
          <Button variant="outline" size="lg">
            <Settings className="h-4 w-4 mr-2" />
            Configure LLM
          </Button>
        } />
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
                  { label: "Look up an account", query: "Tell me about the eosio account" },
                  { label: "Check token balances", query: "What tokens does eosio.token hold?" },
                  { label: "Inspect a contract", query: "Show me the ABI for eosio.token" },
                  { label: "Get latest block", query: "Show me the latest block" },
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
            messages
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
                  if (part.type === "text") {
                    if (message.role === "assistant") {
                      return <MarkdownContent key={i} content={part.text} />
                    }
                    return <span key={i}>{part.text}</span>
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
          )}

          {isLoading && (
            <div className="flex gap-3 px-4 py-3">
              <Avatar className="h-8 w-8 border flex items-center justify-center bg-primary/10 shrink-0">
                <Bot className="h-4 w-4" />
              </Avatar>
              <div className="flex items-center gap-1 px-4 py-2">
                <div
                  className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
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
