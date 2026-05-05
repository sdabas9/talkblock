import type { QuickAction, QuickActionContext } from "./types"

// Quick actions reuse the existing chat-panel "bookmark-show" event handler:
// it appends a synthetic assistant message containing a tool-result part. The
// `quickAction: true` flag tells the handler to skip the "Saved just now"
// staleNote text part that's only meaningful for real bookmarks.
export async function dispatchQuickAction(
  action: QuickAction,
  ctx: QuickActionContext,
): Promise<void> {
  const injection = await action.build(ctx)

  const toolName =
    injection.kind === "tx" ? "build_transaction" : injection.toolName
  const result =
    injection.kind === "tx" ? injection.txProposal : injection.result

  const detail = {
    id: `bookmark-quick-${action.id}-${Date.now()}`,
    tool_name: toolName,
    result,
    chain_endpoint: null, // suppress refetch in the chat-panel handler
    created_at: new Date().toISOString(),
    quickAction: true,
  }

  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("bookmark-show", { detail }))
}
