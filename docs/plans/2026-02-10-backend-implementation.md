# Backend (Supabase + Wallet Auth) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase backend with wallet-based auth, persistent bookmarks, chat history, and server-side LLM key storage.

**Architecture:** Supabase Postgres + custom JWT auth. User identity = `account_name + chain_id`. Wallet connection via Wharfkit triggers auth flow. JWTs signed with Supabase JWT secret enable RLS policies. Existing localStorage stores migrate to Supabase-backed API calls.

**Tech Stack:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `jsonwebtoken` for custom JWTs, Next.js API routes, existing Wharfkit wallet integration.

**Dev server:** `export PATH="/usr/local/opt/node@22/bin:$PATH" && npm run dev`

**Important conventions:**
- AI SDK v6: uses `inputSchema` (not `parameters`), `isToolUIPart()`, `getToolName()`, `part.output`, `state: "output-available"`
- Zod v4: `z.record(z.string(), z.any())` not `z.record(z.any())`
- Wharfkit: dynamic imports only (browser-only, SSR breaks)
- All stores use React Context pattern
- Path alias: `@/*` maps to project root

---

### Task 1: Install Dependencies & Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `.env.local.example`
- Modify: `package.json`

**Step 1: Install dependencies**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH"
cd /Users/sachitdabas/explorer
npm install @supabase/supabase-js @supabase/ssr jsonwebtoken
npm install -D @types/jsonwebtoken
```

**Step 2: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

The user must create `.env.local` with their actual Supabase project values. The `NEXT_PUBLIC_` vars are safe for client-side. The `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` are server-only.

**Step 3: Create browser Supabase client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create server Supabase client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient as createJSClient } from "@supabase/supabase-js"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

// Admin client for user management (server-only, bypasses RLS)
export function createAdminClient() {
  return createJSClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Step 5: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | head -30
```

Should compile without errors (env vars will be undefined but types should be fine).

**Step 6: Commit**

```bash
git add lib/supabase/ .env.local.example package.json package-lock.json
git commit -m "feat: add Supabase client setup and dependencies"
```

---

### Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Profiles: one per account+chain combination
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL,
  chain_id text NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_name, chain_id)
);

-- User settings: LLM config, preferences
CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  llm_provider text,
  llm_model text,
  llm_api_key text,
  preferred_chains jsonb DEFAULT '[]',
  ui_preferences jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Bookmarks: saved card snapshots
CREATE TABLE bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tool_name text NOT NULL,
  label text NOT NULL,
  result jsonb NOT NULL,
  chain_name text,
  chain_endpoint text,
  created_at timestamptz DEFAULT now()
);

-- Conversations: chat sessions
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text,
  chain_name text,
  chain_endpoint text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Messages: individual chat messages
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: auth.uid() reads from the 'sub' claim of our custom JWT

CREATE POLICY "users read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users manage own settings"
  ON user_settings FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "users manage own bookmarks"
  ON bookmarks FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "users manage own conversations"
  ON conversations FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "users manage own messages"
  ON messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Service role can insert profiles (for auth flow)
CREATE POLICY "service can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);
```

**Step 2: Commit**

The user will run this migration via the Supabase dashboard (SQL Editor) or CLI (`supabase db push`). We don't run it from here.

```bash
git add supabase/
git commit -m "feat: add database migration with tables and RLS policies"
```

---

### Task 3: Auth API Routes + Auth Store

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `lib/stores/auth-store.tsx`
- Modify: `lib/stores/wallet-store.tsx`

**Context:** When the user connects their wallet, we authenticate them with Supabase. The flow:
1. Wallet connects via Wharfkit → we have account_name + chain_id
2. Frontend calls `POST /api/auth/login` with `{ accountName, chainId }`
3. Backend upserts profile, signs a custom JWT with `sub = profile.id`
4. Frontend receives JWT, sets it on Supabase client via `supabase.auth.setSession()`
5. All subsequent Supabase queries use RLS with the user's ID

**Step 1: Create login API route**

Create `app/api/auth/login/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

