# Talkblock

Chat-first blockchain explorer for [Antelope](https://antelope.io) chains. Ask questions in natural language, get structured results, and build a personal dashboard from bookmarked data.

**Live at [talkblock.me](https://talkblock.me)**

## Features

- **Chat interface** -- Ask about accounts, blocks, transactions, contracts, token balances, producers, and more using natural language
- **Multi-chain** -- EOS, WAX, Telos, Jungle4, FIO, Libre, or any custom RPC endpoint
- **Dashboard** -- Bookmark results from chat and arrange them as draggable, renamable cards in a 2-column grid with auto-refresh and data age labels
- **Built-in LLM** -- Free tier powered by Chutes (5 requests/day per account)
- **Bring Your Own Key** -- Anthropic (Claude), OpenAI (GPT), Google (Gemini), or Chutes -- API keys stored locally, never sent to the server
- **Per-account credits** -- Purchase additional tokens with TLOS on Telos Mainnet (1 TLOS = 250,000 tokens), tied to chain + account
- **Contract guides** -- 8 curated guides (eosio.token, eosio, eosio.msig, atomicassets, telos.decide, dgoods, res.pink, thezeosalias) the LLM loads on-demand for accurate transaction building
- **24 LLM tools** -- 9 core RPC tools + 15 Hyperion-powered tools including actions, transfers, tokens, deltas, voters, proposals, and more
- **Shareable transaction links** -- Copy a shareable URL for any transaction; opening the link auto-connects to the chain and looks up the transaction
- **Clickable entities** -- Account names and transaction IDs in chat responses are clickable, opening a detail panel with full account/transaction info
- **Detail panel** -- Right-side panel shows account resources, permissions, staking, voting info, or transaction actions and status
- **Wallet integration** -- Connect via Anchor wallet (Wharfkit) to sign and broadcast transactions; cleos command preview with copy button
- **Health monitoring** -- Sidebar status dots for each chain: green (RPC + Hyperion), yellow (RPC only), orange (Hyperion only), red (none); checks every 5 minutes
- **Light/Dark theme** -- Toggle between themes, preference persists across sessions
- **Works without auth** -- Full functionality using localStorage; optionally connect Supabase for server-side persistence

## Tech Stack

- **Framework** -- Next.js 16 (App Router, Turbopack)
- **UI** -- React 19, Tailwind CSS 4, shadcn/ui, Lucide icons
- **AI** -- Vercel AI SDK with tool-calling for on-chain queries
- **Blockchain** -- Wharfkit for wallet sessions and contract interaction
- **Database** -- Supabase (optional, for auth and persistent bookmarks/conversations)

## Getting Started

### Prerequisites

- Node.js >= 20.9.0

### Install

```bash
git clone https://github.com/sdabas9/talkblock.git
cd talkblock
npm install
```

### Configure

The app works in two modes:

**Without Supabase (BYOK only)** -- no env file needed:

```bash
npm run dev
```

You configure your own LLM API key in the browser. Chat, bookmarks, and settings all use localStorage. Auth, credits, and server-side persistence are disabled.

**With Supabase (full features)** -- copy the example env file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | For auth/persistence | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth/persistence | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | For auth/persistence | Supabase service role key (server-side only) |
| `SUPABASE_JWT_SECRET` | For auth/persistence | JWT secret for signing auth tokens |
| `CHUTES_API_KEY` | For built-in LLM | Chutes API key for the free built-in model |

When all four Supabase variables are set, you get: wallet-based auth, server-side bookmarks/conversations, per-account credits, and the built-in LLM tier.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a chain, configure your LLM provider, and start chatting.

## Project Structure

```
app/
  (app)/            -- Main app layout and page (chat + dashboard)
  api/              -- API routes (chat, auth, bookmarks, conversations, credits, settings, lookup proxy)
  login/            -- Chain selection page
components/
  chat/             -- Chat panel, message rendering, tool result cards
  context/          -- Detail panel components (account, transaction, block)
  dashboard/        -- Dashboard view and card components
  layout/           -- App shell, header, sidebar, right detail panel
  chain/            -- Chain selector
  settings/         -- LLM settings
  wallet/           -- Wallet button
lib/
  antelope/         -- Antelope helpers (data refetch, formatting, entity lookup)
  contracts/        -- Contract guide registry and per-contract guide files
  llm/              -- LLM tool definitions
  stores/           -- React context stores (panel, history, dashboard, auth, chain, LLM, wallet, conversation)
  supabase/         -- Supabase client/server helpers
supabase/
  migrations/       -- Database schema
```

## License

MIT
