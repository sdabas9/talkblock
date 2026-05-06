# Cosigner + credits unification

## Goal

Two things shipped together because they share metering:

1. **Cosigner**: a `pay.talkblock` account that pays CPU/NET for transactions built by talkblock, so users don't burn their own resources on Vaulta.
2. **Credits unification**: replace today's token-count billing (input_tokens + output_tokens) with a flat credit model — one credit per built-in chat message, one credit per cosigned txn — and unify the same balance for both spends.

## Scope

**In:**
- New `POST /api/cosign` route on the existing Next.js app.
- New `pay.talkblock` Vaulta account with a constrained `cosign` permission linked to a stub `noop.talkblock` contract action.
- Schema/data shift: `daily_usage` and `credit_balances` continue to track quantity but the unit is now "credits" not "tokens." TLOS purchase rate retuned.
- 1 credit per built-in chat message (regardless of internal tool/reasoning steps).
- 1 credit per cosigned txn.
- BYOK chat: free (talkblock incurs no cost).
- Cosigning gated on credit balance OR remaining free quota; refuses with 402 otherwise.
- Free tier: 6 credits/day, shared across chat and cosign.

**Out:**
- Off-chain subscription billing (everything flows through the existing TLOS credit purchase dialog).
- Per-tx CPU pricing — flat 1 credit per cosign regardless of CPU cost.
- Multi-chain cosigning — Vaulta-only (chain_id `aca376f206b8fc25...`) for v1.
- Per-day rate limits — credits self-limit economically; if a user has credits, they can spend them as fast as they like.
- Re-pricing existing balances individually — straight conversion: tokens / 1000 = credits.

## Architecture

### One-time on-chain setup (manual, pre-deploy)

1. Create `pay.talkblock` and `noop.talkblock` Vaulta accounts. Stake A for CPU/NET on `pay.talkblock` (initial budget: 50 A; topup later from a treasury account).
2. Deploy a minimal `noop.talkblock` contract — single action `noop(string memo)` that does nothing.
3. On `pay.talkblock`, create a custom permission `cosign` (parent `active`) with one key — the cosign signing key.
4. `linkauth pay.talkblock cosign noop.talkblock noop` so the cosign key authorizes ONLY `noop.talkblock::noop` actions, nothing else. Even on key compromise, attacker can spam noops but cannot transfer A, change keys, or unstake.

### Server endpoint

New file: `app/api/cosign/route.ts`. Receives a tx-action list from the client, validates and meters, prepends a noop, signs, returns.

```
POST /api/cosign
Headers:
  Authorization: Bearer <Supabase JWT>   // same JWT issued by /api/auth/login
Body:
  {
    "chainId": "aca376f206b8fc25...",
    "actions": TxAction[],                // user's intended actions
    "expireSeconds": 300                  // optional, default 300 (5 min)
  }

Response (200):
  {
    "packed": "<hex>",                    // partially-signed transaction
    "signatures": ["SIG_K1_..."],         // pay.talkblock@cosign signature
    "creditsRemaining": 247,
    "freeRemaining": 6
  }

Error responses:
  401  Unauthorized            (no/invalid JWT)
  402  Insufficient credits    ("Out of credits — purchase more to continue")
  403  Forbidden chain         (only Vaulta supported)
  400  Invalid actions         (parse failure / disallowed shape)
  500  Cosign sign failed
```

### Server flow

1. Verify JWT, derive `userId` (existing `getUserId` helper from `app/api/bookmarks/[id]/route.ts`).
2. Look up `(chainId, walletAccount)` from the user's Supabase row. Reject if not on Vaulta.
3. Call `checkUsageAllowance(chainId, walletAccount)` (existing helper) to verify the user has remaining credits OR free quota. Return 402 if neither.
4. Validate the action list:
   - All actions must be on Vaulta-resident contracts.
   - No action may target `pay.talkblock` (prevents the user from making us cosign a tx that operates on our own sponsor account).
