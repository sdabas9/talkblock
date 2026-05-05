# Quick Actions Pinned Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chain-aware "Quick actions" sidebar section with five pre-filled shortcuts (Powerup, Show balance, Buy RAM, Stake, Transfer) that inject a tx-proposal or balance card into chat on click.

**Architecture:** Hardcoded registry of `QuickAction` entries, each with an `applicableChains` filter and a `build()` that returns either a tx-proposal or a tool-result payload. Click → `build()` → wrap in a bookmark-shaped detail with a `quickAction: true` flag → fire the existing `bookmark-show` window event. The chat-panel handler appends a synthetic assistant message; the existing renderer takes care of the card. The `quickAction` flag tells the handler to skip the "Saved just now" timestamp text that's only meaningful for real bookmarks.

**Tech Stack:** Next.js / React 19 (client components), `@/lib/stores/wallet-store` for `walletAccount`, `@/lib/stores/chain-store` for `chainName`/`endpoint`, `@/lib/antelope/client` (`AntelopeClient.getCurrencyBalance`) for the balance pin's RPC call, lucide-react icons. No server changes, no DB changes, no new tests (project has no test runner; verify via build + manual browser checks).

---

## Reality check vs. the spec

Confirmed during plan-writing:

- Chain name strings used by the app are exactly `"EOS Mainnet"`, `"Telos Mainnet"`, `"WAX Mainnet"`, `"Jungle4 Testnet"`, `"FIO Mainnet"`, `"Libre"` (`lib/stores/chain-store.tsx:7-12`). The registry's `applicableChains` MUST use these exact strings.
- The `build_transaction` tool returns `{ type: "transaction_proposal", description, actions, status: "pending_signature" }` (`lib/llm/tools.ts:319-325`). Quick-action tx pins MUST emit this same shape so `TxProposalCard` renders correctly.
- The chat-panel bookmark-show handler (`components/chat/chat-panel.tsx:137-187`) appends an assistant message whose synthetic id starts with `bookmark-`, which means our `lib/llm/optimize-messages.ts` rewrite already handles them when sent to the LLM.
- `AntelopeClient.getCurrencyBalance(code, account)` is the existing RPC helper (used at `lib/antelope/refetch.ts:71-77`). The balance pin reuses it.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/quick-actions/types.ts` | Create | Shared types: `QuickActionContext`, `QuickActionInjection`, `QuickAction`, `TxProposal`. |
| `lib/quick-actions/build-tx.ts` | Create | Pure helper that takes a description and a list of actions and returns a `TxProposal`. |
| `lib/quick-actions/registry.ts` | Create | The five `QuickAction` entries. |
| `lib/quick-actions/dispatch.ts` | Create | `dispatchQuickAction(action, ctx)`: runs `build()`, wraps in bookmark-shaped detail with `quickAction: true`, fires `bookmark-show` event. |
| `components/chat/chat-panel.tsx` | Modify | Handler reads `detail.quickAction`; if true, omit the staleNote text part. |
| `components/layout/left-panel.tsx` | Modify | Render the "Quick actions" section between chain info and Bookmarks; filter by chain; disable when no wallet. |

No new files outside `lib/quick-actions/` and the two existing components. No server changes.

---

## Task 1: Types and tx builder

**Files:**
- Create: `lib/quick-actions/types.ts`
- Create: `lib/quick-actions/build-tx.ts`

- [ ] **Step 1: Create the types file**

Create `/Users/sachitdabas/explorer/lib/quick-actions/types.ts` with:

```typescript
import type { LucideIcon } from "lucide-react"

export interface TxAction {
  account: string
  name: string
  data: Record<string, unknown>
}

export interface TxProposal {
  type: "transaction_proposal"
  description: string
  actions: TxAction[]
  status: "pending_signature"
}

export interface QuickActionContext {
  walletAccount: string
  chainName: string
  chainEndpoint: string | null
  hyperionEndpoint: string | null
}

export type QuickActionInjection =
  | { kind: "tx"; txProposal: TxProposal }
  | { kind: "tool-result"; toolName: string; result: Record<string, unknown> }

export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  applicableChains: string[] | "*"
  build: (ctx: QuickActionContext) => Promise<QuickActionInjection> | QuickActionInjection
}
```

- [ ] **Step 2: Create the tx builder helper**

Create `/Users/sachitdabas/explorer/lib/quick-actions/build-tx.ts` with:

```typescript
import type { TxAction, TxProposal } from "./types"

