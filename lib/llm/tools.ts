import { tool, type ToolSet } from "ai"
import { z } from "zod"
import { AntelopeClient } from "@/lib/antelope/client"
import { HyperionClient } from "@/lib/antelope/hyperion"
import { getContractGuide, listAvailableGuides } from "@/lib/contracts"

export function createChainTools(endpoint: string | null, hyperionEndpoint: string | null = null, chainName: string | null = null): ToolSet {
  if (!endpoint) return {}

  const client = new AntelopeClient(endpoint)

  const tools: ToolSet = {
    get_account: tool({
      description:
        "Get detailed information about an Antelope blockchain account including balances, resources (RAM, CPU, NET), and permissions.",
      inputSchema: z.object({
        account_name: z
          .string()
          .describe("The account name to look up (e.g. 'eosio.token')"),
      }),
      execute: async ({ account_name }) => {
        try {
          const account = await client.getAccount(account_name)
          return {
            account_name: account.account_name,
            balance: account.core_liquid_balance || "0",
            ram: { used: account.ram_usage, quota: account.ram_quota },
            cpu: account.cpu_limit,
            net: account.net_limit,
            cpu_staked: account.total_resources?.cpu_weight || "0",
            net_staked: account.total_resources?.net_weight || "0",
            permissions: account.permissions.map((p) => ({
              name: p.perm_name,
              parent: p.parent,
              threshold: p.required_auth.threshold,
              keys: p.required_auth.keys,
              accounts: p.required_auth.accounts,
            })),
            voter_info: account.voter_info || null,
          }
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : "Failed to fetch account",
          }
        }
      },
    }),

    get_block: tool({
      description: "Get information about a specific block by block number.",
      inputSchema: z.object({
        block_num: z.number().describe("The block number to look up"),
      }),
      execute: async ({ block_num }) => {
        try {
          const block = await client.getBlock(block_num)
          return {
            block_num: block.block_num,
            id: block.id,
            timestamp: block.timestamp,
            producer: block.producer,
            confirmed: block.confirmed,
            transaction_count: block.transactions?.length || 0,
            transactions: (block.transactions || [])
              .slice(0, 10)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((tx: any) => ({
                id: typeof tx.trx === "string" ? tx.trx : tx.trx?.id,
                status: tx.status,
                cpu_usage_us: tx.cpu_usage_us,
                net_usage_words: tx.net_usage_words,
              })),
          }
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : "Failed to fetch block",
          }
        }
      },
    }),

    get_transaction: tool({
      description:
        "Look up a transaction by its transaction ID. Note: requires history plugin on the endpoint.",
      inputSchema: z.object({
        transaction_id: z
          .string()
          .describe("The transaction ID (hash) to look up"),
      }),
      execute: async ({ transaction_id }) => {
        try {
          const tx = await client.getTransaction(transaction_id)
          return {
            id: tx.id,
            block_num: tx.block_num,
            block_time: tx.block_time,
            actions: tx.trx?.trx?.actions || [],
            status: tx.trx?.receipt?.status,
          }
        } catch (e) {
          return {
            error:
              e instanceof Error ? e.message : "Failed to fetch transaction",
          }
        }
      },
    }),

    get_table_rows: tool({
      description:
        "Query rows from a smart contract table. Use this to read on-chain data from any contract.",
      inputSchema: z.object({
        code: z
          .string()
          .describe("The contract account name (e.g. 'eosio.token')"),
        table: z.string().describe("The table name (e.g. 'accounts')"),
        scope: z
          .string()
          .describe(
            "The scope (usually the account name or contract name)"
          ),
        limit: z
          .number()
          .optional()
          .describe("Max rows to return (default 10)"),
        lower_bound: z.string().optional().describe("Lower bound for key"),
        upper_bound: z.string().optional().describe("Upper bound for key"),
        index_position: z
          .string()
          .optional()
          .describe(
            "Secondary index position (e.g. '2' for first secondary index). Default '1' is the primary key."
          ),
        key_type: z
          .string()
          .optional()
          .describe(
            "Key type for secondary index (e.g. 'i64', 'i128', 'name', 'sha256')"
          ),
        reverse: z
          .boolean()
          .optional()
          .describe("Return rows in reverse order (newest first)"),
      }),
      execute: async ({
        code,
        table,
        scope,
        limit,
        lower_bound,
        upper_bound,
        index_position,
        key_type,
        reverse,
      }) => {
        try {
          const result = await client.getTableRows({
            code,
            table,
            scope,
            limit,
            lower_bound,
            upper_bound,
            index_position,
            key_type,
            reverse,
          })
          return {
            code,
            table,
            scope,
            ...(lower_bound ? { lower_bound } : {}),
            ...(upper_bound ? { upper_bound } : {}),
            ...result,
          }
        } catch (e) {
          return {
            error:
              e instanceof Error ? e.message : "Failed to fetch table rows",
          }
        }
      },
    }),

    get_abi: tool({
      description:
        "Get the ABI (Application Binary Interface) of a smart contract. Shows available tables, actions, and data structures.",
      inputSchema: z.object({
        account_name: z.string().describe("The contract account name"),
      }),
      execute: async ({ account_name }) => {
        try {
          const result = await client.getAbi(account_name)
          const abi = result.abi
          if (!abi) return { error: "No ABI found for this account" }
          // Only include structs referenced by actions to reduce token usage
          const actionTypes = new Set(abi.actions?.map((a: any) => a.type) || [])
          return {
            account_name: result.account_name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tables: abi.tables?.map((t: any) => t.name) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actions: abi.actions?.map((a: any) => a.name) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            structs:
              abi.structs
                ?.filter((s: any) => actionTypes.has(s.name))
                .map((s: any) => ({
                  name: s.name,
                  fields: s.fields,
                })) || [],
          }
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : "Failed to fetch ABI",
          }
        }
      },
    }),

    get_currency_balance: tool({
      description:
        "Get token balances for an account from a specific token contract.",
      inputSchema: z.object({
        code: z
          .string()
          .describe("The token contract (e.g. 'eosio.token')"),
        account: z.string().describe("The account to check balance for"),
        symbol: z
          .string()
          .optional()
          .describe("Token symbol filter (e.g. 'EOS')"),
      }),
      execute: async ({ code, account, symbol }) => {
        try {
          const balances = await client.getCurrencyBalance(
            code,
            account,
            symbol
          )
          return { account, balances }
        } catch (e) {
          return {
            error:
              e instanceof Error ? e.message : "Failed to fetch balance",
          }
        }
      },
    }),

    get_producers: tool({
      description: "Get the list of block producers on the chain.",
      inputSchema: z.object({
        limit: z
          .number()
          .optional()
          .describe("Max producers to return (default 21)"),
      }),
      execute: async ({ limit }) => {
        try {
          const result = await client.getProducers(limit || 21)
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            producers: result.rows.map((p: any) => ({
              owner: p.owner,
              total_votes: p.total_votes,
              url: p.url,
              is_active: p.is_active,
              unpaid_blocks: p.unpaid_blocks,
            })),
            total_producer_vote_weight: result.total_producer_vote_weight,
          }
        } catch (e) {
          return {
            error:
              e instanceof Error ? e.message : "Failed to fetch producers",
          }
        }
      },
    }),

    build_transaction: tool({
      description:
        "Build a transaction proposal for the user to review and sign. Use this when the user wants to perform any on-chain action (transfer tokens, stake, buy RAM, etc). The transaction will be shown to the user for approval — they must explicitly sign it.",
      inputSchema: z.object({
        actions: z
          .array(
            z.object({
              account: z.string().describe("The contract to call"),
              name: z.string().describe("The action name"),
              data: z
                .record(z.string(), z.any())
                .describe("The action data"),
            })
          )
          .describe("The actions to include in the transaction"),
        description: z
          .string()
          .describe(
            "Human-readable description of what this transaction does"
          ),
      }),
      execute: async ({ actions, description }) => {
        return {
          type: "transaction_proposal" as const,
          description,
          actions,
          status: "pending_signature" as const,
        }
      },
    }),

    get_contract_guide: tool({
      description:
        "Look up a curated guide for interacting with a specific smart contract. Returns detailed action workflows, parameter formats, table query patterns (correct scope, lower_bound, upper_bound), and common gotchas. ALWAYS call this before querying contract-specific tables (like REX, staking, NFTs) or building transactions. The guide tells you exactly which table, scope, and bounds to use.",
      inputSchema: z.object({
        contract: z
          .string()
          .describe("The contract account name (e.g. 'eosio.system', 'eosio.token', 'atomicassets')"),
      }),
      execute: async ({ contract }) => {
        const guide = getContractGuide(contract, chainName || undefined)
        if (guide) {
          return {
            contract: guide.contract,
            chains: guide.chains,
            summary: guide.summary,
            guide: guide.guide,
          }
        }
        // No curated guide — return available guides list as hint
        const available = listAvailableGuides(chainName || undefined)
        return {
          contract,
          error: `No curated guide found for "${contract}".`,
          available_guides: available.map((g) => g.contract),
          hint: "You can still use get_abi to inspect this contract's actions and tables.",
        }
      },
    }),
  }

  // Add Hyperion-powered tools when a Hyperion endpoint is available
  if (hyperionEndpoint) {
    const hyperion = new HyperionClient(hyperionEndpoint)

    tools.get_actions = tool({
      description:
        "Get action history for an account from Hyperion. Returns recent actions with full trace data. Can filter by contract:action.",
      inputSchema: z.object({
        account: z.string().describe("The account name to get actions for"),
        filter: z.string().optional().describe("Filter by contract:action (e.g. 'eosio.token:transfer')"),
        limit: z.number().optional().describe("Max results to return (default 20)"),
        skip: z.number().optional().describe("Number of results to skip for pagination"),
        after: z.string().optional().describe("Only actions after this ISO8601 date"),
        before: z.string().optional().describe("Only actions before this ISO8601 date"),
      }),
      execute: async ({ account, filter, limit, skip, after, before }) => {
        try {
          const result = await hyperion.getActions({
            account,
            filter,
            limit: limit || 10,
            skip,
            after,
            before,
            simple: true,
          })
          // Trim oversized data fields to reduce token usage
          const actions = (result.simple_actions || result.actions || []).map((a: any) => {
            if (a.data && JSON.stringify(a.data).length > 500) {
              const keys = Object.keys(a.data)
              const trimmed: Record<string, any> = {}
              for (const k of keys.slice(0, 5)) trimmed[k] = a.data[k]
              if (keys.length > 5) trimmed._trimmed = `${keys.length - 5} more fields`
              return { ...a, data: trimmed }
            }
            return a
          })
          return {
            actions,
            account,
            total: result.total || { value: 0, relation: "eq" },
          }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to fetch actions" }
        }
      },
    })

    tools.get_transfers = tool({
      description:
        "Get token transfer history for an account. Shows all incoming and outgoing transfers.",
      inputSchema: z.object({
        account: z.string().describe("The account to get transfers for"),
        symbol: z.string().optional().describe("Filter by token symbol (e.g. 'EOS')"),
        contract: z.string().optional().describe("Filter by token contract (default 'eosio.token')"),
        limit: z.number().optional().describe("Max results to return (default 20)"),
        after: z.string().optional().describe("Only transfers after this ISO8601 date"),
        before: z.string().optional().describe("Only transfers before this ISO8601 date"),
      }),
      execute: async ({ account, contract, limit, after, before }) => {
        try {
          // Use get_actions with transfer filter — more widely supported than get_transfers
          const filter = `${contract || "eosio.token"}:transfer`
          const result = await hyperion.getActions({
            account,
            filter,
            limit: limit || 20,
            after,
            before,
            simple: true,
          })
          const actions = result.simple_actions || result.actions || []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const transfers = actions.map((a: any) => ({
            timestamp: a.timestamp || a["@timestamp"],
            from: a.data?.from,
            to: a.data?.to,
            quantity: a.data?.quantity,
            memo: a.data?.memo,
            contract: a.contract,
            block: a.block,
          }))
          return { transfers, account }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to fetch transfers" }
        }
      },
    })

    tools.get_created_accounts = tool({
      description: "Get all accounts that were created by a given account.",
      inputSchema: z.object({
        account: z.string().describe("The creator account name"),
      }),
      execute: async ({ account }) => {
        try {
          const result = await hyperion.getCreatedAccounts(account)
          return { accounts: result.accounts || [], query_account: account }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to fetch created accounts" }
        }
      },
    })

    tools.get_creator = tool({
      description: "Find out who created a specific account and when.",
      inputSchema: z.object({
        account: z.string().describe("The account name to look up the creator for"),
      }),
      execute: async ({ account }) => {
        try {
          const result = await hyperion.getCreator(account)
          return {
            account,
            creator: result.creator,
            timestamp: result.timestamp,
          }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to fetch creator" }
        }
      },
    })

    tools.get_tokens = tool({
      description:
        "Get all token balances held by an account across all contracts. Richer than get_currency_balance as it discovers all tokens automatically.",
      inputSchema: z.object({
        account: z.string().describe("The account name to get token balances for"),
      }),
      execute: async ({ account }) => {
        try {
          const result = await hyperion.getTokens(account)
          return { tokens: result.tokens || [], account }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to fetch tokens" }
        }
      },
    })

    tools.get_key_accounts = tool({
      description: "Get all accounts associated with a given public key.",
      inputSchema: z.object({
        public_key: z.string().describe("The public key to look up (e.g. 'EOS6MR...')"),
      }),
      execute: async ({ public_key }) => {
        try {
          const result = await hyperion.getKeyAccounts(public_key)
          return { account_names: result.account_names || [] }
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Failed to fetch key accounts" }
        }
      },
    })
  }

  return tools
}
