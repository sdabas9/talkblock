export type CardSize = "compact" | "medium" | "wide"

// Hardcoded per-tool size. Tools not listed default to "medium".
const SIZE_MAP: Record<string, CardSize> = {
  // Compact — single key fact, no detail list
  get_account: "compact",
  get_currency_balance: "compact",
  get_creator: "compact",

  // Medium — small structured payload
  get_block: "medium",
  get_transaction: "medium",
  get_tokens: "medium",
  get_abi: "medium",
  build_transaction: "medium",
  get_key_accounts: "medium",
  get_contract_guide: "medium",

  // Wide — long lists / tables that benefit from full row
  get_actions: "wide",
  get_transfers: "wide",
  get_table_rows: "wide",
  get_producers: "wide",
  get_created_accounts: "wide",
}

export function getCardSize(toolName: string): CardSize {
  return SIZE_MAP[toolName] ?? "medium"
}