export async function POST(req: Request) {
  const { accountName, chainId } = await req.json()

  if (!accountName || !chainId) {
    return Response.json({ error: "Missing accountName or chainId" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Upsert profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(
      { account_name: accountName, chain_id: chainId, display_name: accountName },
      { onConflict: "account_name,chain_id" }
    )
    .select("id")
    .single()

  if (error || !profile) {
    return Response.json({ error: "Failed to create profile" }, { status: 500 })
  }

  // Sign custom JWT for Supabase RLS
  const token = jwt.sign(
    {
      sub: profile.id,
      role: "authenticated",
      aud: "authenticated",
      iss: process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    process.env.SUPABASE_JWT_SECRET!
  )

  // Also ensure user_settings row exists
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: profile.id },
      { onConflict: "user_id" }
    )

  return Response.json({
    token,
    user: {
      id: profile.id,
      accountName,
      chainId,
    },
  })
}
```

**Step 2: Create logout API route**

Create `app/api/auth/logout/route.ts`:

```typescript
export async function POST() {
  return Response.json({ success: true })
}
```

**Step 3: Create auth store**

Create `lib/stores/auth-store.tsx`:

```typescript
"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface AuthUser {
  id: string
  accountName: string
  chainId: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (accountName: string, chainId: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem("auth_user")
    const token = localStorage.getItem("auth_token")
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored)
        setUser(parsed)
        // Set token on Supabase client
        const supabase = createClient()
        supabase.auth.setSession({ access_token: token, refresh_token: "" })
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (accountName: string, chainId: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountName, chainId }),
    })

    if (!res.ok) {
      throw new Error("Authentication failed")
    }

    const { token, user: userData } = await res.json()

    // Set on Supabase client
    const supabase = createClient()
    await supabase.auth.setSession({ access_token: token, refresh_token: "" })

    // Persist
    localStorage.setItem("auth_token", token)
    localStorage.setItem("auth_user", JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    setUser(null)
    const supabase = createClient()
    supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

**Step 4: Update wallet-store to trigger auth on login/logout**

Modify `lib/stores/wallet-store.tsx`:

The wallet store needs to:
1. After successful Wharfkit login → call `auth.login(accountName, chainId)`
2. On wallet logout → call `auth.logout()`
3. On chain change (session cleared) → call `auth.logout()`

Add `useAuth` import and integrate into the existing login/logout callbacks:

```typescript
// At the top, add import:
import { useAuth } from "@/lib/stores/auth-store"

// Inside WalletProvider, add:
const auth = useAuth()

// In the chain-change useEffect, after setSession(null) and setAccountName(null):
auth.logout()

// In the login callback, after setAccountName(String(s.actor)):
if (chainInfo?.chain_id) {
  auth.login(String(s.actor), chainInfo.chain_id).catch(console.error)
}

// In the logout callback, after setAccountName(null):
auth.logout()
```

**Important:** The `WalletProvider` must be nested INSIDE `AuthProvider` in the provider tree (Task 8 handles this).

**Step 5: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add app/api/auth/ lib/stores/auth-store.tsx lib/stores/wallet-store.tsx
git commit -m "feat: add wallet-based auth with Supabase JWT"
```

---

### Task 4: Login Page

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/layout.tsx`

**Context:** The login page shows chain selector + wallet connect button. It does NOT use the AppShell (no header, no panels). It's a standalone page. After successful wallet connect + auth, redirect to `/`.

**Step 1: Create login layout (no AppShell wrapper)**

Create `app/login/layout.tsx`:

```typescript
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

Wait — the `AppShell` is in the root layout, so the login page would inherit it. We need to restructure: move `AppShell` out of the root layout and into a route group.

**Revised approach:** Use Next.js route groups:
- `app/(app)/page.tsx` — main app (wrapped in AppShell)
- `app/login/page.tsx` — login page (no AppShell)
- `app/layout.tsx` — root layout (just html/body, no AppShell)

**Step 1a: Move main page into route group**

- Move `app/page.tsx` → `app/(app)/page.tsx`
- Create `app/(app)/layout.tsx` — wraps children with AppShell

**Step 1b: Update root layout**

Modify `app/layout.tsx` to remove `AppShell` wrapper. Just keep html/body/fonts. Wrap with only `AuthProvider` (needed everywhere).

Root layout becomes:
```typescript
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/stores/auth-store"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Antelope Explorer",
  description: "Chat-first Antelope blockchain explorer",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

**Step 1c: Create app route group layout**

Create `app/(app)/layout.tsx`:
```typescript
import { AppShell } from "@/components/layout/app-shell"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
```

**Step 2: Create login page**

Create `app/login/page.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/stores/auth-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wallet, Loader2, Globe } from "lucide-react"

const PRESET_CHAINS = [
  { name: "EOS Mainnet", url: "https://eos.greymass.com" },
  { name: "Jungle4 Testnet", url: "https://jungle4.greymass.com" },
  { name: "WAX Mainnet", url: "https://wax.greymass.com" },
  { name: "Telos Mainnet", url: "https://telos.greymass.com" },
  { name: "FIO Mainnet", url: "https://fio.greymass.com" },
  { name: "Libre", url: "https://libre.greymass.com" },
]

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [selectedChain, setSelectedChain] = useState<string>("")
  const [customEndpoint, setCustomEndpoint] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endpoint = selectedChain === "custom" ? customEndpoint : selectedChain
  const chainName = PRESET_CHAINS.find(c => c.url === selectedChain)?.name || customEndpoint

  const handleConnect = async () => {
    if (!endpoint) return
    setConnecting(true)
    setError(null)

    try {
      // 1. Get chain info to find chain_id
      const infoRes = await fetch(`${endpoint}/v1/chain/get_info`, { method: "POST" })
      const chainInfo = await infoRes.json()

      // 2. Initialize Wharfkit and login
      const { SessionKit } = await import("@wharfkit/session")
      const { WebRenderer } = await import("@wharfkit/web-renderer")
      const { WalletPluginAnchor } = await import("@wharfkit/wallet-plugin-anchor")

      const kit = new SessionKit({
        appName: "Antelope Explorer",
        chains: [{ id: chainInfo.chain_id, url: endpoint }],
        ui: new WebRenderer(),
        walletPlugins: [new WalletPluginAnchor()],
      })

      const result = await kit.login()
      const accountName = String(result.session.actor)

      // 3. Authenticate with our backend
      await login(accountName, chainInfo.chain_id)

      // 4. Store chain info for the app to pick up
      localStorage.setItem("antelope_endpoint", endpoint)
      localStorage.setItem("antelope_chain_name", chainName)

      // 5. Redirect to app
      router.push("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Globe className="h-6 w-6" />
            Antelope Explorer
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your wallet to get started
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select Chain</Label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a chain..." />
              </SelectTrigger>
              <SelectContent>
                {PRESET_CHAINS.map((chain) => (
                  <SelectItem key={chain.url} value={chain.url}>
                    {chain.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom RPC Endpoint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedChain === "custom" && (
            <div>
              <Label>RPC Endpoint</Label>
              <Input
                className="mt-1"
                placeholder="https://your-node.com"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleConnect}
            disabled={!endpoint || connecting}
          >
            {connecting ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Wallet className="h-5 w-5 mr-2" />
            )}
            {connecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add app/login/ "app/(app)/" app/layout.tsx
git commit -m "feat: add login page with chain selector and wallet connect"
```

---

### Task 5: Next.js Middleware

**Files:**
- Create: `middleware.ts` (project root)

**Context:** Protect all routes except `/login` and auth API routes. Redirect unauthenticated users to `/login`.

**Step 1: Create middleware**

Create `middleware.ts` (project root):

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Check for auth token
  const token = request.cookies.get("auth_token")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "")

  // Also check localStorage via a custom header (set by auth-store)
  // Since middleware can't read localStorage, we rely on the cookie
  if (!token) {
    // Check if token exists in the request (passed as cookie by auth-store)
    const authUser = request.cookies.get("auth_user")?.value
    if (!authUser) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

**Important:** Since we store the JWT in localStorage (not httpOnly cookies), we need the auth-store to also set a cookie so the middleware can read it. Update auth-store's login/logout to set/remove a cookie:

In `auth-store.tsx` login callback, after `localStorage.setItem("auth_token", token)`:
```typescript
document.cookie = `auth_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
document.cookie = `auth_user=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
```

In `auth-store.tsx` logout callback:
```typescript
document.cookie = "auth_token=; path=/; max-age=0"
document.cookie = "auth_user=; path=/; max-age=0"
```

**Step 2: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 3: Commit**

```bash
git add middleware.ts lib/stores/auth-store.tsx
git commit -m "feat: add auth middleware to protect routes"
```

---

### Task 6: Settings API + LLM Store Migration

**Files:**
- Create: `app/api/settings/route.ts`
- Modify: `lib/stores/llm-store.tsx`
- Modify: `components/settings/llm-settings.tsx`
- Modify: `app/api/chat/route.ts`

**Context:** LLM API keys move from localStorage to Supabase `user_settings` table. The settings page writes to the API, the chat route reads the key from DB server-side. The client-side LLM store no longer holds the API key — only provider and model.

**Step 1: Create settings API route**

Create `app/api/settings/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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

export async function GET(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("user_settings")
    .select("llm_provider, llm_model, ui_preferences, preferred_chains")
    .eq("user_id", userId)
    .single()

  if (error) return Response.json({ error: "Settings not found" }, { status: 404 })

  // Never return API key to client
  return Response.json(data)
}

export async function PUT(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.llm_provider !== undefined) updateData.llm_provider = body.llm_provider
  if (body.llm_model !== undefined) updateData.llm_model = body.llm_model
  if (body.llm_api_key !== undefined) updateData.llm_api_key = body.llm_api_key
  if (body.ui_preferences !== undefined) updateData.ui_preferences = body.ui_preferences

  const { error } = await supabase
    .from("user_settings")
    .update(updateData)
    .eq("user_id", userId)

  if (error) return Response.json({ error: "Failed to update settings" }, { status: 500 })

  return Response.json({ success: true })
}
```

**Step 2: Update LLM store**

Modify `lib/stores/llm-store.tsx`:

Replace localStorage persistence with API calls. The store no longer holds the API key on the client. It tracks: provider, model, and a boolean `hasApiKey` (set after saving).

```typescript
"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

export type LLMProviderType = "anthropic" | "openai" | "google"

interface LLMConfig {
  provider: LLMProviderType
  model: string
}

const DEFAULT_MODELS: Record<LLMProviderType, string[]> = {
  anthropic: ["claude-sonnet-4-5-20250929", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  google: ["gemini-2.0-flash", "gemini-2.0-pro"],
}

interface LLMState {
  config: LLMConfig | null
  hasApiKey: boolean
  availableModels: string[]
  isConfigured: boolean
  setProvider: (provider: LLMProviderType) => void
  setApiKey: (key: string) => Promise<void>
  setModel: (model: string) => void
  getModelsForProvider: (provider: LLMProviderType) => string[]
}

const LLMContext = createContext<LLMState | null>(null)

export function LLMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)

  // Load settings from server on auth
  useEffect(() => {
    if (!user) {
      setConfig(null)
      setHasApiKey(false)
      return
    }
    const token = localStorage.getItem("auth_token")
    if (!token) return

    fetch("/api/settings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.llm_provider && data.llm_model) {
          setConfig({ provider: data.llm_provider, model: data.llm_model })
        }
        // Server tells us if key exists (we check via a flag from settings API)
        // For now, we assume key exists if provider is set
        setHasApiKey(!!data.llm_provider)
      })
      .catch(console.error)
  }, [user])

  const saveToServer = useCallback(async (updates: Record<string, unknown>) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    })
  }, [])

  const setProvider = useCallback((provider: LLMProviderType) => {
    const models = DEFAULT_MODELS[provider]
    const newConfig = { provider, model: models[0] }
    setConfig(newConfig)
    saveToServer({ llm_provider: provider, llm_model: models[0] })
  }, [saveToServer])

  const setApiKey = useCallback(async (apiKey: string) => {
    await saveToServer({ llm_api_key: apiKey })
    setHasApiKey(!!apiKey)
  }, [saveToServer])

  const setModel = useCallback((model: string) => {
    if (!config) return
    const newConfig = { ...config, model }
    setConfig(newConfig)
    saveToServer({ llm_model: model })
  }, [config, saveToServer])

  const getModelsForProvider = useCallback((provider: LLMProviderType) => {
    return DEFAULT_MODELS[provider]
  }, [])

  return (
    <LLMContext.Provider
      value={{
        config,
        hasApiKey,
        availableModels: config ? DEFAULT_MODELS[config.provider] : [],
        isConfigured: !!(config?.provider && config?.model && hasApiKey),
        setProvider,
        setApiKey,
        setModel,
        getModelsForProvider,
      }}
    >
      {children}
    </LLMContext.Provider>
  )
}

export function useLLM() {
  const ctx = useContext(LLMContext)
  if (!ctx) throw new Error("useLLM must be used within LLMProvider")
  return ctx
}
```

**Step 3: Update LLM settings component**

Modify `components/settings/llm-settings.tsx`:

- The API key input now calls `setApiKey()` (async, saves to server)
- Update the helper text: "Stored securely on server. Never exposed to the browser after saving."
- The key input should be a "save" flow — type key, click Save, then the field clears showing "••••••••"

The key changes:
- Add a local state `apiKeyInput` for the input field
- Add a "Save Key" button
- After saving, show "Key saved" instead of the actual key value
- Remove the eye/show toggle (key is no longer readable after save)

```typescript
"use client"

import { useLLM, LLMProviderType } from "@/lib/stores/llm-store"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Settings, Save, Loader2, Check } from "lucide-react"
import { useState } from "react"

const PROVIDERS: { value: LLMProviderType; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
]

export function LLMSettings() {
  const { config, hasApiKey, isConfigured, setProvider, setApiKey, setModel, getModelsForProvider } = useLLM()
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return
    setSaving(true)
    try {
      await setApiKey(apiKeyInput.trim())
      setApiKeyInput("")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="h-4 w-4" />
          {isConfigured && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LLM Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Provider</Label>
            <Select
              value={config?.provider || ""}
              onValueChange={(v) => setProvider(v as LLMProviderType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {config?.provider && (
            <>
              <div>
                <Label>API Key</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="password"
                    placeholder={hasApiKey ? "••••••••  (key saved)" : "Enter your API key"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSaveKey}
                    disabled={!apiKeyInput.trim() || saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Stored securely on server. Never exposed to the browser after saving.
                </p>
              </div>
              <div>
                <Label>Model</Label>
                <Select value={config.model} onValueChange={setModel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getModelsForProvider(config.provider).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {isConfigured ? (
              <Badge variant="default" className="bg-green-600">Configured</Badge>
            ) : (
              <Badge variant="secondary">Not configured</Badge>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 4: Update chat API route to read key from DB**

Modify `app/api/chat/route.ts`:

Instead of reading `llmConfig.apiKey` from the request body, read it from the `user_settings` table using the auth token. The client no longer sends the API key.

```typescript
import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { createLLMModel } from "@/lib/llm/provider"
import { createChainTools } from "@/lib/llm/tools"
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return new Response("Unauthorized", { status: 401 })
  }

  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string }
    userId = decoded.sub
  } catch {
    return new Response("Invalid token", { status: 401 })
  }

  // Get user's LLM settings from DB
  const supabase = createAdminClient()
  const { data: settings } = await supabase
    .from("user_settings")
    .select("llm_provider, llm_model, llm_api_key")
    .eq("user_id", userId)
    .single()

  if (!settings?.llm_provider || !settings?.llm_api_key || !settings?.llm_model) {
    return new Response("LLM not configured", { status: 400 })
  }

  const body = await req.json()
  const { messages, chainEndpoint: chainEp, walletAccount } = body
  const chainEndpoint = chainEp || ""

  const llmModel = createLLMModel(settings.llm_provider, settings.llm_api_key, settings.llm_model)
  const tools = createChainTools(chainEndpoint || null)

  const systemPrompt = `You are an Antelope blockchain explorer assistant. You help users understand and interact with Antelope-based blockchains (EOS, WAX, Telos, etc.).

You have access to tools that let you query on-chain data in real-time. Use them to answer questions about accounts, transactions, blocks, smart contracts, and token balances.

When a user wants to perform an action on the blockchain (transfer tokens, stake resources, buy RAM, vote for producers, etc.), use the build_transaction tool to create a transaction proposal. The user will review and sign it with their wallet.

Guidelines:
- Always use tools to fetch real data rather than making assumptions
- Present data clearly and explain what it means
- When building transactions, ONLY call the build_transaction tool. Do NOT add any text before or after the tool call — no explanations, no summaries, no "here's your transaction" text. The tool result renders as an editable form card, which is all the user needs to see. Any extra text clutters the UI.
- When the user reports a transaction error (e.g. "[Transaction Error: ...]"), analyze the error message and automatically attempt to build a corrected transaction. Common fixes include: adjusting token precision/symbol, fixing account names, checking permissions, or adjusting resource amounts.
- If the chain endpoint is not connected, let the user know they need to connect first
- Be concise but informative
- When you receive a [System: ...] message about a chain or wallet change, introduce yourself briefly (1-2 sentences), mention what chain/account they're on, and suggest a few things you can help with. Don't repeat the system message — just respond naturally as a greeting.

${chainEndpoint ? "Connected chain endpoint: " + chainEndpoint : "No chain connected — inform the user they should connect to a chain to query on-chain data."}

${walletAccount ? `The user's connected wallet account is: ${walletAccount}. When they say "my account", "my balance", etc., use this account name. When building transactions, use this as the "from" account.` : "No wallet connected."}`

  const result = streamText({
    model: llmModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
```

**Step 5: Update chat-panel.tsx custom fetch**

The chat panel's custom fetch wrapper no longer needs to send `llmConfig` (no API key on client). Instead, it sends the auth token in the Authorization header:

In `components/chat/chat-panel.tsx`, update `customFetch`:

```typescript
const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(init?.body as string || "{}")
  body.chainEndpoint = endpointRef.current || ""
  body.walletAccount = accountRef.current || ""
  const token = localStorage.getItem("auth_token") || ""
  return fetch(input, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers).entries()),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}, [])
