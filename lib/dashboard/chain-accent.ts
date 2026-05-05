const NEUTRAL = "oklch(0.6 0 0)"

const CHAIN_ACCENT: Record<string, string> = {
  "Telos Mainnet":   "oklch(0.7 0.15 195)",   // teal
  "EOS Mainnet":     "oklch(0.62 0.2 260)",   // blue
  "WAX Mainnet":     "oklch(0.6 0.22 300)",   // purple
  "Jungle4 Testnet": "oklch(0.7 0.18 145)",   // green
  "FIO Mainnet":     "oklch(0.78 0.18 70)",   // amber
  "Libre":           "oklch(0.65 0.22 25)",   // red
}

export function chainAccent(chainName: string | null | undefined): string {
  if (!chainName) return NEUTRAL
  return CHAIN_ACCENT[chainName] ?? NEUTRAL
}
