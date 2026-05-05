import type { TxAction, TxProposal } from "./types"

export function buildTxProposal(description: string, actions: TxAction[]): TxProposal {
  return {
    type: "transaction_proposal",
    description,
    actions,
    status: "pending_signature",
  }
}
