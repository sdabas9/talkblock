import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

/**
 * Custom fetch for Chutes that wraps reasoning_content in <think> tags
 * so extractReasoningMiddleware can parse it. Only injects tags when
 * reasoning_content actually appears in the stream.
 */
function chutesReasoningFetch(
  originalFetch: typeof globalThis.fetch
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await originalFetch(input, init)

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.includes("text/event-stream")) {
      return response
    }

    let seenReasoning = false
    let reasoningEnded = false

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        const lines = text.split("\n")
        const outputLines: string[] = []

        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") {
            outputLines.push(line)
            continue
          }

          try {
            const json = JSON.parse(line.slice(6))
            const delta = json.choices?.[0]?.delta
            if (!delta) {
              outputLines.push(line)
              continue
            }

            if (delta.reasoning_content != null) {
              // Move reasoning_content → content, wrapping with <think> on first chunk
              delta.content = (!seenReasoning ? "<think>" : "") + delta.reasoning_content
              delete delta.reasoning_content
              seenReasoning = true
              outputLines.push("data: " + JSON.stringify(json))
              continue
            }

            if (delta.content != null && seenReasoning && !reasoningEnded) {
              // First content chunk after reasoning — close the think tag
              delta.content = "</think>" + delta.content
              reasoningEnded = true
              outputLines.push("data: " + JSON.stringify(json))
              continue
            }

            outputLines.push(line)
          } catch {
            outputLines.push(line)
          }
        }

        controller.enqueue(new TextEncoder().encode(outputLines.join("\n")))
      },
      flush(controller) {
        // Stream ended while still in reasoning — close the tag
        if (seenReasoning && !reasoningEnded) {
          const closeEvent = "data: " + JSON.stringify({
            choices: [{ delta: { content: "</think>" } }],
          }) + "\n\n"
          controller.enqueue(new TextEncoder().encode(closeEvent))
        }
      },
    })

    const body = response.body!.pipeThrough(transformStream)
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}

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
    case "chutes": {
      const chutes = createOpenAI({
        apiKey,
        baseURL: "https://llm.chutes.ai/v1",
        name: "chutes",
        fetch: chutesReasoningFetch(globalThis.fetch),
      })
      return chutes.chat(model)
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}
