# Talkblock

Chat-first blockchain explorer for [Antelope](https://antelope.io) chains. Ask questions in natural language, get structured results, and build a personal dashboard from bookmarked data.

## Features

- **Chat interface** -- Ask about accounts, blocks, transactions, contracts, token balances, and producers using natural language
- **Multi-chain** -- Connect to EOS, WAX, Telos, Jungle4, FIO, Libre, or any custom RPC endpoint
- **Dashboard** -- Bookmark results from chat and arrange them as draggable, renamable cards in a responsive grid
- **Multi-provider LLM** -- Bring your own API key for Anthropic (Claude), OpenAI (GPT), or Google (Gemini)
- **Wallet integration** -- Connect via Anchor wallet (Wharfkit) to sign and broadcast transactions
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

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials (optional -- the app works without them using localStorage).

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a chain, configure your LLM provider, and start chatting.

## Project Structure

```
app/
  (app)/          -- Main app layout and page (chat + dashboard)
  api/            -- API routes (chat, auth, bookmarks, conversations, settings)
  login/          -- Chain selection page
components/
  chat/           -- Chat panel, message rendering, tool result cards
  dashboard/      -- Dashboard view and card components
  layout/         -- App shell, header, left panel
  chain/          -- Chain selector
  settings/       -- LLM settings
  wallet/         -- Wallet button
lib/
  stores/         -- React context stores (panel, history, dashboard, auth, chain, LLM, wallet, conversation)
  supabase/       -- Supabase client/server helpers
supabase/
  migrations/     -- Database schema
```

## License

MIT
