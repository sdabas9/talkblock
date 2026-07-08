import { KvPanel } from "./kv-panel"

interface DashboardRendererProps {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: Record<string, any>
}

// Single entry point: maps a bookmark's tool to its dashboard-native renderer.
// Unknown tools fall through to KvPanel.
export function DashboardRenderer({ toolName, result }: DashboardRendererProps) {
  switch (toolName) {
    default:
      return <KvPanel result={result} />
  }
}
