# Cosigner + Credits Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace token-count billing with a flat credit-count model (1 credit per built-in chat message, 1 credit per cosigned txn) AND ship a `/api/cosign` endpoint that pays Vaulta CPU/NET on behalf of users via a `pay.talkblock` sponsor account with a linkauth-restricted `cosign` permission.

**Architecture:** Two halves. **Part A (credits unification)** retunes the existing billing path: change the meter from "input+output tokens" to a flat 1-per-event, raise free quota to 6/day, retune TLOS purchase rate to 250 credits/TLOS, migrate existing balances by dividing by 1000. Ships independently of Part B. **Part B (cosigner)** adds a new route `app/api/cosign/route.ts` that validates the action list, deducts 1 credit, prepends a `noop.talkblock::noop` action authorized by `pay.talkblock@cosign`, signs with a server-held key, and returns the packed tx + signature for the wallet to co-sign and broadcast. Depends on Part A's credit model and on a one-time on-chain setup of the sponsor + noop accounts.

**Tech Stack:** Next.js App Router (route handlers in `app/api/`), Supabase (existing `credit_balances` / `daily_usage` / `credit_transactions` tables, no schema change), `@wharfkit/antelope` for server-side transaction serialization and signing, `@wharfkit/session` (already loaded in the wallet store) for client-side wallet signing, `@wharfkit/wallet-plugin-anchor` for Anchor-specific signing.

---

## Pre-work (manual, before Part B can ship)

These steps must be done by hand on Vaulta and in Vercel before the cosigner code is deployed. Document timing here so the user can do them while Part A code is in review.

1. **Create accounts on Vaulta:**
   - `pay.talkblock` — sponsor account; will hold A stake for CPU/NET.
   - `noop.talkblock` — host the noop contract.
   Each ~3 A in stake (1 CPU + 1 NET + 1 RAM is fine to start; can expand later). Both accounts owned by the user's existing wallet account.

2. **Deploy noop contract** to `noop.talkblock`. Source (paste into a `.cpp`, compile with cdt, deploy via cleos/wharfkit):

   ```cpp
   #include <eosio/eosio.hpp>
   class [[eosio::contract]] noopc : public eosio::contract {
   public:
     using contract::contract;
     [[eosio::action]] void noop(std::string memo) {}
   };
   ```

3. **Add `cosign` permission to `pay.talkblock`:**
   - Generate a fresh keypair: `cleos create key --to-console` (or via wharfkit). Save the public key for chain, save the private key for Vercel env.
   - Add the permission with `pay.talkblock@active`:
     ```
     cleos set account permission pay.talkblock cosign '{"threshold":1,"keys":[{"key":"PUB_K1_<cosignPubKey>","weight":1}],"accounts":[],"waits":[]}' active
     ```
   - Link the cosign permission to ONLY the noop action:
     ```
     cleos set action permission pay.talkblock noop.talkblock noop cosign
     ```

4. **Stake A on `pay.talkblock`** for CPU/NET:
   - Send A to `pay.talkblock` (~50 A is a reasonable starting budget).
   - Then `core.vaulta::delegatebw` to stake to itself: `delegatebw {from: pay.talkblock, receiver: pay.talkblock, stake_net_quantity: "5.0000 A", stake_cpu_quantity: "45.0000 A", transfer: false}`.

5. **Add Vercel environment variables** (Production scope):
   - `COSIGN_PRIVATE_KEY=<the cosign private key from step 3>` (format: `PVT_K1_...`)
   - `COSIGN_ACCOUNT=pay.talkblock`
   - `COSIGN_PERMISSION=cosign`
   - `NOOP_CONTRACT=noop.talkblock`

The plan's Part B tasks will reference these env vars. Until they exist, Task B-2's manual probe will return 500.

---

## Part A — Credits unification

### Task A-1: Refactor billing constants and `recordUsage` signature

**Files:**
- Modify: `lib/billing/credits.ts`