```

Also remove the `useLLM` import/usage for `config` since we no longer need it in the fetch. Keep `isConfigured` for the UI check.

**Step 6: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 7: Commit**

```bash
git add app/api/settings/ app/api/chat/route.ts lib/stores/llm-store.tsx components/settings/llm-settings.tsx components/chat/chat-panel.tsx
git commit -m "feat: move LLM settings to server-side, remove API key from client"
```

---

### Task 7: Bookmarks API + Store Migration + Card Bookmark Button

**Files:**
- Create: `app/api/bookmarks/route.ts`
- Create: `app/api/bookmarks/[id]/route.ts`
- Modify: `lib/stores/history-store.tsx`
- Modify: `components/chat/cards/tool-result-renderer.tsx`
- Modify: `components/layout/left-panel.tsx`

**Context:** Bookmarks move from localStorage string arrays to Supabase. Each bookmark stores the full tool result data so the card can be re-rendered. A bookmark button appears on each card in the chat.

**Step 1: Create bookmarks API route**

Create `app/api/bookmarks/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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

export async function GET(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) return Response.json({ error: "Failed to fetch bookmarks" }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: userId,
      tool_name: body.toolName,
      label: body.label,
      result: body.result,
      chain_name: body.chainName || null,
      chain_endpoint: body.chainEndpoint || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: "Failed to create bookmark" }, { status: 500 })
  return Response.json(data)
}
```

**Step 2: Create bookmark delete route**

Create `app/api/bookmarks/[id]/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) return Response.json({ error: "Failed to delete bookmark" }, { status: 500 })
  return Response.json({ success: true })
}
```

**Step 3: Update history store**

Rewrite `lib/stores/history-store.tsx` to use Supabase for bookmarks:

```typescript
"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

