"use client"

import { AccountCard } from "./account-card"
import { BlockCard } from "./block-card"
import { TransactionCard } from "./transaction-card"
import { TableCard } from "./table-card"
import { TxProposalCard } from "./tx-proposal-card"
import { ActionsCard } from "./actions-card"
import { TransfersCard } from "./transfers-card"
import { TokensCard } from "./tokens-card"
import { useHistory } from "@/lib/stores/history-store"
import { useChain } from "@/lib/stores/chain-store"
import { Button } from "@/components/ui/button"
import { Bookmark, BookOpen } from "lucide-react"

interface ToolResultRendererProps {
  toolName: string
  result: Record<string, any>
  onTxError?: (error: string, actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => void
}

function getLabel(toolName: string, result: Record<string, any>): string {
  switch (toolName) {
    case "get_account": return result.account_name || "Account"
    case "get_block": return `Block #${(result.block_num || "??").toLocaleString()}`
    case "get_transaction": return `Tx ${(result.id || "??").slice(0, 8)}...`
    case "get_table_rows": {
      const parts = [result.code, result.table].filter(Boolean)
      return parts.length ? parts.join(" / ") : "Table rows"
    }
    case "get_currency_balance": {
      const balances = result.balances || []
      if (balances.length === 1) return `${result.account || "??"} (${balances[0]})`
      return `${result.account || "??"} (${balances.length} tokens)`
    }
    case "get_producers": return "Block Producers"
    case "get_abi": return `${result.account_name || "??"} ABI`
    case "build_transaction": {
      const actions = result.actions || []
      if (actions.length === 1) return `${actions[0].name} on ${actions[0].account}`
      return result.description || `${actions.length}-action Tx`
    }
    case "get_actions": {
      const total = result.total as { value?: number } | undefined
      return `Actions${total?.value ? ` (${total.value.toLocaleString()})` : ""}`
    }
    case "get_transfers": return `Transfers for ${result.account || "??"}`
    case "get_created_accounts": return `Accounts created by ${result.query_account || "??"}`
    case "get_creator": return `Creator of ${result.account || "??"}`
    case "get_tokens": return `Tokens for ${result.account || "??"}`
    case "get_key_accounts": {
      const names = result.account_names || []
      return `Key Accounts (${names.length})`
    }
    case "get_contract_guide": return `Guide: ${result.contract || "Contract"}`
    default: return toolName
  }
}


export function ToolResultRenderer({ toolName, result, onTxError }: ToolResultRendererProps) {
  const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useHistory()
  const { chainName, endpoint } = useChain()

  if (result?.error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 my-1">
        Error: {String(result.error)}
      </div>
    )
  }

  const label = getLabel(toolName, result)
  const bookmarked = isBookmarked(toolName, label)
  const existingBookmark = bookmarks.find((b) => b.tool_name === toolName && b.label === label)

  const toggleBookmark = async () => {
    if (bookmarked && existingBookmark) {
      await removeBookmark(existingBookmark.id)
    } else {
      await addBookmark({
        toolName,
        label,
        result,
        chainName: chainName || undefined,
        chainEndpoint: endpoint || undefined,
      })
    }
  }

  const renderCard = () => {
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
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1">
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
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1 space-y-1">
            <div><span className="text-muted-foreground">Contract: </span><span className="font-medium">{String(result.account_name)}</span></div>
            <div><span className="text-muted-foreground">Actions: </span>{(result.actions || []).join(", ")}</div>
            <div><span className="text-muted-foreground">Tables: </span>{(result.tables || []).join(", ")}</div>
          </div>
        )
      case "build_transaction":
        return <TxProposalCard data={result as any} onTxError={onTxError} />
      case "get_actions":
        return <ActionsCard data={result as any} />
      case "get_transfers":
        return <TransfersCard data={result as any} />
      case "get_tokens":
        return <TokensCard data={result as any} />
      case "get_created_accounts":
        return (
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1 space-y-1">
            <div><span className="text-muted-foreground">Accounts created by </span><span className="font-medium">{String(result.query_account)}</span></div>
            <div className="font-mono text-xs">
              {(result.accounts as Array<{ name?: string; timestamp?: string }> || []).map((a, i) => (
                <div key={i} className="flex justify-between py-0.5">
                  <span>{a.name || "??"}</span>
                  <span className="text-muted-foreground">{a.timestamp ? new Date(a.timestamp).toLocaleDateString() : ""}</span>
                </div>
              ))}
              {(!result.accounts || (result.accounts as unknown[]).length === 0) && <span className="text-muted-foreground">None found</span>}
            </div>
          </div>
        )
      case "get_creator":
        return (
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1">
            <span className="text-muted-foreground">Account </span>
            <span className="font-medium">{String(result.account)}</span>
            <span className="text-muted-foreground"> was created by </span>
            <span className="font-medium">{String(result.creator)}</span>
            {result.timestamp && (
              <span className="text-muted-foreground"> on {new Date(String(result.timestamp)).toLocaleDateString()}</span>
            )}
          </div>
        )
      case "get_key_accounts":
        return (
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1">
            <div className="text-muted-foreground mb-1">Accounts for key:</div>
            <div className="font-mono text-xs space-y-0.5">
              {(result.account_names as string[] || []).map((name, i) => (
                <div key={i}>{name}</div>
              ))}
              {(!result.account_names || (result.account_names as unknown[]).length === 0) && <span className="text-muted-foreground">None found</span>}
            </div>
          </div>
        )
      case "get_contract_guide":
        return (
          <div className="text-xs bg-muted/50 rounded-md px-3 py-1.5 my-1 flex items-center gap-1.5 text-muted-foreground">
            <BookOpen className="h-3 w-3 shrink-0" />
            <span>Loaded guide for <span className="font-medium text-foreground">{String(result.contract)}</span></span>
            {result.summary && <span className="hidden sm:inline">— {String(result.summary)}</span>}
          </div>
        )
      default:
        return <pre className="text-xs bg-muted p-2 rounded overflow-auto my-1">{JSON.stringify(result, null, 2)}</pre>
    }
  }

  return (
    <div className="relative group">
      {renderCard()}
      {!result?.error && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); toggleBookmark() }}
        >
          <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-primary text-primary" : ""}`} />
        </Button>
      )}
    </div>
  )
}