The existing `recordUsage(chainId, account, mode, inputTokens, outputTokens, model)` deducts `inputTokens + outputTokens` from `balance_tokens`. We change it to take a credit count and a kind, deducting flat credits.

- [ ] **Step 1: Replace constants and refactor `recordUsage`**

Replace the top of `/Users/sachitdabas/explorer/lib/billing/credits.ts`:

Find:

```typescript
const FREE_REQUESTS_PER_DAY = 5
const TOKENS_PER_TLOS = 250000
```

Replace with:

```typescript
const FREE_REQUESTS_PER_DAY = 6
const CREDITS_PER_TLOS = 250
```

(The constant rename is local; `creditDeposit` will use the new name.)

- [ ] **Step 2: Update `creditDeposit` to use the new rate**

Find in the same file:

```typescript
const tokenUnits = Math.floor(tlosAmount * TOKENS_PER_TLOS)
```

Replace with:

```typescript
const tokenUnits = Math.floor(tlosAmount * CREDITS_PER_TLOS)
```

(The `balance_tokens` column keeps its name for migration simplicity but its values are credits going forward.)

- [ ] **Step 3: Refactor `recordUsage` signature**

Replace the entire `export async function recordUsage(...)` function with:

```typescript
export type UsageKind = "chat" | "cosign"

export async function recordUsage(
  chainId: string,
  accountName: string,
  mode: "free" | "paid",
  credits: number,
  kind: UsageKind,
  model?: string,
) {
  if (!isSupabaseConfigured()) return

  const supabase = createAdminClient()!
  const today = new Date().toISOString().split("T")[0]

  const { data: existing } = await supabase
    .from("daily_usage")
    .select("id, request_count")
    .eq("chain_id", chainId)
    .eq("account_name", accountName)
    .eq("date", today)
    .single()

  if (existing) {
    await supabase
      .from("daily_usage")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id)
  } else {
    await supabase.from("daily_usage").insert({
      chain_id: chainId,
      account_name: accountName,
      date: today,
      request_count: 1,
    })
  }

  if (mode === "paid") {
    const { data: balance } = await supabase
      .from("credit_balances")
      .select("balance_tokens")
      .eq("chain_id", chainId)
      .eq("account_name", accountName)
      .single()

    const currentBalance = balance?.balance_tokens ?? 0
    const newBalance = Math.max(0, currentBalance - credits)

    await supabase
      .from("credit_balances")
      .update({ balance_tokens: newBalance, updated_at: new Date().toISOString() })
      .eq("chain_id", chainId)
      .eq("account_name", accountName)

    await supabase.from("credit_transactions").insert({
      chain_id: chainId,
      account_name: accountName,
      type: "usage",
      total_tokens: credits,
      model: model ?? kind,
      token_units_delta: -credits,
      balance_after: newBalance,
    })
  }
}
```

What changed:
- Signature is now `(chainId, account, mode, credits, kind, model?)`.
- Free-tier counter (`request_count`) increments by 1 per event regardless of kind.
- Paid balance deducts exactly `credits` (was `inputTokens + outputTokens`).
- `daily_usage`'s `total_input_tokens` / `total_output_tokens` columns are no longer written — they remain in the table for historical rows but new rows leave them NULL.
- `credit_transactions` row stores `total_tokens: credits` (now meaning "credits") and `model: kind` when no specific model name is given. That preserves the existing `recent_transactions` UI without a UI change in this task.

- [ ] **Step 4: Build**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: TypeScript errors at every existing caller of `recordUsage` (chat route). That's expected — Task A-2 fixes them.

- [ ] **Step 5: Commit**