interface Bookmark {
  id: string
  tool_name: string
  label: string
  result: Record<string, any>
  chain_name: string | null
  chain_endpoint: string | null
  created_at: string
}

interface HistoryState {
  bookmarks: Bookmark[]
  addBookmark: (bookmark: { toolName: string; label: string; result: Record<string, any>; chainName?: string; chainEndpoint?: string }) => Promise<void>
  removeBookmark: (id: string) => Promise<void>
  isBookmarked: (toolName: string, label: string) => boolean
}

const HistoryContext = createContext<HistoryState | null>(null)

export function HistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  // Load bookmarks on auth
  useEffect(() => {
    if (!user) {
      setBookmarks([])
      return
    }
    const token = localStorage.getItem("auth_token")
    if (!token) return

    fetch("/api/bookmarks", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBookmarks(data)
      })
      .catch(console.error)
  }, [user])

  const addBookmark = useCallback(async (bookmark: { toolName: string; label: string; result: Record<string, any>; chainName?: string; chainEndpoint?: string }) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return

    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(bookmark),
    })
    const data = await res.json()
    if (data.id) {
      setBookmarks((prev) => [data, ...prev])
    }
  }, [])

  const removeBookmark = useCallback(async (id: string) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return

    await fetch(`/api/bookmarks/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  const isBookmarked = useCallback((toolName: string, label: string) => {
    return bookmarks.some((b) => b.tool_name === toolName && b.label === label)
  }, [bookmarks])

  return (
    <HistoryContext.Provider value={{ bookmarks, addBookmark, removeBookmark, isBookmarked }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider")
  return ctx
}
```

**Step 4: Add bookmark button to tool-result-renderer**

Modify `components/chat/cards/tool-result-renderer.tsx`:

Add a bookmark toggle button that wraps each card result. The button uses `useHistory` to add/remove bookmarks.

```typescript
"use client"

import { AccountCard } from "./account-card"
import { BlockCard } from "./block-card"
import { TransactionCard } from "./transaction-card"
import { TableCard } from "./table-card"
import { TxProposalCard } from "./tx-proposal-card"
import { useHistory } from "@/lib/stores/history-store"
import { useChain } from "@/lib/stores/chain-store"
import { Button } from "@/components/ui/button"
import { Bookmark } from "lucide-react"

interface ToolResultRendererProps {
  toolName: string
  result: Record<string, any>
  onTxError?: (error: string, actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => void
}

function getLabel(toolName: string, result: Record<string, any>): string {
  switch (toolName) {
    case "get_account": return result.account_name || "Account"
    case "get_block": return `Block #${result.block_num || "??"}`
    case "get_transaction": return `Tx ${(result.id || "??").slice(0, 8)}...`
    case "get_table_rows": return "Table rows"
    case "get_currency_balance": return `${result.account || "??"} balances`
    case "get_producers": return "Producers"
    case "get_abi": return `ABI: ${result.account_name || "??"}`
    default: return toolName
  }
}

