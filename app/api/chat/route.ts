import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { createLLMModel } from "@/lib/llm/provider"
import { createChainTools } from "@/lib/llm/tools"
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, chainEndpoint: chainEp, hyperionEndpoint: hyperionEp, walletAccount, llmConfig } = body
  const chainEndpoint = chainEp || ""
  const hyperionEndpoint = hyperionEp || ""

  let llmProvider = ""
  let llmApiKey = ""
  let llmModelName = ""

  // Try DB config if authed
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
      const supabase = createAdminClient()
      const { data: settings } = await supabase
        .from("user_settings")
        .select("llm_provider, llm_model, llm_api_key")
        .eq("user_id", decoded.sub)
        .single()

      if (settings?.llm_provider && settings?.llm_api_key && settings?.llm_model) {
        llmProvider = settings.llm_provider
        llmApiKey = settings.llm_api_key
        llmModelName = settings.llm_model
      }
    } catch {
      // Token invalid or DB error — fall through to body config
    }
  }

  // Fall back to body config if DB didn't provide it
  if (!llmProvider && llmConfig?.provider && llmConfig?.apiKey && llmConfig?.model) {
    llmProvider = llmConfig.provider
    llmApiKey = llmConfig.apiKey
    llmModelName = llmConfig.model
  }

  if (!llmProvider || !llmApiKey || !llmModelName) {
    return new Response("LLM not configured", { status: 400 })
  }

  const llmModel = createLLMModel(llmProvider, llmApiKey, llmModelName)
  const tools = createChainTools(chainEndpoint || null, hyperionEndpoint || null)

  const systemPrompt = `You are an Antelope blockchain explorer assistant. You help users understand and interact with Antelope-based blockchains (EOS, WAX, Telos, etc.).

You have access to tools that let you query on-chain data in real-time. Use them to answer questions about accounts, transactions, blocks, smart contracts, and token balances.

When a user wants to perform an action on the blockchain (transfer tokens, stake resources, buy RAM, vote for producers, etc.), use the build_transaction tool to create a transaction proposal. The user will review and sign it with their wallet.

Guidelines:
- Always use tools to fetch real data rather than making assumptions
- Present data clearly and explain what it means
- When building transactions, ONLY call the build_transaction tool. Do NOT add any text before or after the tool call — no explanations, no summaries, no "here's your transaction" text. The tool result renders as an editable form card, which is all the user needs to see. Any extra text clutters the UI.
- When the user reports a transaction error (e.g. "[Transaction Error: ...]"), analyze the error message and automatically attempt to build a corrected transaction. Common fixes include: adjusting token precision/symbol, fixing account names, checking permissions, or adjusting resource amounts.
- If the chain endpoint is not connected, let the user know they need to connect first
- Be concise but informative
- When you receive a [System: ...] message about a chain or wallet change, introduce yourself briefly (1-2 sentences), mention what chain/account they're on, and suggest a few things you can help with. Don't repeat the system message — just respond naturally as a greeting.

${chainEndpoint ? "Connected chain endpoint: " + chainEndpoint : "No chain connected — inform the user they should connect to a chain to query on-chain data."}

${hyperionEndpoint ? "Hyperion history API is available. You can query full action history, token transfers, account creation history, token holdings across all contracts, and key-to-account lookups using the get_actions, get_transfers, get_created_accounts, get_creator, get_tokens, and get_key_accounts tools." : ""}

${walletAccount ? `The user's connected wallet account is: ${walletAccount}. When they say "my account", "my balance", etc., use this account name. When building transactions, use this as the "from" account.` : "No wallet connected."}`

  const result = streamText({
    model: llmModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
