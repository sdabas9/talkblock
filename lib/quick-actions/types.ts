import type { LucideIcon } from "lucide-react"

export interface TxAction {
  account: string
  name: string
  data: Record<string, unknown>
}

export interface TxProposal {
  type: "transaction_proposal"
  description: string
  actions: TxAction[]
  status: "pending_signature"
}

export interface QuickActionContext {
  walletAccount: string
  chainName: string
  chainEndpoint: string | null
  hyperionEndpoint: string | null
}

export type QuickActionInjection =
  | { kind: "tx"; txProposal: TxProposal }
  | { kind: "tool-result"; toolName: string; result: Record<string, unknown> }

export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  applicableChains: string[] | "*"
  build: (ctx: QuickActionContext) => Promise<QuickActionInjection> | QuickActionInjection
}