// Tools that can be bookmarked (not transactions)
const BOOKMARKABLE = ["get_account", "get_block", "get_transaction", "get_table_rows", "get_currency_balance", "get_producers", "get_abi"]

export function ToolResultRenderer({ toolName, result, onTxError }: ToolResultRendererProps) {
  const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useHistory()
  const { chainName, endpoint } = useChain()

  if (result?.error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 my-1">
        Error: {String(result.error)}
      </div>
    )
  }

  const label = getLabel(toolName, result)
  const bookmarked = isBookmarked(toolName, label)
  const existingBookmark = bookmarks.find((b) => b.tool_name === toolName && b.label === label)

  const toggleBookmark = async () => {
    if (bookmarked && existingBookmark) {
      await removeBookmark(existingBookmark.id)
    } else {
      await addBookmark({
        toolName,
        label,
        result,
        chainName: chainName || undefined,
        chainEndpoint: endpoint || undefined,
      })
    }
  }

  const renderCard = () => {
    switch (toolName) {
      case "get_account":
        return <AccountCard data={result as any} />
      case "get_block":
        return <BlockCard data={result as any} />
      case "get_transaction":
        return <TransactionCard data={result as any} />
      case "get_table_rows":
        return <TableCard data={result as any} />
      case "get_currency_balance":
        return (
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1">
            <span className="text-muted-foreground">Balances for </span>
            <span className="font-medium">{String(result.account)}</span>
            <span className="text-muted-foreground">: </span>
            <span className="font-medium">{(result.balances || []).join(", ") || "None"}</span>
          </div>
        )
      case "get_producers":
        return <TableCard data={{ rows: result.producers || [] }} />
      case "get_abi":
        return (
          <div className="text-sm bg-muted rounded-md px-3 py-2 my-1 space-y-1">
            <div><span className="text-muted-foreground">Contract: </span><span className="font-medium">{String(result.account_name)}</span></div>
            <div><span className="text-muted-foreground">Actions: </span>{(result.actions || []).join(", ")}</div>
            <div><span className="text-muted-foreground">Tables: </span>{(result.tables || []).join(", ")}</div>
          </div>
        )
      case "build_transaction":
        return <TxProposalCard data={result as any} onTxError={onTxError} />
      default:
        return <pre className="text-xs bg-muted p-2 rounded overflow-auto my-1">{JSON.stringify(result, null, 2)}</pre>
    }
  }

  return (
    <div className="relative group">
      {renderCard()}
      {BOOKMARKABLE.includes(toolName) && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); toggleBookmark() }}
        >
          <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? "fill-primary text-primary" : ""}`} />
        </Button>
      )}
    </div>
  )
}
```

**Step 5: Update left panel to show rich bookmarks**

Modify `components/layout/left-panel.tsx`:

Replace the simple text bookmark list with rich bookmark items that show the card type, label, and chain. Clicking a bookmark opens it in the right detail panel.

