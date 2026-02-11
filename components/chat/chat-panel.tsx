"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useMemo } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { MarkdownContent } from "./markdown-content"
import { useLLM } from "@/lib/stores/llm-store"
import { useChain } from "@/lib/stores/chain-store"
import { Bot, MessageSquare } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { isToolUIPart, getToolName } from "ai"
import { ToolResultRenderer } from "./cards/tool-result-renderer"

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

  const { messages, sendMessage, status } = useChat({ transport })

  const isLoading = status === "submitted" || status === "streaming"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

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
