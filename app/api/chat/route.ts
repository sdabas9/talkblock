import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { createLLMModel } from "@/lib/llm/provider"
import { createChainTools } from "@/lib/llm/tools"

export async function POST(req: Request) {
  const provider = req.headers.get("x-llm-provider")
  const apiKey = req.headers.get("x-llm-api-key")
  const model = req.headers.get("x-llm-model")
  const chainEndpoint = req.headers.get("x-chain-endpoint")

  if (!provider || !apiKey || !model) {
    return new Response("Missing LLM configuration", { status: 400 })
  }

  const { messages } = await req.json()

  const llmModel = createLLMModel(provider, apiKey, model)
  const tools = createChainTools(chainEndpoint || null)

  const systemPrompt = `You are an Antelope blockchain explorer assistant. You help users understand and interact with Antelope-based blockchains (EOS, WAX, Telos, etc.).

You have access to tools that let you query on-chain data in real-time. Use them to answer questions about accounts, transactions, blocks, smart contracts, and token balances.

When a user wants to perform an action on the blockchain (transfer tokens, stake resources, buy RAM, vote for producers, etc.), use the build_transaction tool to create a transaction proposal. The user will review and sign it with their wallet.

Guidelines:
- Always use tools to fetch real data rather than making assumptions
- Present data clearly and explain what it means
- When building transactions, explain what the transaction will do before proposing it
- If the chain endpoint is not connected, let the user know they need to connect first
- Be concise but informative

${chainEndpoint ? "Connected chain endpoint: " + chainEndpoint : "No chain connected — inform the user they should connect to a chain to query on-chain data."}`

  const result = streamText({
    model: llmModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
