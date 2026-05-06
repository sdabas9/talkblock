import { Zap, Wallet, Database, Coins, Send, Bolt } from "lucide-react"
import { AntelopeClient } from "@/lib/antelope/client"
import { buildTxProposal } from "./build-tx"
import type { QuickAction } from "./types"

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "powerup",
    label: "Powerup",
    icon: Zap,
    applicableChains: ["Telos Mainnet", "EOS Mainnet"],
    build: (ctx) => ({
      kind: "tx",
      txProposal: buildTxProposal("Power up CPU/NET", [
        {
          account: "eosio",
          name: "powerup",
          data: {
            payer: ctx.walletAccount,
            receiver: ctx.walletAccount,
            days: 1,
            net_frac: "",
            cpu_frac: "",
            max_payment: "",
          },
        },
      ]),
    }),
  },
  {
    id: "quickpowerup",
    label: "Quick Powerup",
    icon: Bolt,
    applicableChains: ["EOS Mainnet"],
    build: (ctx) => ({
      kind: "tx",
      txProposal: buildTxProposal("Quick Powerup (98% CPU / 2% NET)", [
        {
          account: "core.vaulta",
          name: "transfer",
          data: {
            from: ctx.walletAccount,
            to: "quickpowerup",
            quantity: "",
            memo: `${ctx.walletAccount} 98`,
          },
        },
      ]),
    }),
  },
  {
    id: "balance",
    label: "Show balance",
    icon: Wallet,
    applicableChains: "*",
    build: async (ctx) => {
      if (!ctx.chainEndpoint) {
        return {
          kind: "tool-result",
          toolName: "get_currency_balance",
          result: { account: ctx.walletAccount, error: "No chain endpoint connected" },
        }
      }
      try {
        const client = new AntelopeClient(ctx.chainEndpoint)
        const balances = await client.getCurrencyBalance("eosio.token", ctx.walletAccount)
        return {
          kind: "tool-result",
          toolName: "get_currency_balance",
          result: { account: ctx.walletAccount, balances },
        }
      } catch (e) {
        return {
          kind: "tool-result",
          toolName: "get_currency_balance",
          result: {
            account: ctx.walletAccount,
            error: e instanceof Error ? e.message : "Failed to fetch balance",
          },
        }
      }
    },
  },
  {
    id: "buyram",
    label: "Buy RAM",
    icon: Database,
    applicableChains: ["Telos Mainnet", "EOS Mainnet", "WAX Mainnet"],
    build: (ctx) => ({
      kind: "tx",
      txProposal: buildTxProposal("Buy RAM", [
        {
          account: "eosio",
          name: "buyram",
          data: {
            payer: ctx.walletAccount,
            receiver: ctx.walletAccount,
            quant: "",
          },
        },
      ]),
    }),
  },
  {
    id: "stake",
    label: "Stake",
    icon: Coins,
    applicableChains: ["Telos Mainnet", "EOS Mainnet"],
    build: (ctx) => ({
      kind: "tx",
      txProposal: buildTxProposal("Stake CPU and NET", [
        {
          account: "eosio",
          name: "delegatebw",
          data: {
            from: ctx.walletAccount,
            receiver: ctx.walletAccount,
            stake_net_quantity: "",
            stake_cpu_quantity: "",
            transfer: false,
          },
        },
      ]),
    }),
  },
  {
    id: "transfer",
    label: "Transfer",
    icon: Send,
    applicableChains: "*",
    build: (ctx) => ({
      kind: "tx",
      txProposal: buildTxProposal("Transfer tokens", [
        {
          account: "eosio.token",
          name: "transfer",
          data: {
            from: ctx.walletAccount,
            to: "",
            quantity: "",
            memo: "",
          },
        },
      ]),
    }),
  },
]

export function isApplicable(action: QuickAction, chainName: string | null): boolean {
  if (!chainName) return false
  if (action.applicableChains === "*") return true
  return action.applicableChains.includes(chainName)
}
