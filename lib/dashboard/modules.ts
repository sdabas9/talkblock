export type Module = "tile" | "panel" | "wide"

// Per-tool grid module. Tools not listed default to "panel" — a new/unknown
// bookmarked tool slots in as a standard 2x2 panel (rendered by kv-panel).
const MODULE_MAP: Record<string, Module> = {
  // tile — single key fact, lives in the stat strip
  get_currency_balance: "tile",
  get_creator: "tile",
  get_account: "tile",
  get_key_accounts: "tile",

  // wide — long lists / tables, full grid row
  get_table_rows: "wide",
  get_producers: "wide",
  get_actions: "wide",
  get_transfers: "wide",

  // everything else (get_block, get_transaction, get_tokens, get_abi,
  // build_transaction, get_created_accounts, unknown tools) → "panel"
}

export function getModule(toolName: string): Module {
  return MODULE_MAP[toolName] ?? "panel"
}

const TYPE_LABEL: Record<string, string> = {
  get_account: "Account",
  get_block: "Block",
  get_transaction: "Transaction",
  get_table_rows: "Table",
  get_currency_balance: "Balance",
  get_abi: "ABI",
  get_producers: "Producers",
  build_transaction: "Proposal",
  get_actions: "Actions",
  get_transfers: "Transfers",
  get_tokens: "Tokens",
  get_created_accounts: "Accounts",
  get_creator: "Creator",
  get_key_accounts: "Key",
}

export function getTypeLabel(toolName: string): string {
  return TYPE_LABEL[toolName] || "Data"
}