```bash
cd /Users/sachitdabas/explorer
git add lib/billing/credits.ts
git commit -m "refactor: credit-count billing in recordUsage (1 per event)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A-2: Update chat route to use new `recordUsage`

**Files:**
- Modify: `app/api/chat/route.ts`

Find the `makeOnFinish` helper added in the recent fallback refactor (around line ~120):

```typescript
const makeOnFinish = (modelUsed: string) =>
  async ({ usage }: { usage: { inputTokens?: number; outputTokens?: number } }) => {
    if (bodyChainId && walletAccount && billingMode !== "byok") {
      await recordUsage(
        bodyChainId,
        walletAccount,
        billingMode as "free" | "paid",
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        modelUsed
      )
    }
  }
```

Replace with:

```typescript
const makeOnFinish = (modelUsed: string) =>
  async (_args: { usage: { inputTokens?: number; outputTokens?: number } }) => {
    if (bodyChainId && walletAccount && billingMode !== "byok") {
      await recordUsage(
        bodyChainId,
        walletAccount,
        billingMode as "free" | "paid",
        1,            // 1 credit per chat message regardless of token count
        "chat",
        modelUsed,
      )
    }
  }
```

The `usage` arg is no longer read; renamed to `_args` to keep ESLint quiet. Token counts are intentionally discarded — the new metering is flat 1 credit per chat message.

- [ ] **Step 1: Apply the change above.**

- [ ] **Step 2: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/sachitdabas/explorer
git add app/api/chat/route.ts
git commit -m "refactor: chat path bills 1 credit per message

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task A-3: Data migration — divide existing balances and update app_config

**Files:**
- None (pure data migration via Supabase Management API).

This is a one-shot SQL run. Existing `balance_tokens` values are in token units (typical: 250000 per TLOS deposited). Divide by 1000 to convert to credits at the new rate (250 credits per TLOS). Update `app_config` to reflect the new rate and free-tier values.

- [ ] **Step 1: Run the migration SQL**

```bash
SBP="<supabase-personal-access-token>"   # see MEMORY.md
PROJ="nednzedwmguhqhfnszyh"