```typescript
"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useChain } from "@/lib/stores/chain-store"
import { useHistory } from "@/lib/stores/history-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Link2, Bookmark, Trash2, User, Box, FileText, Database, Coins, Shield, Users } from "lucide-react"

const TOOL_ICONS: Record<string, React.ElementType> = {
  get_account: User,
  get_block: Box,
  get_transaction: FileText,
  get_table_rows: Database,
  get_currency_balance: Coins,
  get_abi: Shield,
  get_producers: Users,
}

const TOOL_CONTEXT_TYPE: Record<string, string> = {
  get_account: "account",
  get_block: "block",
  get_transaction: "transaction",
}

export function LeftPanel() {
  const { leftOpen } = usePanels()
  const { chainInfo, chainName } = useChain()
  const { bookmarks, removeBookmark } = useHistory()
  const { setContext } = useDetailContext()
  const { openRight } = usePanels()

  const handleBookmarkClick = (bookmark: typeof bookmarks[0]) => {
    const contextType = TOOL_CONTEXT_TYPE[bookmark.tool_name]
    if (contextType) {
      setContext(contextType, bookmark.result)
      openRight()
    }
  }

  return (
    <aside
      className={cn(
        "border-r bg-muted/30 transition-all duration-300 overflow-hidden shrink-0",
        "max-md:absolute max-md:z-20 max-md:h-full",
        leftOpen ? "w-60" : "w-0"
      )}
    >
      <div className="h-full overflow-y-auto p-4 space-y-4">
        {/* Chain Info */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Link2 className="h-3 w-3" />
            Chain
          </h3>
          {chainInfo ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium truncate ml-2">{chainName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Head Block</span>
                <span className="font-mono">{chainInfo.head_block_num.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producer</span>
                <span className="font-mono">{chainInfo.head_block_producer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chain ID</span>
                <Badge variant="secondary" className="font-mono text-[9px]">
                  {chainInfo.chain_id.slice(0, 12)}...
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not connected</p>
          )}
        </div>

        <Separator />

        {/* Bookmarks */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bookmark className="h-3 w-3" />
            Bookmarks
          </h3>
          {bookmarks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookmarks yet</p>
          ) : (
            <div className="space-y-1">
              {bookmarks.map((bookmark) => {
                const Icon = TOOL_ICONS[bookmark.tool_name] || FileText
                return (
                  <div key={bookmark.id} className="flex items-center gap-2 group">
                    <button
                      className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors text-left truncate flex-1"
                      onClick={() => handleBookmarkClick(bookmark)}
                    >
                      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{bookmark.label}</span>
                    </button>
                    {bookmark.chain_name && (
                      <Badge variant="outline" className="text-[8px] shrink-0">
                        {bookmark.chain_name.split(" ")[0]}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => removeBookmark(bookmark.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
```

**Step 6: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 7: Commit**

```bash
git add app/api/bookmarks/ lib/stores/history-store.tsx components/chat/cards/tool-result-renderer.tsx components/layout/left-panel.tsx
git commit -m "feat: add server-side bookmarks with card bookmark button"
```

---

### Task 8: Conversations API + Store + Chat Persistence

**Files:**
- Create: `app/api/conversations/route.ts`
- Create: `app/api/conversations/[id]/route.ts`
- Create: `lib/stores/conversation-store.tsx`
- Modify: `components/chat/chat-panel.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `app/layout.tsx` (already done in Task 4 — just verify)

**Context:** Chat messages persist to Supabase. The user can switch between past conversations. New conversations are auto-created when the user sends their first message on a chain.

**Step 1: Create conversations API route**

Create `app/api/conversations/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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

export async function GET(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, chain_name, chain_endpoint, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: "Failed to fetch conversations" }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title: body.title || "New conversation",
      chain_name: body.chainName || null,
      chain_endpoint: body.chainEndpoint || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: "Failed to create conversation" }, { status: 500 })
  return Response.json(data)
}
```

**Step 2: Create conversation detail route (with messages)**

Create `app/api/conversations/[id]/route.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  // Verify ownership
  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 })

  // Get messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  return Response.json({ ...conv, messages: messages || [] })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) return Response.json({ error: "Failed to delete" }, { status: 500 })
  return Response.json({ success: true })
}
```

**Step 3: Create conversation store**

Create `lib/stores/conversation-store.tsx`:

```typescript
"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useAuth } from "@/lib/stores/auth-store"

interface Conversation {
  id: string
  title: string
  chain_name: string | null
  chain_endpoint: string | null
  created_at: string
  updated_at: string
}

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  createConversation: (chainName?: string, chainEndpoint?: string) => Promise<string>
  setActiveConversation: (id: string | null) => void
  deleteConversation: (id: string) => Promise<void>
  saveMessage: (conversationId: string, role: string, parts: unknown[]) => Promise<void>
  loadMessages: (conversationId: string) => Promise<Array<{ role: string; parts: unknown[] }>>
  refreshConversations: () => Promise<void>
}

