# Explorer TUI Design

## Overview

A terminal user interface (TUI) equivalent of the Talkblock web explorer, targeting developer power users who prefer working in the terminal. Built with TypeScript + Ink (React for terminals) — the same stack used by Claude Code.

## Requirements

- Full feature parity with web app: AI chat, direct lookups, transaction building, bookmarks
- Standalone operation — no Supabase, no server dependency
- Direct LLM API calls (user provides their own API key)
- Encrypted local keychain for private key management
- Local JSON file storage for config, bookmarks, conversations
- Separate project at `~/explorer-tui` (sibling directory)

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Language | TypeScript | Reuse web app code (clients, types, tools) |
| TUI Framework | Ink (React) | Production-proven (Claude Code uses it), component model |
| LLM SDK | Vercel AI SDK (`ai`) | Same as web app, supports streaming + tools |
| LLM Providers | Anthropic, OpenAI, Google | Direct API calls, user-provided keys |
| Schema Validation | Zod | Same as web app tool definitions |
| Encryption | Node.js `crypto` | AES-256-GCM for keychain |
| Storage | JSON files | `~/.explorer-tui/` directory |

## Project Structure

```
~/explorer-tui/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.tsx              # Entry point, Ink App render
│   ├── app.tsx                # Main App component (mode router)
│   ├── components/
│   │   ├── Chat.tsx           # AI chat view (default mode)
│   │   ├── ChatInput.tsx      # Input bar with command history
│   │   ├── ToolCard.tsx       # Renders tool results (tables, bars)
│   │   ├── StatusBar.tsx      # Top bar: chain, account, status
│   │   ├── BookmarkList.tsx   # Bookmark viewer
│   │   ├── WalletManager.tsx  # Key import/unlock/list
│   │   ├── ChainSelector.tsx  # Chain picker on first run
│   │   └── ConfigView.tsx     # Settings editor
│   ├── lib/
│   │   ├── antelope/
│   │   │   ├── client.ts      # AntelopeClient (copied from web)
│   │   │   ├── hyperion.ts    # HyperionClient (copied from web)
│   │   │   ├── chains.ts      # Chain presets (copied from web)
│   │   │   └── types.ts       # Shared types
│   │   ├── contracts/         # Contract guide registry (copied)
│   │   ├── llm/
│   │   │   ├── tools.ts       # Tool definitions (adapted)
│   │   │   ├── provider.ts    # Direct LLM provider setup
│   │   │   └── system.ts      # TUI-adapted system prompt
│   │   ├── wallet/
│   │   │   ├── keychain.ts    # AES-256-GCM encrypted storage
│   │   │   └── signer.ts      # Transaction signing
│   │   └── store/
│   │       ├── config.ts      # Config management
│   │       ├── bookmarks.ts   # Bookmark storage
│   │       └── conversations.ts  # Conversation history
│   └── utils/
│       └── format.ts          # Terminal-friendly formatters
└── bin/
    └── explorer.js            # CLI entry: #!/usr/bin/env node
```

### Local Data Directory

```
~/.explorer-tui/
├── config.json          # Chain, LLM provider, API key, preferences
├── keychain.enc         # Encrypted private keys
├── bookmarks.json       # Saved tool results
└── conversations/       # Chat history files
    └── <uuid>.json
```

## UI Layout

### Chat Mode (Default)

```
┌─ explorer ─────────── EOS Mainnet ─── eosio.token ──┐
│                                                      │
│  You: What's the balance of myaccount?               │
│                                                      │
│  ┌─ get_account ───────────────────────────────────┐ │
│  │ Account: myaccount                              │ │
│  │ Balance: 142.3051 EOS                           │ │
│  │ RAM:  ████████░░ 82%  (12.4/15.2 KB)           │ │
│  │ CPU:  ██░░░░░░░░ 21%  (2.1/10.0 ms)            │ │
│  │ NET:  ░░░░░░░░░░  4%  (0.2/5.0 KB)             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  myaccount has 142.3 EOS with moderate resource      │
│  usage. RAM is at 82% — consider buying more.        │
│                                                      │
├──────────────────────────────────────────────────────┤
│ > _                                          [Chat]  │
└──────────────────────────────────────────────────────┘
```

## Navigation & Commands

| Command | Action |
|---------|--------|
| `/chain` | Switch chain (interactive picker) |
| `/account <name>` | Direct account lookup |
| `/table <code> <table> [scope]` | Direct table query |
| `/block <num>` | Direct block lookup |
| `/tx <id>` | Direct transaction lookup |
| `/wallet` | Wallet manager (import/list/unlock keys) |
| `/bookmarks` | View/manage saved bookmarks |
| `/bookmark` | Save last tool result |
| `/config` | Edit settings (LLM, chain) |
| `/history` | List past conversations |
| `/clear` | Clear chat |
| `/help` | Show commands |
| `Ctrl+C` | Exit |

### Keyboard Shortcuts

- `Up/Down` — Scroll through input history
- `Tab` — Autocomplete commands and account names
- `Ctrl+L` — Clear screen
- `Ctrl+S` — Save conversation

## Encrypted Keychain

```
Master Password → PBKDF2 (100k iterations, SHA-512) → Derived Key
Private Key → AES-256-GCM(Derived Key) → Encrypted Blob

Storage format per key:
{
  name: string,
  publicKey: string,
  encryptedPrivateKey: base64,
  iv: base64,
  salt: base64,
  tag: base64
}
```

- Master password set on first `/wallet import`
- Password required once per session to unlock keychain
- Transaction signing shows action details and prompts confirmation
- User selects which key to sign with if multiple stored

## LLM Integration

- Vercel AI SDK `streamText()` for streaming responses
- Same `createChainTools()` tool definitions from web app
- System prompt adapted: no browser references, adds TUI command hints
- Provider selection via `/config`:
  - `anthropic` — Claude models
  - `openai` — GPT models
  - `google` — Gemini models
- API key stored in `~/.explorer-tui/config.json`

## Data Flow

```
User Input → Command Parser
  ├─ /command → Direct AntelopeClient/HyperionClient call → Render result
  └─ chat text → streamText(tools, systemPrompt, messages)
                    ├─ tool_call → execute tool → result card
                    └─ text chunk → stream to terminal
```

## Code Reuse from Web App

### Direct copy (no changes needed):
- `lib/antelope/client.ts` — Uses native `fetch()`, no Next.js deps
- `lib/antelope/hyperion.ts` — Uses native `fetch()`, no Next.js deps
- `lib/antelope/chains.ts` — Pure data
- `lib/contracts/*` — Pure TypeScript guide registry

### Adapt (minor changes):
- `lib/llm/tools.ts` — Same tool definitions, remove `build_transaction` web-specific parts
- `lib/antelope/refetch.ts` — Reusable refresh logic

### New for TUI:
- All Ink components
- Keychain encryption module
- Local JSON store
- CLI entry point and argument parsing
- Terminal formatters (progress bars, tables, colors)

## Non-Goals (v1)

- No Supabase integration or credit system
- No conversation sync with web app
- No hardware wallet support (future)
- No custom chain health monitoring UI
- No drag-and-drop bookmark reordering (linear list instead)
