# Backend (Supabase + Wallet Auth) Design

## Goal

Introduce a Supabase backend with wallet-based authentication so users get persistent bookmarks, chat history, and settings tied to their blockchain account.

## Architecture

Supabase handles auth and database. Next.js uses `@supabase/ssr` for server-side auth (middleware protects API routes, server components get the session). Client-side uses `@supabase/supabase-js` for queries. User identity is per-chain: `account_name + chain_id`.

## Auth Flow

Challenge-response wallet authentication:

1. User picks a chain and clicks "Connect Wallet" (Wharfkit/Anchor)
2. Frontend calls `POST /api/auth/challenge` with `{ account, chainId }`
3. Backend generates a random nonce, stores temporarily, returns it
4. Frontend asks wallet to sign the nonce
5. Frontend sends `POST /api/auth/verify` with `{ account, chainId, nonce, signature }`
6. Backend verifies signature against account's public key (fetched via `get_account`)
7. If valid: upsert user in `profiles`, mint custom Supabase JWT, return it
8. Frontend calls `supabase.auth.setSession()` with JWT

Chain change = logout. User reconnects wallet on new chain = new auth challenge = different profile.

## Database Schema

```sql
-- profiles: created on first successful wallet auth
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  chain_id text NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_name, chain_id)
);

-- user_settings: one row per user
CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  llm_provider text,
  llm_model text,
  llm_api_key text,
  preferred_chains jsonb DEFAULT '[]',
  ui_preferences jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- bookmarks: saved card snapshots
CREATE TABLE bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  label text NOT NULL,
  result jsonb NOT NULL,
  chain_name text,
  chain_endpoint text,
  created_at timestamptz DEFAULT now()
);

-- conversations: chat sessions
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text,
  chain_name text,
  chain_endpoint text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- messages: individual chat messages
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  parts jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

## RLS Policies

```sql
-- All user-owned tables
CREATE POLICY "users own their data"
  ON profiles FOR ALL USING (id = auth.uid());

CREATE POLICY "users own their settings"
  ON user_settings FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users own their bookmarks"
  ON bookmarks FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users own their conversations"
  ON conversations FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users own their messages"
  ON messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  ));
```

## API Routes

```
POST /api/auth/challenge         — generate nonce for wallet signing
POST /api/auth/verify            — verify signature, return JWT
POST /api/auth/logout            — clear session

GET  /api/settings               — get user's LLM config + preferences
PUT  /api/settings               — update LLM config + preferences

GET  /api/bookmarks              — list user's bookmarks
POST /api/bookmarks              — save a bookmark
DELETE /api/bookmarks/[id]       — remove a bookmark

GET  /api/conversations          — list user's conversations
POST /api/conversations          — create new conversation
GET  /api/conversations/[id]     — get conversation with messages
DELETE /api/conversations/[id]   — delete conversation

POST /api/chat                   — (existing) reads LLM key from DB, saves messages
```

## Store Changes

| Store | Current | After |
|-------|---------|-------|
| `wallet-store` | Wharfkit only | Wharfkit + triggers auth challenge/verify |
| `llm-store` | localStorage API key | Reads/writes via `/api/settings`, no key on client |
| `history-store` | localStorage bookmarks | Reads/writes via `/api/bookmarks` |
| `panel-store` | Local state | No change |
| `context-store` | Local state | No change |
| `chain-store` | localStorage | No change (pre-auth) |
| **NEW** `auth-store` | — | Supabase session, user profile, auth state |
| **NEW** `conversation-store` | — | Conversation list, active conversation, message persistence |

## Middleware & Security

- Next.js middleware checks Supabase JWT on every request
- Public routes (no auth): `/login`, `/api/auth/challenge`, `/api/auth/verify`
- Protected routes: everything else
- LLM API keys never leave server after initial save
- Settings page sends key once via `PUT /api/settings` over HTTPS
- `/api/chat` reads key from `user_settings` using authenticated user ID

## File Structure

```
lib/supabase/
  client.ts              — browser Supabase client
  server.ts              — server-side Supabase client
  middleware.ts           — auth helper for middleware
  types.ts               — generated DB types

lib/stores/
  auth-store.tsx          — NEW: auth state, login/logout
  conversation-store.tsx  — NEW: conversation list, active chat

app/login/page.tsx        — login page (chain selector + connect wallet)

app/api/auth/
  challenge/route.ts
  verify/route.ts
  logout/route.ts

app/api/settings/route.ts
app/api/bookmarks/route.ts
app/api/bookmarks/[id]/route.ts
app/api/conversations/route.ts
app/api/conversations/[id]/route.ts

middleware.ts             — Next.js auth guard

supabase/migrations/
  001_initial_schema.sql
```

## Dependencies

```
@supabase/supabase-js    — client SDK
@supabase/ssr            — server-side auth for Next.js
jsonwebtoken             — mint custom JWTs for wallet auth
eosjs                    — verify Antelope signatures server-side
```

## Login Page Flow

1. User lands on `/login` → chain selector + "Connect Wallet" button
2. Picks chain → connects wallet → signs challenge → authenticated → redirected to app
3. Subsequent visits: JWT in cookie auto-restores session