export function buildTxProposal(description: string, actions: TxAction[]): TxProposal {
  return {
    type: "transaction_proposal",
    description,
    actions,
    status: "pending_signature",
  }
}
```

- [ ] **Step 3: Verify both files compile**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/sachitdabas/explorer
git add lib/quick-actions/types.ts lib/quick-actions/build-tx.ts
git commit -m "feat: types and tx-proposal builder for quick actions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Quick action registry (the five pins)

**Files:**
- Create: `lib/quick-actions/registry.ts`

- [ ] **Step 1: Create the registry**

Create `/Users/sachitdabas/explorer/lib/quick-actions/registry.ts` with:

```typescript
import { Zap, Wallet, Database, Coins, Send } from "lucide-react"
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
```

- [ ] **Step 2: Verify compile**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/sachitdabas/explorer
git add lib/quick-actions/registry.ts
git commit -m "feat: quick-action registry (powerup, balance, buyram, stake, transfer)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Dispatch utility

**Files:**
- Create: `lib/quick-actions/dispatch.ts`

- [ ] **Step 1: Create dispatch helper**

Create `/Users/sachitdabas/explorer/lib/quick-actions/dispatch.ts` with:

```typescript
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

  window.dispatchEvent(new CustomEvent("bookmark-show", { detail }))
}
```

- [ ] **Step 2: Verify compile**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/sachitdabas/explorer
git add lib/quick-actions/dispatch.ts
git commit -m "feat: quick-action dispatch via bookmark-show event

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Skip staleNote in chat-panel for quick actions

**Files:**
- Modify: `components/chat/chat-panel.tsx` (the bookmark-show handler at lines 137-187)

- [ ] **Step 1: Read the current handler**

Open `/Users/sachitdabas/explorer/components/chat/chat-panel.tsx` and find the bookmark-show effect (starts around line 137: `useEffect(() => { const handler = async (e: Event) => { ... } ... })`).

- [ ] **Step 2: Add the `quickAction` branch**

Replace the section that builds `staleNote` and the message parts. Locate this block:

```typescript
const now = new Date()
const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
const staleNote = refreshed
  ? `Refreshed at ${timeStr}`
  : `Saved ${formatAge(bookmark.created_at)}`

const cardMessage: UIMessage = {
  id: `bookmark-${bookmark.id}-${Date.now()}`,
  role: "assistant",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: [
    {
      type: `tool-${bookmark.tool_name}`,
      toolCallId: `bookmark-${bookmark.id}`,
      state: "output-available",
      input: {},
      output: resultData,
    } as any,
    {
      type: "text",
      text: staleNote,
    },
  ],
}
setMessages((prev) => [...prev, cardMessage])
```

Change to:

```typescript
const isQuickAction = (bookmark as { quickAction?: boolean }).quickAction === true

