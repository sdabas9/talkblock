import { KvPanel } from "./kv-panel"
import { TransfersPanel } from "./transfers-panel"
import { ActionsPanel } from "./actions-panel"

interface DashboardRendererProps {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
}

// Single entry point: maps a bookmark's tool to its dashboard-native renderer.
// Unknown tools fall through to KvPanel.
export function DashboardRenderer({ toolName, result }: DashboardRendererProps) {
  switch (toolName) {
    case "get_transfers":
      return <TransfersPanel data={result} />
    case "get_actions":
      return <ActionsPanel data={result} />
    default:
      return <KvPanel result={result} />
  }
}
