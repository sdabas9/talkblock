import { KvPanel } from "./kv-panel"
import { TransfersPanel } from "./transfers-panel"
import { ActionsPanel } from "./actions-panel"
import { TablePanel } from "./table-panel"
import { TokensPanel } from "./tokens-panel"
import { BlockPanel } from "./block-panel"
import { TransactionPanel } from "./transaction-panel"
import { AbiPanel } from "./abi-panel"
import { CreatedAccountsPanel } from "./created-accounts-panel"
import { TxProposalCard } from "@/components/chat/cards/tx-proposal-card"

interface DashboardRendererProps {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
}

// Single entry point: maps a bookmark's tool to its dashboard-native renderer.
// Unknown tools fall through to KvPanel.
export function DashboardRenderer({ toolName, result }: DashboardRendererProps) {
  switch (toolName) {
    case "get_transfers":
      return <TransfersPanel data={result} />
    case "get_actions":
      return <ActionsPanel data={result} />
    case "get_table_rows":
      return <TablePanel data={result} />
    case "get_producers":
      return <TablePanel data={{ rows: result.producers || [] }} />
    case "get_tokens":
      return <TokensPanel data={result} />
    case "get_block":
      return <BlockPanel data={result} />
    case "get_transaction":
      return <TransactionPanel data={result} />
    case "get_abi":
      return <AbiPanel data={result} />
    case "get_created_accounts":
      return <CreatedAccountsPanel data={result} />
    case "build_transaction":
      // Deliberate exception (see spec): interactive signing machinery is
      // embedded as-is rather than rebuilt terminal-style in v1.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <TxProposalCard data={result as any} />
    default:
      return <KvPanel result={result} />
  }
}
