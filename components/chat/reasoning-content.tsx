"use client"

import { useState, useEffect, useRef } from "react"
import { Brain, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReasoningContentProps {
  text: string
  isStreaming: boolean
}

export function ReasoningContent({ text, isStreaming }: ReasoningContentProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const hasCollapsedRef = useRef(false)

  // Track elapsed time while streaming
  useEffect(() => {
    if (!isStreaming) return
    startRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isStreaming])

  // Collapse when streaming finishes
  useEffect(() => {
    if (!isStreaming && !hasCollapsedRef.current && text.length > 0) {
      hasCollapsedRef.current = true
      setIsOpen(false)
    }
  }, [isStreaming, text])

  if (!text) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-90"
          )}
        />
        <Brain className={cn("h-3 w-3", isStreaming && "animate-pulse text-indigo-400")} />
        {isStreaming ? (
          <span className="animate-pulse">Thinking...</span>
        ) : (
          <span>Thought for {elapsed}s</span>
        )}
      </button>
      {isOpen && (
        <div className="ml-5 mt-1 pl-3 border-l-2 border-muted-foreground/20 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  )
}
