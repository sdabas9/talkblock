"use client"

import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Bot, User } from "lucide-react"

interface ChatMessageProps {
  role: "user" | "assistant"
  children: React.ReactNode
}

export function ChatMessage({ role, children }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {role === "assistant" && (
        <Avatar className="h-8 w-8 border flex items-center justify-center bg-primary/10 shrink-0">
          <Bot className="h-4 w-4" />
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%] text-sm",
          role === "user"
            ? "bg-primary text-primary-foreground whitespace-pre-wrap"
            : "bg-muted"
        )}
      >
        {role === "assistant" ? (
          <div className="prose prose-sm prose-invert max-w-none">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
      {role === "user" && (
        <Avatar className="h-8 w-8 border flex items-center justify-center bg-muted shrink-0">
          <User className="h-4 w-4" />
        </Avatar>
      )}
    </div>
  )
}
