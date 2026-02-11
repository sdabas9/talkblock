import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export function createLLMModel(provider: string, apiKey: string, model: string) {
  switch (provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(model)
    }
    case "openai": {
      const openai = createOpenAI({ apiKey })
      return openai(model)
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(model)
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
