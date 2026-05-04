import { streamText, convertToModelMessages, stepCountIs, wrapLanguageModel, extractReasoningMiddleware, createUIMessageStream, JsonToSseTransformStream, UI_MESSAGE_STREAM_HEADERS } from "ai"
import { createLLMModel } from "@/lib/llm/provider"
import { createChainTools } from "@/lib/llm/tools"
import { optimizeMessagesForLLM } from "@/lib/llm/optimize-messages"
import { listAvailableGuides } from "@/lib/contracts"
import { createAdminClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/check"
import { checkUsageAllowance, recordUsage } from "@/lib/billing/credits"
import { getAppConfig } from "@/lib/config"
import jwt from "jsonwebtoken"

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, chainEndpoint: chainEp, hyperionEndpoint: hyperionEp, walletAccount, chainId: bodyChainId, chainName: bodyChainName, llmConfig } = body
  const chainEndpoint = chainEp || ""
  const hyperionEndpoint = hyperionEp || ""

  let llmProvider = ""
  let llmApiKey = ""
  let llmModelName = ""
  let billingMode: "free" | "paid" | "byok" = "byok"
  let userId: string | null = null

  // Try DB config if authed (only when Supabase is configured)
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (token && isSupabaseConfigured()) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
      userId = decoded.sub
      const supabase = createAdminClient()!
      const { data: settings } = await supabase
        .from("user_settings")
        .select("llm_provider, llm_model, llm_api_key, llm_mode")
        .eq("user_id", decoded.sub)
        .single()

      const llmMode = settings?.llm_mode || "builtin"

      if (llmMode === "builtin") {
        // Built-in mode: use Chutes with app's API key
        const usageCheck = await checkUsageAllowance(bodyChainId || "", walletAccount || "")
        if (!usageCheck.allowed) {
          return Response.json(
            { error: usageCheck.reason || "Out of credits" },
            { status: 402 }
          )
        }
        llmProvider = "chutes"
        llmApiKey = process.env.CHUTES_API_KEY!
        const defaultModel = await getAppConfig("chutes_default_model", "deepseek-ai/DeepSeek-V3-0324")
        llmModelName = settings?.llm_model || defaultModel
        billingMode = usageCheck.mode
      } else if (llmMode === "byok") {
        // BYOK mode: keys come from client request body, not server
        // Fall through to body config below
      }
    } catch {
      // Token invalid or DB error — fall through to body config
    }
  }

  // Fall back to body config if DB didn't provide it (unauthenticated BYOK)
  if (!llmProvider && llmConfig?.provider && llmConfig?.apiKey && llmConfig?.model) {
    llmProvider = llmConfig.provider
    llmApiKey = llmConfig.apiKey
    llmModelName = llmConfig.model
    billingMode = "byok"
  }

  if (!llmProvider || !llmApiKey || !llmModelName) {
    return new Response("LLM not configured", { status: 400 })
  }

  const tools = createChainTools(chainEndpoint || null, hyperionEndpoint || null, bodyChainName || null)

  // Build available contract guides list for system prompt
  const availableGuides = listAvailableGuides(bodyChainName || undefined)
  const guidesListStr = availableGuides.length > 0
    ? `\nContract guides available (use get_contract_guide tool to load): ${availableGuides.map((g) => g.contract).join(", ")}`
    : ""

  const systemPrompt = `You are an Antelope blockchain explorer assistant. You help users understand and interact with Antelope-based blockchains (EOS, WAX, Telos, etc.).

You have access to tools that let you query on-chain data in real-time. Use them to answer questions about accounts, transactions, blocks, smart contracts, and token balances.

When a user wants to perform an action on the blockchain (transfer tokens, stake resources, buy RAM, vote for producers, etc.), use the build_transaction tool to create a transaction proposal. The user will review and sign it with their wallet.

Guidelines:
- Always use tools to fetch real data rather than making assumptions
- IMPORTANT: After ALL tool calls are complete, you MUST write a short text summary explaining the results to the user. Never end your response with just a tool result — always add a brief human-readable explanation. For example, after querying a table, summarize what the data shows. After building a transaction, explain what it does.
- When building transactions, add a brief one-line message before the tool call explaining what the transaction does (e.g. "Here's a transaction to sell your REX and withdraw the proceeds:"). Keep it short — the card itself shows all the details.
- When the user asks to build a transaction but doesn't provide all required fields, do NOT ask them for the missing values. Instead, build the transaction immediately with empty strings ("") for unknown fields. The transaction card has editable fields so the user can fill them in directly. After the tool call, mention which fields they need to fill in before signing.
- When the user reports a transaction error (e.g. "[Transaction Error: ...]"), analyze the error message and automatically attempt to build a corrected transaction. Common fixes include: adjusting token precision/symbol, fixing account names, checking permissions, or adjusting resource amounts.
- Before querying contract-specific data (REX balances, staking info, NFT assets, governance ballots) or building transactions, ALWAYS call get_contract_guide first. The guide tells you the exact table names, scopes, and lower_bound/upper_bound patterns to use. Without the guide you will likely use wrong scopes or miss required bounds.
- When no contract guide is available, call get_abi to check the action's parameters before building the transaction. Only include the fields the ABI defines — do NOT guess or add extra parameters. If the action takes no parameters, use an empty data object ({}).
- When the guide contains FOLLOW-UP instructions, you MUST follow them. For example: when a user asks to sell REX, first query their rexbal, then ASK the user if they also want to withdraw the proceeds before building any transaction. If they say yes, build a single multi-action transaction with both sellrex + withdraw. Do NOT skip the follow-up question.
- If the chain endpoint is not connected, let the user know they need to connect first
- Be concise but informative
- IMPORTANT: Always wrap account names and transaction IDs in backtick code formatting (e.g. \`eosio.ram\`, \`eccentricity\`, \`6b696f...8819\`). Never use bold for account names — use inline code so they render as clickable elements in the UI.
- When you receive a [System: ...] message about a chain or wallet change, introduce yourself briefly (1-2 sentences), mention what chain/account they're on, and suggest a few things you can help with. Don't repeat the system message — just respond naturally as a greeting.

${chainEndpoint ? "Connected chain endpoint: " + chainEndpoint : "No chain connected — inform the user they should connect to a chain to query on-chain data."}

${hyperionEndpoint ? "Hyperion history API is available. You can query full action history, token transfers, account creation history, token holdings across all contracts, and key-to-account lookups using the get_actions, get_transfers, get_created_accounts, get_creator, get_tokens, and get_key_accounts tools. Additional Hyperion tools: get_deltas (table change history), get_voters (producer voter lists), get_proposals (MSIG proposals), get_links (permission links), get_transacted_accounts (who an account transacts with), get_abi_snapshot (contract ABI at a past block)." : ""}

${walletAccount ? `The user's connected wallet account is: ${walletAccount}. When they say "my account", "my balance", etc., use this account name. When building transactions, use this as the "from" account.` : "No wallet connected."}${guidesListStr}`

  const optimizedMessages = optimizeMessagesForLLM(messages)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedMessages = await convertToModelMessages(optimizedMessages as any)

  const baseConfig = {
    system: systemPrompt,
    messages: convertedMessages,
    tools,
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(5),
  }

  const makeOnFinish = (modelUsed: string) =>
    async ({ usage }: { usage: { inputTokens?: number; outputTokens?: number } }) => {
      if (bodyChainId && walletAccount && billingMode !== "byok") {
        await recordUsage(
          bodyChainId,
          walletAccount,
          billingMode as "free" | "paid",
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
          modelUsed
        )
      }
    }

  // Chutes path: try primary, fall back to chutes_fallback_model on early stream error.
  // streamText returns immediately and the upstream call happens lazily during
  // iteration; the previous try/catch never saw 429/404/etc. errors. By iterating
  // toUIMessageStream() ourselves we can detect a failure before any chunk is
  // forwarded and retry with the fallback model transparently.
  if (llmProvider === "chutes") {
    const fallbackModelName = await getAppConfig("chutes_fallback_model")
    const candidates = [llmModelName, fallbackModelName]
      .filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i)

    const buildChutes = (name: string) =>
      wrapLanguageModel({
        model: createLLMModel("chutes", llmApiKey, name),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      })

    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        let lastErr: unknown = null
        for (let i = 0; i < candidates.length; i++) {
          const name = candidates[i]
          const isLast = i === candidates.length - 1
          const result = streamText({
            model: buildChutes(name),
            ...baseConfig,
            onFinish: makeOnFinish(name),
          })

          let yieldedAny = false
          try {
            for await (const chunk of result.toUIMessageStream()) {
              yieldedAny = true
              writer.write(chunk)
            }
            return
          } catch (err) {
            if (yieldedAny || isLast) throw err
            console.error(`[chat] chutes ${name} failed before output, trying fallback:`, err)
            lastErr = err
          }
        }
        if (lastErr) throw lastErr
      },
      onError: (e) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[chat] uiStream onError:", msg)
        return msg
      },
    })

    return new Response(
      uiStream.pipeThrough(new JsonToSseTransformStream()),
      { headers: UI_MESSAGE_STREAM_HEADERS },
    )
  }

  // Non-Chutes providers (anthropic / openai / google) — direct stream, no fallback configured.
  const llmModel = createLLMModel(llmProvider, llmApiKey, llmModelName)
  const result = streamText({
    model: llmModel,
    ...baseConfig,
    onFinish: makeOnFinish(llmModelName),
  })
  return result.toUIMessageStreamResponse()
}
