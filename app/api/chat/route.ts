import { streamText, convertToModelMessages, stepCountIs, wrapLanguageModel, extractReasoningMiddleware } from "ai"
import { createLLMModel } from "@/lib/llm/provider"
import { createChainTools } from "@/lib/llm/tools"
import { optimizeMessagesForLLM } from "@/lib/llm/optimize-messages"
import { listAvailableGuides } from "@/lib/contracts"
import { createAdminClient } from "@/lib/supabase/server"
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

  // Try DB config if authed
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
      userId = decoded.sub
      const supabase = createAdminClient()
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
      } else if (settings?.llm_provider && settings?.llm_api_key && settings?.llm_model) {
        // BYOK mode with server-stored keys
        llmProvider = settings.llm_provider
        llmApiKey = settings.llm_api_key
        llmModelName = settings.llm_model
        billingMode = "byok"
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

  let llmModel = createLLMModel(llmProvider, llmApiKey, llmModelName)
  if (llmProvider === "chutes") {
    llmModel = wrapLanguageModel({
      model: llmModel,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    })
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
- When the user reports a transaction error (e.g. "[Transaction Error: ...]"), analyze the error message and automatically attempt to build a corrected transaction. Common fixes include: adjusting token precision/symbol, fixing account names, checking permissions, or adjusting resource amounts.
- Before querying contract-specific data (REX balances, staking info, NFT assets, governance ballots) or building transactions, ALWAYS call get_contract_guide first. The guide tells you the exact table names, scopes, and lower_bound/upper_bound patterns to use. Without the guide you will likely use wrong scopes or miss required bounds.
- When the guide contains FOLLOW-UP instructions, you MUST follow them. For example: when a user asks to sell REX, first query their rexbal, then ASK the user if they also want to withdraw the proceeds before building any transaction. If they say yes, build a single multi-action transaction with both sellrex + withdraw. Do NOT skip the follow-up question.
- If the chain endpoint is not connected, let the user know they need to connect first
- Be concise but informative
- When you receive a [System: ...] message about a chain or wallet change, introduce yourself briefly (1-2 sentences), mention what chain/account they're on, and suggest a few things you can help with. Don't repeat the system message — just respond naturally as a greeting.

${chainEndpoint ? "Connected chain endpoint: " + chainEndpoint : "No chain connected — inform the user they should connect to a chain to query on-chain data."}

${hyperionEndpoint ? "Hyperion history API is available. You can query full action history, token transfers, account creation history, token holdings across all contracts, and key-to-account lookups using the get_actions, get_transfers, get_created_accounts, get_creator, get_tokens, and get_key_accounts tools." : ""}

${walletAccount ? `The user's connected wallet account is: ${walletAccount}. When they say "my account", "my balance", etc., use this account name. When building transactions, use this as the "from" account.` : "No wallet connected."}${guidesListStr}`

  const optimizedMessages = optimizeMessagesForLLM(messages)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedMessages = await convertToModelMessages(optimizedMessages as any)

  const streamConfig = {
    system: systemPrompt,
    messages: convertedMessages,
    tools,
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(5),
    onFinish: async ({ usage }: { usage: { inputTokens?: number; outputTokens?: number } }) => {
      if (bodyChainId && walletAccount && billingMode !== "byok") {
        await recordUsage(
          bodyChainId,
          walletAccount,
          billingMode as "free" | "paid",
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
          llmModelName
        )
      }
    },
  }

  try {
    const result = streamText({ model: llmModel, ...streamConfig })
    return result.toUIMessageStreamResponse()
  } catch (e) {
    // Fallback model for Chutes if primary fails
    const fallbackModelName = await getAppConfig("chutes_fallback_model")
    if (llmProvider === "chutes" && fallbackModelName) {
      const fallbackModel = wrapLanguageModel({
        model: createLLMModel("chutes", llmApiKey, fallbackModelName),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      })
      const result = streamText({ model: fallbackModel, ...streamConfig })
      return result.toUIMessageStreamResponse()
    }
    throw e
  }
}
