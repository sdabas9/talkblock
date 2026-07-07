"use client"

import { useState, useRef } from "react"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { useHistory } from "@/lib/stores/history-store"

interface RenameLabelProps {
  bookmarkId: string
  baseLabel: string
  className?: string
}

export function RenameLabel({ bookmarkId, baseLabel, className = "" }: RenameLabelProps) {
  const { customLabels, setCustomLabel, removeCustomLabel } = useDashboard()
  const { updateBookmarkLabel } = useHistory()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const displayLabel = customLabels[bookmarkId] || baseLabel

  const start = () => {
    setValue(displayLabel)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const save = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== baseLabel) {
      setCustomLabel(bookmarkId, trimmed)
      updateBookmarkLabel(bookmarkId, trimmed)
    } else if (trimmed === baseLabel) {
      removeCustomLabel(bookmarkId)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") setEditing(false)
        }}
        className={`w-full min-w-0 bg-transparent border border-border px-1 font-mono uppercase outline-none ${className}`}
      />
    )
  }

  return (
    <button onClick={start} title="Rename" className={`truncate text-left hover:text-foreground transition-colors ${className}`}>
      {displayLabel}
    </button>
  )
}
