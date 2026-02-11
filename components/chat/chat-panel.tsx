"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useMemo } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { useLLM } from "@/lib/stores/llm-store"
import { useChain } from "@/lib/stores/chain-store"
import { Bot, MessageSquare } from "lucide-react"

export function ChatPanel() {
  const { config, isConfigured } = useLLM()
  const { endpoint, chainName } = useChain()
  const scrollRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: {
          "x-llm-provider": config?.provider || "",
          "x-llm-api-key": config?.apiKey || "",
          "x-llm-model": config?.model || "",
          "x-chain-endpoint": endpoint || "",
        },
      }),
    [config?.provider, config?.apiKey, config?.model, endpoint]
  )

  const { messages, sendMessage } = useChat({ transport })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!isConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Welcome to Antelope Explorer</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Configure your LLM provider in Settings to start chatting with the blockchain.
        </p>
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
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {endpoint
                  ? "Ask me anything about the blockchain"
                  : "Connect to a chain to get started, or ask me anything"}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} role={message.role as "user" | "assistant"}>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return <span key={i}>{part.text}</span>
                  }
                  return null
                })}
              </ChatMessage>
            ))
          )}
        </div>
      </div>

      <ChatInput
        onSend={(text) => sendMessage({ text })}
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