5. Prepend a noop action: `{ account: "noop.talkblock", name: "noop", authorization: [{ actor: "pay.talkblock", permission: "cosign" }], data: { memo: "<userId>:<timestamp>" } }`.
6. Construct the transaction (using `@wharfkit/session` server-side or raw Antelope ABI serialization). Set `expiration = now + expireSeconds` (default 300 — 5 minutes — which is well within Antelope's 1h `max_transaction_lifetime` and gives the user comfortable time to sign without making expired-cosign abuse cheap). Use TAPOS from a server-cached `get_info` (refresh every 30s).
7. Sign with `COSIGN_PRIVATE_KEY` (from Vercel env).
8. Record usage: `recordUsage(chainId, walletAccount, mode, /*credits*/ 1, /*kind*/ "cosign")` (extended signature; see below).
9. Return packed tx + signature.

### Client flow

In `components/chat/cards/tx-proposal-card.tsx`, add a "Sponsor pays" toggle. When enabled (default ON for built-in users; available to BYOK users too):

1. Before passing the action list to `wallet.transact()`, call `POST /api/cosign` with the actions.
2. Receive the partially-signed tx and merge into wharfkit's signing flow — wharfkit's `Session.transact` accepts pre-supplied signatures via the `transactPlugins` API. The user's wallet adds its signature; wharfkit broadcasts the dual-signed tx.
3. On 402, surface the existing `outOfCredits` banner (already wired in `chat-panel.tsx`).
4. On 5xx, show the chat-error banner (already wired) — but include "Try unsponsored" button that retries the original `wallet.transact()` without going through cosign.

### Data model changes

Existing tables (no schema change required, only semantic):
- `credit_balances(chain_id, account_name, balance_tokens)` → field is renamed conceptually to "balance_credits"; column kept for migration simplicity. New rows store credit counts.
- `daily_usage(chain_id, account_name, day, tokens_used)` → field is renamed conceptually to "credits_used".

Optional new column for analytics:
- `daily_usage.credits_chat`, `daily_usage.credits_cosign` — split breakdown by spend type. Defaults to 0; existing aggregate `tokens_used` continues to be the source of truth for free-quota gating.

`app_config` changes:
- Update `tokens_per_tlos` (or a new key `credits_per_tlos`) → `250`.
- Update `free_daily_tokens` (or new `free_daily_credits`) → `6`.

### Key extensions to existing helpers

In `lib/billing/credits.ts` (existing):

- `checkUsageAllowance(chainId, account)` — already returns `{ allowed, mode, reason }`. No signature change; semantics already align with credit-count gating, just with a different value of "1" recorded per spend instead of N tokens.
- `recordUsage(chainId, account, mode, inputTokens, outputTokens, modelUsed)` — refactor to `recordUsage(chainId, account, mode, credits, kind)` where `kind: "chat" | "cosign"`. Backward-compat for the chat path: chat path now passes `credits=1, kind="chat"` instead of input+output token counts.

### Migration

One-time SQL migration shipped with the deploy:

```sql
-- Convert existing token balances to credits at 1000 tokens = 1 credit
UPDATE credit_balances SET balance_tokens = GREATEST(1, balance_tokens / 1000);
UPDATE daily_usage SET tokens_used = GREATEST(0, tokens_used / 1000);

-- Update pricing config (idempotent upserts)
INSERT INTO app_config (key, value) VALUES ('credits_per_tlos', '250')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO app_config (key, value) VALUES ('free_daily_credits', '6')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

Run via the Supabase Management API SQL endpoint as a single statement at deploy time (same way we restored the project earlier in this session).

### UI surfaces

- **Cosigner toggle on TxProposalCard** — small "Sponsor pays" pill near Sign button, default ON. Tooltip: "Talkblock pays the network fee. Costs 1 credit."
- **Credits indicator in header** — already exists for built-in mode; extend to show under BYOK too if the user has any cosign-eligible activity. Label: "X credits" (was "X tokens").
- **Out-of-credits banner** — already wired; extend its trigger to also fire on cosign 402.
- **Purchase dialog** — existing TLOS purchase flow; update copy from "tokens" to "credits" and the conversion math (1 TLOS = 250 credits).

## Edge cases

- **Tx expires before user signs** — server sets 5-minute expiration; the vast majority of users sign within seconds. If a user genuinely walks away for 5+ minutes, the cosign signature becomes useless and the broadcast fails with "expired transaction." Credit was already deducted at cosign-issue time and is NOT refunded — accepted v1 cost. We deduct upfront (rather than on broadcast success) to prevent the obvious abuse: a malicious user requesting unlimited cosignatures and never broadcasting any of them.
- **User has BYOK but no credits** — cosign refuses with 402, user falls back to self-paid via the "Try unsponsored" button.
- **`pay.talkblock` runs out of CPU** — cosign would still sign successfully but the broadcast fails with billable_cpu_time_us exceeded. Endpoint should pre-check `pay.talkblock`'s available CPU via cached `get_account` and refuse with 503 if insufficient. Add stake-low alerting via the existing keepalive workflow.
- **Replay of cosigned tx** — Antelope tx signatures embed `expiration` and `ref_block_num`; expired or replayed txns are rejected by nodes. Each cosign signature is single-use.
- **User edits actions client-side after cosign** — server signs the exact action list it validated. If client edits and resigns, the cosign signature won't match (different tx hash), node rejects.
- **JWT expired during a long-running chat session** — return 401 from cosign; client clears auth and prompts re-login.

## Out-of-scope follow-ups (worth listing for clarity)

- Per-tier subscriptions (e.g. "Pro: unlimited cosigns/day for X TLOS/month").
- Cosigning on Telos / WAX (same code path; just adds chain-id whitelisting and per-chain sponsor accounts).
- Refunds for expired/failed cosigned txns.
- Anomaly detection: same JWT firing 1000 cosigns in 10 minutes → flag for manual review.
- Sponsor account top-up automation (today: a human funds it from treasury when stake gets low).

## Why this design vs. alternatives

- **Why not Greymass Fuel?** — operationally simpler (zero infra), but per-tx fee + opaque quota means we can't unify metering with our own credits, and we lose UX control. We may add Fuel later as a fallback when our cosigner is depleted.
- **Why not powerup-the-user?** — visible on the user's account history (powerup transactions show as the user's own action), confuses the chain-of-custody story, and costs more A per equivalent CPU.
- **Why dedicated `cosign` permission with linkauth?** — narrows blast radius on key compromise. The cosign key signs only `noop.talkblock::noop`. Without linkauth, the same key could move A, change keys, etc.
- **Why noop instead of just adding `pay.talkblock@active` as first authorizer to user's actions?** — the cosign key wouldn't have access to other contracts' authorizations; we'd need full `active` access on `pay.talkblock`, ballooning blast radius. Noop is the cleanest "first authorizer pays" pattern in Antelope.
