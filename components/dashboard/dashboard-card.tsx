"use client"

import { useState, useRef, DragEvent } from "react"
import { AccountCard } from "@/components/chat/cards/account-card"
import { BlockCard } from "@/components/chat/cards/block-card"
import { TransactionCard } from "@/components/chat/cards/transaction-card"
import { TableCard } from "@/components/chat/cards/table-card"
import { TxProposalCard } from "@/components/chat/cards/tx-proposal-card"
import { useDashboard } from "@/lib/stores/dashboard-store"
import { useHistory } from "@/lib/stores/history-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { GripVertical, X, Pencil, Check, User, Box, FileText, Database, Coins, Shield, Users, FileSignature } from "lucide-react"

const TOOL_ICONS: Record<string, React.ElementType> = {
  get_account: User,
  get_block: Box,
  get_transaction: FileText,
  get_table_rows: Database,
  get_currency_balance: Coins,
  get_abi: Shield,
  get_producers: Users,
  build_transaction: FileSignature,
}

const TOOL_TYPE_LABEL: Record<string, string> = {
  get_account: "Account",
  get_block: "Block",
  get_transaction: "Transaction",
  get_table_rows: "Table",
  get_currency_balance: "Balance",
  get_abi: "ABI",
  get_producers: "Producers",
  build_transaction: "Proposal",
}

interface DashboardCardProps {
  bookmark: {
    id: string
    tool_name: string
    label: string
    result: Record<string, any>
    chain_name: string | null
    chain_endpoint: string | null
  }
  onDragStart: (e: DragEvent, id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent, id: string) => void
}

function renderCardContent(toolName: string, result: Record<string, any>) {
  switch (toolName) {
    case "get_account":
      return <AccountCard data={result as any} />
    case "get_block":
      return <BlockCard data={result as any} />
    case "get_transaction":
      return <TransactionCard data={result as any} />
    case "get_table_rows":
      return <TableCard data={result as any} />
    case "get_currency_balance":
      return (
        <div className="text-sm bg-muted rounded-md px-3 py-2">
          <span className="text-muted-foreground">Balances for </span>
          <span className="font-medium">{String(result.account)}</span>
          <span className="text-muted-foreground">: </span>
          <span className="font-medium">{(result.balances || []).join(", ") || "None"}</span>
        </div>
      )
    case "get_producers":
      return <TableCard data={{ rows: result.producers || [] }} />
    case "get_abi":
      return (
        <div className="text-sm bg-muted rounded-md px-3 py-2 space-y-1">
          <div><span className="text-muted-foreground">Contract: </span><span className="font-medium">{String(result.account_name)}</span></div>
          <div><span className="text-muted-foreground">Actions: </span>{(result.actions || []).join(", ")}</div>
          <div><span className="text-muted-foreground">Tables: </span>{(result.tables || []).join(", ")}</div>
        </div>
      )
    case "build_transaction":
      return <TxProposalCard data={result as any} />
    default:
      return <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
  }
}

export function DashboardCard({ bookmark, onDragStart, onDragOver, onDrop }: DashboardCardProps) {
  const { customLabels, setCustomLabel, removeCustomLabel } = useDashboard()
  const { removeBookmark, updateBookmarkLabel } = useHistory()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const displayLabel = customLabels[bookmark.id] || bookmark.label

  const startEditing = () => {
    setEditValue(displayLabel)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const saveEdit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== bookmark.label) {
      setCustomLabel(bookmark.id, trimmed)
      updateBookmarkLabel(bookmark.id, trimmed)
    } else if (trimmed === bookmark.label) {
      removeCustomLabel(bookmark.id)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit()
    if (e.key === "Escape") setEditing(false)
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, bookmark.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, bookmark.id)}
      className="border rounded-lg bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/50">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        {(() => {
          const Icon = TOOL_ICONS[bookmark.tool_name] || FileText
          return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        })()}
        {editing ? (
          <div className="flex-1 flex items-center gap-1">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="h-6 text-sm px-1"
            />
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={saveEdit}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="flex-1 text-left text-sm font-medium truncate hover:text-primary transition-colors flex items-center gap-1 min-w-0"
          >
            <span className="truncate">{displayLabel}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
          </button>
        )}
        <Badge variant="secondary" className="text-[9px] shrink-0 px-1.5 py-0">
          {TOOL_TYPE_LABEL[bookmark.tool_name] || "Data"}
        </Badge>
        {bookmark.chain_name && (
          <Badge variant="outline" className="text-[9px] shrink-0 px-1.5 py-0">
            {bookmark.chain_name.split(" ")[0]}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeBookmark(bookmark.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-3 overflow-auto max-h-96 group">
        {renderCardContent(bookmark.tool_name, bookmark.result)}
      </div>
    </div>
  )
}