curl -s -X POST -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$PROJ/database/query" \
  -d '{"query":"
    UPDATE credit_balances SET balance_tokens = GREATEST(0, balance_tokens / 1000);
    UPDATE app_config SET value = $$250$$ WHERE key = $$tokens_per_tlos$$;
    INSERT INTO app_config (key, value, description, updated_at) VALUES
      ($$credits_per_tlos$$, $$250$$, $$Credits per TLOS (post-unification)$$, now()),
      ($$free_daily_credits$$, $$6$$, $$Free credits per day (chat + cosign combined)$$, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    SELECT key, value FROM app_config WHERE key LIKE $$%credits%$$ OR key LIKE $$tokens%$$ OR key = $$free_daily_credits$$ ORDER BY key;
  "}'
```

Expected output: a JSON array showing `credits_per_tlos = 250`, `free_daily_credits = 6`, and `tokens_per_tlos = 250` (kept aligned for any client that still reads it, though the code now uses the new constant).

- [ ] **Step 2: Spot-check a balance**

```bash
curl -s -X POST -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$PROJ/database/query" \
  -d '{"query":"SELECT chain_id, account_name, balance_tokens FROM credit_balances ORDER BY balance_tokens DESC LIMIT 5;"}'
```

Expected: balances are now 1000× smaller than before (e.g. a row that was `250000` is now `250`).

No git commit for this task — it's pure data. Note the run in conversation only.

---

### Task A-4: Update client copy from "tokens" to "credits"

**Files:**
- Modify: `lib/stores/credits-store.tsx`
- Modify: `components/layout/header.tsx` (the `UsageIndicator` component)
- Modify: `components/billing/purchase-credits-dialog.tsx`

These are display-only changes. The store fields keep their existing names for compat (e.g. `balanceTokens`) so existing consumers still compile.

- [ ] **Step 1: Update header `UsageIndicator` text**

Find in `components/layout/header.tsx` (around line 56 of the existing file):

```typescript
{freeRemaining > 0 ? (
  <>{freeRemaining} free left</>
) : balanceTokens > 0 ? (
  <>{Math.round(balanceTokens / 1000)}k tokens</>
) : (
  <span className="text-yellow-600 dark:text-yellow-400">No credits</span>
)}
```

Replace with:

```typescript
{freeRemaining > 0 ? (
  <>{freeRemaining} free credits</>
) : balanceTokens > 0 ? (
  <>{balanceTokens} credits</>
) : (
  <span className="text-yellow-600 dark:text-yellow-400">No credits</span>
)}
```

Note: drops the `/1000` divisor since the column now stores credits directly (Task A-3 migrated values).

- [ ] **Step 2: Update purchase dialog copy**

Open `components/billing/purchase-credits-dialog.tsx`. Find any text mentioning "tokens" in user-visible copy (likely "X tokens", "TLOS for tokens", etc.) and replace with "credits". The conversion math display (e.g. "1 TLOS = 250,000 tokens") should become "1 TLOS = 250 credits". The component reads its rate from `app_config.tokens_per_tlos` or from a hardcoded constant — verify and use `credits_per_tlos` (which Task A-3 set to 250).

If the dialog hardcodes the old rate, change the hardcoded value from `250000` to `250` and the display label from "tokens" to "credits". If it reads from `app_config`, update the key name to `credits_per_tlos` and the display label.

- [ ] **Step 3: Update `credits-store.tsx` initial value if needed**

Open `lib/stores/credits-store.tsx`. Find the line `useState(5)` for `freeRemaining` (line 41 of the file we've been seeing) and change to `useState(6)`. This is just the initial render value before the first server fetch — the server is the source of truth.

```typescript
const [freeRemaining, setFreeRemaining] = useState(6)
```

- [ ] **Step 4: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit and push Part A**

```bash
cd /Users/sachitdabas/explorer
git add lib/stores/credits-store.tsx components/layout/header.tsx components/billing/purchase-credits-dialog.tsx
git commit -m "refactor: credits-based labels in UI (header + purchase dialog)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 6: Wait for Vercel and smoke-test Part A**

```bash
SHA=$(cd /Users/sachitdabas/explorer && git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

Expected: success. Then in browser:
- Open the app, sign in.
- Send a chat message in built-in mode. Verify the credit indicator drops by 1 (or "free remaining" drops by 1 if still in free tier).
- Open purchase dialog and confirm copy says "credits" not "tokens" and the rate is 1 TLOS = 250 credits.

Part A is complete and shippable on its own.

---

## Part B — Cosigner

### Task B-1: Server-side noop signing helper

**Files:**
- Create: `lib/cosigner/sign.ts`

Self-contained helper that takes a list of action objects, prepends a noop authorized by the cosign permission, builds an Antelope `Transaction`, signs it with `COSIGN_PRIVATE_KEY`, and returns the packed tx + signatures + transaction object for client co-signing.

- [ ] **Step 1: Create the helper**

`/Users/sachitdabas/explorer/lib/cosigner/sign.ts`:

```typescript
import {
  APIClient,
  Action,
  PrivateKey,
  PublicKey,
  Serializer,
  SignedTransaction,
  Transaction,
  Name,
  Authority,
  Signature,
} from "@wharfkit/antelope"

export interface ActionInput {
  account: string
  name: string
  authorization: { actor: string; permission: string }[]
  data: Record<string, unknown>
}

export interface CosignedTx {
  packed_trx: string         // hex-encoded packed transaction
  signatures: string[]        // [cosign signature]
  transaction: Record<string, unknown> // full tx object for the client
}

const VAULTA_RPC = "https://eos.greymass.com"

/**
 * Build a transaction whose first action is a noop authorized by the
 * cosign permission, sign that noop with the cosign key, and return
 * the partially-signed transaction. The client-side wallet then signs
 * for the user actions and broadcasts the dual-signed result.
 *
 * Antelope's "first authorizer pays" rule means CPU/NET is billed to
 * the cosign account, not the user.
 */
export async function buildAndSignCosign(
  userActions: ActionInput[],
  expireSeconds: number = 300,
): Promise<CosignedTx> {
  const cosignAccount = process.env.COSIGN_ACCOUNT
  const cosignPermission = process.env.COSIGN_PERMISSION
  const noopContract = process.env.NOOP_CONTRACT
  const cosignPrivateKey = process.env.COSIGN_PRIVATE_KEY

  if (!cosignAccount || !cosignPermission || !noopContract || !cosignPrivateKey) {
    throw new Error("Cosigner not configured (missing env vars)")
  }

  const client = new APIClient({ url: VAULTA_RPC })

  // Get TAPOS reference from the chain
  const info = await client.v1.chain.get_info()
  const header = info.getTransactionHeader(expireSeconds)

  // Build the noop action authorized by cosign
  const noopAction: ActionInput = {
    account: noopContract,
    name: "noop",
    authorization: [{ actor: cosignAccount, permission: cosignPermission }],
    data: { memo: `tlbk-${Date.now()}` },
  }

  // Build the full action list — noop first
  const allActions = [noopAction, ...userActions]

  // Convert to wharfkit Action objects (need ABIs for serialization)
  const actions = await Promise.all(
    allActions.map(async (a) => {
      const abi = await client.v1.chain.get_abi(a.account)
      if (!abi.abi) throw new Error(`No ABI for ${a.account}`)
      return Action.from(
        {
          account: a.account,
          name: a.name,
          authorization: a.authorization,
          data: a.data,
        },
        abi.abi,
      )
    }),
  )

  // Construct the transaction
  const transaction = Transaction.from({
    ...header,
    actions,
  })

  // Sign only with the cosign key (signs the entire tx, but the noop is
  // the only action authorized by the cosign permission; the chain
  // validates per-action authorization separately)
  const cosignKey = PrivateKey.from(cosignPrivateKey)
  const cosignSig = cosignKey.signDigest(transaction.signingDigest(info.chain_id))

  const signedTx = SignedTransaction.from({
    ...transaction,
    signatures: [cosignSig],
  })

  return {
    packed_trx: Serializer.encode({ object: transaction }).hexString,
    signatures: [String(cosignSig)],
    transaction: Serializer.objectify(transaction) as Record<string, unknown>,
  }
}
```

Notes for the engineer:
- `@wharfkit/antelope` is already a transitive dep via `@wharfkit/session` (verify with `ls node_modules/@wharfkit/antelope` — it's there).
- `info.getTransactionHeader(expireSeconds)` produces the TAPOS fields (`expiration`, `ref_block_num`, `ref_block_prefix`).
- `Transaction.from({ ...header, actions })` constructs the wharfkit `Transaction` object.
- `transaction.signingDigest(chainId)` produces the digest that gets signed.
- `Serializer.encode({ object: transaction }).hexString` gets the packed transaction bytes as hex.
- The chain validates each action's `authorization` against the signatures present. The cosign key authorizes only the noop (per `linkauth`), so the user's wallet must independently sign for their actions' authorizations.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/sachitdabas/explorer && npx tsc --noEmit
```

Expected: clean. If `@wharfkit/antelope` types complain, the import path is `@wharfkit/antelope` (we confirmed via `ls node_modules/@wharfkit/antelope`).

- [ ] **Step 3: Commit**

```bash
cd /Users/sachitdabas/explorer
git add lib/cosigner/sign.ts
git commit -m "feat: server-side noop cosigner helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task B-2: `/api/cosign` route handler

**Files:**
- Create: `app/api/cosign/route.ts`

Auth (JWT) → eligibility (credits) → action validation → call helper → record usage → return.

- [ ] **Step 1: Create the route**

`/Users/sachitdabas/explorer/app/api/cosign/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/check"
import { checkUsageAllowance, recordUsage } from "@/lib/billing/credits"
import { buildAndSignCosign, type ActionInput } from "@/lib/cosigner/sign"
import jwt from "jsonwebtoken"

const VAULTA_CHAIN_ID = "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906"

function getUserId(req: Request): string | null {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
    return decoded.sub
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return Response.json({ error: "Auth unavailable" }, { status: 503 })

  let body: { chainId?: unknown; actions?: unknown; expireSeconds?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Chain check
  if (body.chainId !== VAULTA_CHAIN_ID) {
    return Response.json({ error: "Cosigner only supports Vaulta" }, { status: 403 })
  }

  // Action validation
  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return Response.json({ error: "actions[] required" }, { status: 400 })
  }

  const actions = body.actions as ActionInput[]
  const cosignAccount = process.env.COSIGN_ACCOUNT
  for (const a of actions) {
    if (!a.account || !a.name || !Array.isArray(a.authorization) || typeof a.data !== "object") {
      return Response.json({ error: "Malformed action" }, { status: 400 })
    }
    if (a.account === cosignAccount) {
      return Response.json({ error: "Actions cannot target the sponsor account" }, { status: 400 })
    }
  }

  // Expiration window — clamp to 60s..300s
  const expire = Math.min(300, Math.max(60, Number(body.expireSeconds) || 300))

  // Look up the user's wallet account from profiles
  const supabase = createAdminClient()!
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_name, chain_id")
    .eq("id", userId)
    .single()

  if (!profile) return Response.json({ error: "Profile not found" }, { status: 401 })
  if (profile.chain_id !== body.chainId) {
    return Response.json({ error: "User is on a different chain" }, { status: 403 })
  }

  // Eligibility check (credits)
  const allowance = await checkUsageAllowance(profile.chain_id, profile.account_name)
  if (!allowance.allowed) {
    return Response.json({ error: allowance.reason || "Out of credits" }, { status: 402 })
  }

  // Build, sign, deduct
  let signed
  try {
    signed = await buildAndSignCosign(actions, expire)
  } catch (e) {
    console.error("[cosign] sign failed:", e)
    return Response.json(
      { error: e instanceof Error ? e.message : "Sign failed" },
      { status: 500 },
    )
  }

  // Deduct 1 credit (records to daily_usage and credit_balances)
  await recordUsage(profile.chain_id, profile.account_name, allowance.mode, 1, "cosign")

  return Response.json({
    packed_trx: signed.packed_trx,
    signatures: signed.signatures,
    transaction: signed.transaction,
    creditsRemaining: Math.max(0, (allowance.balanceTokens ?? 0) - (allowance.mode === "paid" ? 1 : 0)),
    freeRemaining: Math.max(0, (allowance.freeRemaining ?? 0) - (allowance.mode === "free" ? 1 : 0)),
  })
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit and push**

```bash
cd /Users/sachitdabas/explorer
git add app/api/cosign/route.ts
git commit -m "feat: POST /api/cosign for sponsor-paid txns on Vaulta

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 4: Wait for Vercel deploy**

```bash
SHA=$(cd /Users/sachitdabas/explorer && git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

- [ ] **Step 5: Smoke-test endpoint with no auth (expect 401)**

```bash
curl -s -X POST https://talkblock.me/api/cosign \
  -H "Content-Type: application/json" \
  -d '{"chainId":"aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906","actions":[{"account":"core.vaulta","name":"transfer","authorization":[{"actor":"diagnostic111","permission":"active"}],"data":{"from":"diagnostic111","to":"diagnostic111","quantity":"0.0001 A","memo":"test"}}]}' \
  -i | head -3
```

Expected: `HTTP/2 401`. If you get 503, COSIGN env vars are missing in Vercel — re-check Pre-work step 5.

If pre-work hasn't been done yet (no `pay.talkblock` account, no env vars), this step will return 500 with "Cosigner not configured" — that's a signal to do the pre-work, not a code bug.

---

### Task B-3: Wire client tx flow with "Sponsor pays" toggle

**Files:**
- Modify: `components/chat/cards/tx-proposal-card.tsx`

Add a toggle that, when on, calls `/api/cosign` before passing the actions to the wallet. Receive the cosign signature, instruct the wallet to sign the same transaction, broadcast directly to the chain with both signatures.

This is the most architecturally subtle task because Anchor (via `@wharfkit/wallet-plugin-anchor`) doesn't trivially accept "co-sign this externally-built tx." Two approaches:

**(Approach A) Direct chain push, bypass wharfkit's `session.transact`:**
1. POST to `/api/cosign` → receive `{packed_trx, signatures, transaction}`.
2. Use the wallet plugin's lower-level `signTransaction` API (Anchor exposes `anchor.session.signTransaction(transaction)` via the session-kit).
3. Combine `[cosignSig, walletSig]` into `signatures: string[]`.
4. POST directly to `https://eos.greymass.com/v1/chain/push_transaction` with `{signatures, packed_trx}`.

**(Approach B) Build a custom wharfkit TransactPlugin that injects the cosign sig:**
Wharfkit supports `TransactPlugin` hooks that run during transaction processing. A plugin could intercept the post-build, pre-broadcast step and inject the cosign sig + slot in the noop action. Cleaner integration but more wharfkit-specific.

**Use Approach A** for v1. It's simpler and doesn't require deep wharfkit-plugin knowledge. Below is the implementation.

- [ ] **Step 1: Add a toggle state at the top of the card body**

In `components/chat/cards/tx-proposal-card.tsx`, after the existing `useState` hooks for `signing` / `txResult` / `txError`, add:

```typescript
const [sponsored, setSponsored] = useState(true) // default ON
```

- [ ] **Step 2: Add the toggle UI**

Find the "Sign" button area (where the user clicks to sign). Right above it, add:

```tsx
<label className="flex items-center gap-2 text-xs text-muted-foreground mb-2 cursor-pointer">
  <input
    type="checkbox"
    checked={sponsored}
    onChange={(e) => setSponsored(e.target.checked)}
    className="h-3 w-3 cursor-pointer"
  />
  Sponsor pays network fee (1 credit)
</label>
```

- [ ] **Step 3: Add a `handleSign` branch that uses cosigning**

Find the existing handler that runs when the user clicks Sign (it calls `transact(actions)` from `useWallet()`). Wrap or replace with:

```typescript
const handleSign = async () => {
  if (signing) return
  setSigning(true)
  setTxError(null)
  try {
    if (sponsored && session && chainInfo) {
      // Sponsor-paid path
      const token = localStorage.getItem("auth_token")
      const cosignRes = await fetch("/api/cosign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
        },
        body: JSON.stringify({
          chainId: chainInfo.chain_id,
          actions: editableActions.map((a) => ({
            account: a.account,
            name: a.name,
            authorization: [{ actor: session.actor, permission: session.permission }],
            data: a.data,
          })),
          expireSeconds: 300,
        }),
      })

      if (cosignRes.status === 402) {
        setTxError("Out of credits — sign without sponsor or buy more credits.")
        setSigning(false)
        return
      }
      if (!cosignRes.ok) {
        const body = await cosignRes.json().catch(() => ({}))
        throw new Error(body.error || \`Cosign failed (\${cosignRes.status})\`)
      }

      const { packed_trx, signatures: cosignSigs, transaction } = await cosignRes.json()

      // Ask the wallet to sign the same transaction. wharfkit's Session
      // exposes signTransaction via the session-kit; for Anchor specifically
      // we use the underlying session.signTransaction call.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionAny = session as any
      const walletSigResult = await sessionAny.signTransaction(transaction)
      const walletSig =
        typeof walletSigResult === "string"
          ? walletSigResult
          : walletSigResult.signatures?.[0] ?? walletSigResult[0]

      // Push directly to the chain
      const endpointUrl = endpoint || "https://eos.greymass.com"
      const pushRes = await fetch(\`\${endpointUrl}/v1/chain/push_transaction\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatures: [...cosignSigs, walletSig],
          packed_context_free_data: "",
          packed_trx,
        }),
      })
      const pushBody = await pushRes.json().catch(() => ({}))
      if (!pushRes.ok) {
        throw new Error(pushBody.error?.what || pushBody.error?.details?.[0]?.message || \`Push failed (\${pushRes.status})\`)
      }
      setTxResult(pushBody.transaction_id || "executed")
    } else {
      // Self-paid path (existing behavior)
      const result = await transact(editableActions)
      setTxResult(result?.response?.transaction_id || "executed")
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    setTxError(msg)
    onTxError?.(msg, editableActions)
  } finally {
    setSigning(false)
  }
}
```

This wires both paths. The sponsor path calls cosign → asks wallet to sign the same tx → broadcasts directly. The self-paid path keeps the existing `transact()` behavior.

The `(session as any).signTransaction(transaction)` cast accepts that wharfkit's typed surface for direct-tx-signing isn't fully exposed; the underlying Anchor session does have this method. Acceptable v1 hack — the implementer should look up the typed equivalent (`session.signTransaction` or `kit.signTransaction`) and replace the cast if a clean type exists.

- [ ] **Step 4: Wire `handleSign` to the existing Sign button**

Find the existing `<Button onClick={...}>Sign</Button>` (or equivalent) and change `onClick` to `handleSign`. Remove any existing competing handler.

- [ ] **Step 5: Build**

```bash
cd /Users/sachitdabas/explorer && npm run build
```

Expected: build succeeds (TypeScript may warn about the `any` cast — that's expected).

- [ ] **Step 6: Commit and push**

```bash
cd /Users/sachitdabas/explorer
git add components/chat/cards/tx-proposal-card.tsx
git commit -m "feat: Sponsor-pays toggle + dual-sig broadcast on tx-proposal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 7: Wait for deploy**

```bash
SHA=$(cd /Users/sachitdabas/explorer && git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

---

### Task B-4: End-to-end manual verification

**Files:** none (browser only).

This task assumes the Pre-work has been completed. If not, the cosign endpoint will return 500 with "Cosigner not configured" and you should do Pre-work first.

- [ ] **Step 1: Verify a sponsor-paid transfer**

On https://talkblock.me, sign in with a Vaulta wallet that has zero CPU stake (or minimal). In chat, ask: "transfer 0.0001 A to <some account>". The TxProposalCard appears with the "Sponsor pays" toggle ON. Click Sign.

Expected:
- `/api/cosign` returns 200.
- Wallet popup asks the user to sign.
- After signing, the tx broadcasts and shows transaction id.
- Looking up the tx on a Vaulta explorer: the first action is `noop.talkblock::noop` authorized by `pay.talkblock@cosign`; second action is the user's transfer authorized by `<user>@active`. CPU billed to `pay.talkblock`.
- The user's credit indicator drops by 1 (or `freeRemaining` drops by 1).

- [ ] **Step 2: Verify the toggle off path still works**

Same flow but uncheck "Sponsor pays" before clicking Sign. Wallet signs only the user's transfer (no noop), CPU billed to the user. Existing behavior preserved.

- [ ] **Step 3: Verify out-of-credits behavior**

Drain a test account's credits to 0 (server-side update or use an account with no balance + free quota exhausted). With sponsor toggle on, click Sign.

Expected: cosign returns 402, the inline error in the tx-proposal card reads "Out of credits — sign without sponsor or buy more credits." The user can uncheck and resign.

---

## Done criteria

- Chat messages cost 1 credit each (built-in mode); BYOK chat is free.
- Free quota is 6/day, shared between chat and cosign.
- Existing balances were divided by 1000 successfully (verified via spot-check in Task A-3 Step 2).
- "Sponsor pays" toggle on a tx-proposal card produces a cosigned txn whose CPU is billed to `pay.talkblock`, deducts 1 credit, and works end-to-end.
- All commits on `main`, all Vercel deploys green, manual verification passes.