const ConversationContext = createContext<ConversationState | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversation] = useState<string | null>(null)

  const getToken = () => localStorage.getItem("auth_token") || ""

  const refreshConversations = useCallback(async () => {
    const token = getToken()
    if (!token) return
    const res = await fetch("/api/conversations", {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (Array.isArray(data)) setConversations(data)
  }, [])

  useEffect(() => {
    if (user) refreshConversations()
    else {
      setConversations([])
      setActiveConversation(null)
    }
  }, [user, refreshConversations])

  const createConversation = useCallback(async (chainName?: string, chainEndpoint?: string) => {
    const token = getToken()
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: "New conversation", chainName, chainEndpoint }),
    })
    const data = await res.json()
    setConversations((prev) => [data, ...prev])
    setActiveConversation(data.id)
    return data.id
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    const token = getToken()
    await fetch(`/api/conversations/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConversationId === id) setActiveConversation(null)
  }, [activeConversationId])

  const saveMessage = useCallback(async (conversationId: string, role: string, parts: unknown[]) => {
    const token = getToken()
    // Use admin client via API — we'll add a messages endpoint
    await fetch(`/api/conversations/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, parts }),
    })
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    const token = getToken()
    const res = await fetch(`/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    return data.messages || []
  }, [])

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeConversationId,
        createConversation,
        setActiveConversation,
        deleteConversation,
        saveMessage,
        loadMessages,
        refreshConversations,
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversations() {
  const ctx = useContext(ConversationContext)
  if (!ctx) throw new Error("useConversations must be used within ConversationProvider")
  return ctx
}
```

Note: We need to add a POST handler to `app/api/conversations/[id]/route.ts` for saving messages:

Add to the existing file:
```typescript
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  // Verify ownership
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 })

  // Insert message
  const { error } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      role: body.role,
      parts: body.parts,
    })

  if (error) return Response.json({ error: "Failed to save message" }, { status: 500 })

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)

  return Response.json({ success: true })
}
```

**Step 4: Update app-shell provider tree**

Modify `components/layout/app-shell.tsx`:

Add `ConversationProvider` to the provider tree. Remove `AuthProvider` since it's now in the root layout. The new order:

```typescript
"use client"

import { PanelProvider } from "@/lib/stores/panel-store"
import { ChainProvider } from "@/lib/stores/chain-store"
import { LLMProvider } from "@/lib/stores/llm-store"
import { WalletProvider } from "@/lib/stores/wallet-store"
import { ContextProvider } from "@/lib/stores/context-store"
import { HistoryProvider } from "@/lib/stores/history-store"
import { ConversationProvider } from "@/lib/stores/conversation-store"
import { Header } from "./header"
import { LeftPanel } from "./left-panel"
import { RightPanel } from "./right-panel"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChainProvider>
      <WalletProvider>
        <LLMProvider>
          <ConversationProvider>
            <ContextProvider>
              <HistoryProvider>
                <PanelProvider>
                  <div className="h-screen flex flex-col">
                    <Header />
                    <div className="flex-1 flex overflow-hidden relative">
                      <LeftPanel />
                      <main className="flex-1 flex flex-col overflow-hidden">
                        {children}
                      </main>
                      <RightPanel />
                    </div>
                  </div>
                </PanelProvider>
              </HistoryProvider>
            </ContextProvider>
          </ConversationProvider>
        </LLMProvider>
      </WalletProvider>
    </ChainProvider>
  )
}
```

**Step 5: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add app/api/conversations/ lib/stores/conversation-store.tsx components/layout/app-shell.tsx
git commit -m "feat: add conversations API and store for chat persistence"
```

---

### Task 9: Update Header with Auth UI + Conversation Switcher

**Files:**
- Modify: `components/layout/header.tsx`

**Context:** The header should show the logged-in user's account name, a logout button, and a dropdown to switch between conversations (or start a new one).

**Step 1: Update header**

Modify `components/layout/header.tsx`:

```typescript
"use client"

import { usePanels } from "@/lib/stores/panel-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useConversations } from "@/lib/stores/conversation-store"
import { ChainSelector } from "@/components/chain/chain-selector"
import { LLMSettings } from "@/components/settings/llm-settings"
import { WalletButton } from "@/components/wallet/wallet-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PanelLeft, PanelRight, MessageSquare, Plus, Trash2 } from "lucide-react"

export function Header() {
  const { toggleLeft, toggleRight } = usePanels()
  const { user } = useAuth()
  const { conversations, activeConversationId, setActiveConversation, createConversation, deleteConversation } = useConversations()

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleLeft}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Antelope Explorer</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Conversation switcher */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chats
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => { setActiveConversation(null) }}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </DropdownMenuItem>
              {conversations.length > 0 && <DropdownMenuSeparator />}
              {conversations.slice(0, 20).map((conv) => (
                <DropdownMenuItem
                  key={conv.id}
                  className="flex items-center justify-between"
                  onClick={() => setActiveConversation(conv.id)}
                >
                  <span className="truncate text-xs flex-1">
                    {conv.title}
                    {conv.chain_name && (
                      <span className="text-muted-foreground ml-1">({conv.chain_name})</span>
                    )}
                  </span>
                  {activeConversationId === conv.id && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 ml-2" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1 shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ChainSelector />
        <WalletButton />
        <LLMSettings />
        <Button variant="ghost" size="icon" onClick={toggleRight}>
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
```

**Step 2: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 3: Commit**

```bash
git add components/layout/header.tsx
git commit -m "feat: add conversation switcher and auth UI to header"
```

---

### Task 10: Wire Up Chat Panel to Conversations

**Files:**
- Modify: `components/chat/chat-panel.tsx`

**Context:** The chat panel should:
1. Auto-create a conversation when the user sends their first message
2. Save messages to the active conversation
3. Load messages when switching conversations
4. The `isConfigured` check now depends on the auth + LLM store's `hasApiKey`

**Step 1: Update chat-panel.tsx**

The key changes:
- Import `useConversations` and `useAuth`
- On first message send, create a conversation if none active
- After each message exchange, save to DB
- On conversation switch, load messages from DB
- Remove `useLLM` config ref (no longer needed for fetch)
- Keep `isConfigured` check from `useLLM`

```typescript
"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useMemo, useCallback } from "react"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { MarkdownContent } from "./markdown-content"
import { useLLM } from "@/lib/stores/llm-store"
import { useChain } from "@/lib/stores/chain-store"
import { useWallet } from "@/lib/stores/wallet-store"
import { useAuth } from "@/lib/stores/auth-store"
import { useConversations } from "@/lib/stores/conversation-store"
import { Bot, MessageSquare } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { isToolUIPart, getToolName } from "ai"
import { ToolResultRenderer } from "./cards/tool-result-renderer"

export function ChatPanel() {
  const { isConfigured } = useLLM()
  const { endpoint, chainName } = useChain()
  const { accountName } = useWallet()
  const { user } = useAuth()
  const {
    activeConversationId,
    createConversation,
    saveMessage,
    loadMessages,
  } = useConversations()
  const scrollRef = useRef<HTMLDivElement>(null)

  const endpointRef = useRef(endpoint)
  const accountRef = useRef(accountName)
  const activeConvRef = useRef(activeConversationId)
  endpointRef.current = endpoint
  accountRef.current = accountName
  activeConvRef.current = activeConversationId

  const customFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string || "{}")
    body.chainEndpoint = endpointRef.current || ""
    body.walletAccount = accountRef.current || ""
    const token = localStorage.getItem("auth_token") || ""
    return fetch(input, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init?.headers).entries()),
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  }, [])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: customFetch,
      }),
    [customFetch]
  )

  const { messages, sendMessage, setMessages, status } = useChat({ transport })

  const isLoading = status === "submitted" || status === "streaming"

  const handleTxError = useCallback((error: string, actions: Array<{ account: string; name: string; data: Record<string, unknown> }>) => {
    sendMessage({
      text: `[Transaction Error: ${error}]\nFailed actions: ${JSON.stringify(actions)}\nPlease analyze the error and build a corrected transaction.`,
    })
  }, [sendMessage])

  // Load messages when switching conversations
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId).then((msgs) => {
        // Convert DB messages to useChat format
        const chatMessages = msgs.map((m: { role: string; parts: unknown[] }, i: number) => ({
          id: `loaded-${i}`,
          role: m.role,
          parts: m.parts,
        }))
        setMessages(chatMessages)
      })
    } else {
      setMessages([])
    }
  }, [activeConversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save messages to DB when they change (debounced)
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    if (!activeConvRef.current) return
    if (messages.length <= prevMsgCountRef.current) {
      prevMsgCountRef.current = messages.length
      return
    }
    // Save new messages
    const newMessages = messages.slice(prevMsgCountRef.current)
    prevMsgCountRef.current = messages.length
    for (const msg of newMessages) {
      if (status !== "streaming") {
        saveMessage(activeConvRef.current, msg.role, msg.parts)
      }
    }
  }, [messages, status, saveMessage])

  // Handle sending with auto-conversation creation
  const handleSend = useCallback(async (text: string) => {
    if (!activeConvRef.current) {
      // Create a new conversation first
      const convId = await createConversation(chainName || undefined, endpoint || undefined)
      activeConvRef.current = convId
    }
    sendMessage({ text })
  }, [sendMessage, createConversation, chainName, endpoint])

  // Clear chat and send intro on chain or account change
  const prevChainRef = useRef(endpoint)
  const prevAccountRef = useRef(accountName)
  useEffect(() => {
    const chainChanged = prevChainRef.current !== endpoint
    const accountChanged = prevAccountRef.current !== accountName
    prevChainRef.current = endpoint
    prevAccountRef.current = accountName

    if ((chainChanged || accountChanged) && isConfigured) {
      setMessages([])
      activeConvRef.current = null
      const timer = setTimeout(() => {
        const parts: string[] = []
        if (endpoint && chainName) parts.push(`connected to **${chainName}**`)
        if (accountName) parts.push(`wallet **${accountName}**`)
        if (parts.length > 0) {
          sendMessage({ text: `[System: The user just ${chainChanged ? "switched chain" : "changed wallet"}. They are ${parts.join(" with ")}. Introduce yourself briefly and tell them what you can help with.]` })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [endpoint, accountName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  if (!isConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Welcome to Antelope Explorer</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Configure your LLM provider in Settings to start chatting with the blockchain.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {chainName && (
        <div className="px-4 py-1 border-b">
          <span className="text-xs text-muted-foreground">
            Connected to: <span className="font-medium text-foreground">{chainName}</span>
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {endpoint
                  ? "Ask me anything about the blockchain"
                  : "Connect to a chain to get started, or ask me anything"}
              </p>
            </div>
          ) : (
            messages
              .filter((message) => {
                if (message.role === "user" && message.parts.length === 1 && message.parts[0].type === "text") {
                  const text = (message.parts[0] as { type: "text"; text: string }).text
                  if (text.startsWith("[System:") || text.startsWith("[Transaction Error:")) return false
                }
                return true
              })
              .map((message) => (
              <ChatMessage key={message.id} role={message.role as "user" | "assistant"}>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    if (message.role === "assistant") {
                      return <MarkdownContent key={i} content={part.text} />
                    }
                    return <span key={i}>{part.text}</span>
                  }
                  if (isToolUIPart(part)) {
                    const toolName = getToolName(part)
                    if (part.state === "output-available") {
                      return (
                        <ToolResultRenderer
                          key={i}
                          toolName={toolName}
                          result={part.output as Record<string, unknown>}
                          onTxError={handleTxError}
                        />
                      )
                    }
                    return (
                      <div key={i} className="text-xs text-muted-foreground animate-pulse my-1">
                        Calling {toolName}...
                      </div>
                    )
                  }
                  return null
                })}
              </ChatMessage>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3 px-4 py-3">
              <Avatar className="h-8 w-8 border flex items-center justify-center bg-primary/10 shrink-0">
                <Bot className="h-4 w-4" />
              </Avatar>
              <div className="flex items-center gap-1 px-4 py-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={!isConfigured}
        placeholder={
          !endpoint
            ? "Connect to a chain first, or ask a general question..."
            : "Ask anything about the blockchain..."
        }
      />
    </div>
  )
}
```

**Step 2: Verify build**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/sachitdabas/explorer && npx next build 2>&1 | tail -20
```

**Step 3: Commit**

```bash
git add components/chat/chat-panel.tsx
git commit -m "feat: wire chat panel to conversation persistence"
```

---

### Summary of all tasks:

1. **Task 1:** Install deps + Supabase client setup
2. **Task 2:** Database migration SQL
3. **Task 3:** Auth API routes + auth store + wallet-store integration
4. **Task 4:** Login page + route group restructure
5. **Task 5:** Next.js middleware
6. **Task 6:** Settings API + LLM store migration + chat route update
7. **Task 7:** Bookmarks API + store migration + card bookmark button + left panel
8. **Task 8:** Conversations API + store + app-shell provider update
9. **Task 9:** Header with conversation switcher
10. **Task 10:** Wire chat panel to conversation persistence

**Post-implementation:** The user needs to:
1. Create a Supabase project at supabase.com
2. Copy project URL, anon key, service role key, and JWT secret to `.env.local`
3. Run the migration SQL in Supabase SQL Editor
4. Test the full flow: login page → connect wallet → configure LLM → chat → bookmark → switch conversations
