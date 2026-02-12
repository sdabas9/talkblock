/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-side message optimization for LLM token usage.
 *
 * Replaces old tool result outputs with compact one-line summaries and
 * applies message windowing so only the most recent exchanges are sent
 * in full. The client keeps full data for UI card rendering — this
 * optimisation is invisible to the user.
 */

// ---------------------------------------------------------------------------
// Types (minimal — we only need the shape the AI SDK passes around)
// ---------------------------------------------------------------------------

interface ToolResultPart {
  type: string // e.g. "tool-invocation"
  state?: string
  toolName?: string
  output?: any
  [key: string]: any
}

interface Message {
  role: string
  parts?: ToolResultPart[]
  content?: string | any[]
  [key: string]: any
}

interface OptimizeOptions {
  /** Number of most-recent tool-result rounds to keep in full (default 2) */
  keepRecentToolRounds?: number
  /** Max message count (user+assistant pairs × 2) before windowing (default 20) */
  maxMessages?: number
}

// ---------------------------------------------------------------------------
// Per-tool summarizers
// ---------------------------------------------------------------------------

type Summarizer = (output: any) => string

const summarizers: Record<string, Summarizer> = {
  get_account(o) {
    if (o.error) return `get_account error: ${o.error}`
    const ramPct =
      o.ram?.quota > 0
        ? Math.round((o.ram.used / o.ram.quota) * 100)
        : 0
    return `Account ${o.account_name}: balance ${o.balance}, RAM ${ramPct}% used, CPU staked ${o.cpu_staked}`
  },

  get_abi(o) {
    if (o.error) return `get_abi error: ${o.error}`
    const actions = (o.actions || []).slice(0, 5).join(", ")
    const tables = (o.tables || []).slice(0, 5).join(", ")
    return `ABI for ${o.account_name}: ${(o.actions || []).length} actions [${actions}], ${(o.tables || []).length} tables [${tables}]`
  },

  get_actions(o) {
    if (o.error) return `get_actions error: ${o.error}`
    const total = o.total?.value ?? 0
    const recent = (o.actions || [])
      .slice(0, 3)
      .map((a: any) => {
        const contract = a.contract || a.act?.account || "?"
        const name = a.action || a.act?.name || "?"
        return `${contract}::${name}`
      })
      .join(", ")
    return `Action history: ${total} total. Recent: ${recent}`
  },

  get_table_rows(o) {
    if (o.error) return `get_table_rows error: ${o.error}`
    const rows = Array.isArray(o.rows) ? o.rows.length : 0
    const more = o.more ? " (more available)" : ""
    return `Table query: ${rows} rows returned${more}`
  },

  get_tokens(o) {
    if (o.error) return `get_tokens error: ${o.error}`
    const tokens = o.tokens || []
    const top = tokens
      .slice(0, 3)
      .map((t: any) => `${t.amount ?? t.balance ?? "?"} ${t.symbol ?? ""}`)
      .join(", ")
    return `Tokens for ${o.account}: ${tokens.length} tokens. Top: ${top}`
  },

  get_transfers(o) {
    if (o.error) return `get_transfers error: ${o.error}`
    const count = (o.transfers || []).length
    return `Transfer history for ${o.account}: ${count} transfers returned`
  },

  get_block(o) {
    if (o.error) return `get_block error: ${o.error}`
    return `Block #${o.block_num}: producer ${o.producer}, ${o.transaction_count} txs, time ${o.timestamp}`
  },

  get_transaction(o) {
    if (o.error) return `get_transaction error: ${o.error}`
    const id = typeof o.id === "string" ? o.id.slice(0, 8) + "..." : "?"
    const actionCount = Array.isArray(o.actions) ? o.actions.length : 0
    return `Tx ${id}: ${o.status || "executed"}, block ${o.block_num}, ${actionCount} actions`
  },

  get_currency_balance(o) {
    if (o.error) return `get_currency_balance error: ${o.error}`
    const bals = (o.balances || []).join(", ")
    return `Balances for ${o.account}: ${bals}`
  },

  get_producers(o) {
    if (o.error) return `get_producers error: ${o.error}`
    const producers = o.producers || []
    const top = producers
      .slice(0, 5)
      .map((p: any) => p.owner)
      .join(", ")
    return `${producers.length} block producers. Top: ${top}`
  },

  get_created_accounts(o) {
    if (o.error) return `get_created_accounts error: ${o.error}`
    const count = (o.accounts || []).length
    return `${count} accounts created by ${o.query_account}`
  },

  get_creator(o) {
    if (o.error) return `get_creator error: ${o.error}`
    return `Account ${o.account} created by ${o.creator} on ${o.timestamp || "unknown date"}`
  },

  get_key_accounts(o) {
    if (o.error) return `get_key_accounts error: ${o.error}`
    const names = (o.account_names || []).join(", ")
    return `${(o.account_names || []).length} accounts found: ${names}`
  },

  build_transaction(o) {
    if (o.error) return `build_transaction error: ${o.error}`
    return `Transaction proposal (${o.status}): ${o.description || "action"}`
  },

  get_contract_guide(o) {
    if (o.error) return `get_contract_guide: ${o.error}`
    return `Contract guide for ${o.contract}: ${o.summary || "loaded"}`
  },
}

function summarizeToolOutput(toolName: string, output: any): string {
  const fn = summarizers[toolName]
  if (fn) {
    try {
      return fn(output)
    } catch {
      // Fall through to generic summarizer
    }
  }
  // Fallback: truncated JSON
  try {
    return JSON.stringify(output).slice(0, 200)
  } catch {
    return "[tool output]"
  }
}

// ---------------------------------------------------------------------------
// Core optimisation
// ---------------------------------------------------------------------------

export function optimizeMessagesForLLM<T extends Message>(
  messages: T[],
  options?: OptimizeOptions,
): T[] {
  const keepRecent = options?.keepRecentToolRounds ?? 2
  const maxMessages = options?.maxMessages ?? 20

  // Deep clone so we never mutate the caller's data
  let msgs: T[] = JSON.parse(JSON.stringify(messages))

  // --- Tool result summarization ---
  // Walk assistant messages in reverse, counting tool-result rounds.
  // A "round" is one assistant message that contains at least one tool result.
  let toolRoundsSeen = 0

  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i]
    if (msg.role !== "assistant" || !Array.isArray(msg.parts)) continue

    const hasToolResult = msg.parts.some(
      (p) => p.type === "tool-invocation" && p.state === "result",
    )
    if (!hasToolResult) continue

    toolRoundsSeen++
    if (toolRoundsSeen <= keepRecent) continue

    // Summarize tool outputs in this older message
    for (const part of msg.parts) {
      if (part.type === "tool-invocation" && part.state === "result" && part.output !== undefined) {
        const summary = summarizeToolOutput(part.toolName || "", part.output)
        part.output = { _summarized: true, summary }
      }
    }
  }

  // --- Message windowing ---
  if (msgs.length > maxMessages) {
    const firstUserMsg = msgs.find((m) => m.role === "user")
    const recentMsgs = msgs.slice(-maxMessages)

    const bridge = {
      role: "assistant" as const,
      content: "[Prior conversation context omitted for brevity]",
    } as T

    if (firstUserMsg && recentMsgs[0] !== firstUserMsg) {
      msgs = [firstUserMsg, bridge, ...recentMsgs]
    } else {
      msgs = [bridge, ...recentMsgs]
    }
  }

  return msgs
}