const now = new Date()
const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
const staleNote = refreshed
  ? `Refreshed at ${timeStr}`
  : `Saved ${formatAge(bookmark.created_at)}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parts: any[] = [
  {
    type: `tool-${bookmark.tool_name}`,
    toolCallId: `bookmark-${bookmark.id}`,
    state: "output-available",
    input: {},
    output: resultData,
  },
]
if (!isQuickAction) {
  parts.push({ type: "text", text: staleNote })
}

const cardMessage: UIMessage = {
  id: `bookmark-${bookmark.id}-${Date.now()}`,
  role: "assistant",
  parts,
}
setMessages((prev) => [...prev, cardMessage])
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/chat/chat-panel.tsx
git commit -m "feat: skip staleNote for quick-action injected messages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Quick actions section in the sidebar

**Files:**
- Modify: `components/layout/left-panel.tsx`

- [ ] **Step 1: Add imports**

At the top of `/Users/sachitdabas/explorer/components/layout/left-panel.tsx`, extend imports:

```typescript
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { QUICK_ACTIONS, isApplicable } from "@/lib/quick-actions/registry"
import { dispatchQuickAction } from "@/lib/quick-actions/dispatch"
```

(`useChain` is likely already imported — check the existing import block and only add what's missing. The file already imports `useHistory`; mirror that pattern.)

Also extend the existing `lucide-react` import line to include the icons used by the section heading:

```typescript
import { ..., Sparkles } from "lucide-react"
```

- [ ] **Step 2: Read the chain & wallet context inside `LeftPanel`**

In the `LeftPanel` function body, near where `useHistory()` is called, add:

```typescript
const { chainName, endpoint, hyperionEndpoint } = useChain()
const { accountName: walletAccount } = useWallet()
```

(If `chainName` is already destructured from an existing `useChain()` call, just add the missing fields.)

- [ ] **Step 3: Compute the visible quick actions**

Below the destructuring, add:

```typescript
const visibleQuickActions = QUICK_ACTIONS.filter((a) => isApplicable(a, chainName))
```

- [ ] **Step 4: Add a click handler**

In the same scope, add:

```typescript
const handleQuickAction = (actionId: string) => {
  if (!walletAccount || !chainName) return
  const action = QUICK_ACTIONS.find((a) => a.id === actionId)
  if (!action) return
  dispatchQuickAction(action, {
    walletAccount,
    chainName,
    chainEndpoint: endpoint,
    hyperionEndpoint,
  }).catch(console.error)
}
```

- [ ] **Step 5: Render the section**

Find the existing JSX block for `{view === "chat" && (` followed by the `<Separator />` and `Bookmarks` section. **Above** the existing Bookmarks `<div>` (i.e., between the `<Separator />` and the bookmarks `<div>`), insert:

```tsx
{visibleQuickActions.length > 0 && (
  <>
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        Quick actions
      </h3>
      {!walletAccount && (
        <p className="text-xs text-muted-foreground mb-1.5">Connect wallet to enable</p>
      )}
      <div className="space-y-0">
        {visibleQuickActions.map((action) => {
          const Icon = action.icon
          const disabled = !walletAccount
          return (
            <button
              key={action.id}
              disabled={disabled}
              onClick={() => handleQuickAction(action.id)}
              className={`flex items-center gap-1.5 text-xs text-left w-full py-0.5 transition-colors ${
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:text-primary cursor-pointer"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
    <Separator />
  </>
)}
```

The trailing `<Separator />` keeps Quick actions visually distinct from the Bookmarks block that follows.

- [ ] **Step 6: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/sachitdabas/explorer
git add components/layout/left-panel.tsx
git commit -m "feat: quick-actions section in sidebar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Push, deploy, manual verification

**Files:** none (git push + browser).

- [ ] **Step 1: Push**

```bash
cd /Users/sachitdabas/explorer && git push origin main
```

- [ ] **Step 2: Wait for Vercel deploy**

```bash
SHA=$(cd /Users/sachitdabas/explorer && git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

Expected: `Vercel: success`.

- [ ] **Step 3: Manual browser checks**

On https://talkblock.me, signed in with a wallet:

1. Connect to **Telos Mainnet**. Sidebar should show all five pins (Powerup, Show balance, Buy RAM, Stake, Transfer).
2. Connect to **WAX Mainnet**. Pins should be: Show balance, Buy RAM, Transfer (Powerup and Stake hidden).
3. Connect to **Libre**. Pins should be: Show balance, Transfer.
4. Disconnect wallet — pins render disabled with "Connect wallet to enable" hint above them.
5. Reconnect wallet. Click **Transfer** → a TxProposalCard appears in chat with `from = your account`, `to/quantity/memo` blank. **No** "Saved just now" timestamp text appears under the card.
6. Click **Show balance** → a balance card renders inline with your account's TLOS/EOS/WAX balance (whatever the chain).
7. Edit the `to` and `quantity` fields on the Transfer card from step 5; click the bookmark icon on it. Confirm the saved bookmark uses your edited values (this is regression coverage for the fix shipped earlier today).
8. Send a follow-up chat message after the quick-action card. The chat should respond — confirms the synthetic message's `bookmark-quick-…` id triggers the optimize-messages rewrite and Anthropic accepts the conversation.

If step 8 fails with a stream error, the synthetic id rewrite isn't matching `bookmark-`. Re-check `lib/llm/optimize-messages.ts` and ensure the prefix matches.

---

## Done criteria

- Sidebar shows a "Quick actions" section between chain info and Bookmarks, populated only with chain-applicable pins.
- Each tx pin click renders a `TxProposalCard` pre-filled with the user's account; user can fill remaining fields and sign.
- Show balance click renders a balance card with the live balance (or an inline error on RPC failure).
- No "Saved just now" timestamp under quick-action injected cards.
- Follow-up chat after a quick-action injection does not trigger an Anthropic 400 (the optimize-messages rewrite handles the synthetic id).
- All commits pushed to main; Vercel deploy succeeds.
