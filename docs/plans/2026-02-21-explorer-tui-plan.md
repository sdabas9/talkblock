# Explorer TUI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a terminal UI equivalent of the Talkblock blockchain explorer using TypeScript + Ink, with AI chat, direct lookups, transaction signing via encrypted keychain, and bookmarks.

**Architecture:** Standalone Node.js CLI app using Ink (React for terminals) with the Vercel AI SDK for LLM streaming. Reuses Antelope RPC/Hyperion clients and tool definitions from the web app. All state stored locally in `~/.explorer-tui/` as JSON files with an AES-256-GCM encrypted keychain.

**Tech Stack:** TypeScript, Ink 5, Vercel AI SDK (`ai`), Zod, Node.js `crypto` module

---

### Task 1: Scaffold Project

**Files:**
- Create: `~/explorer-tui/package.json`
- Create: `~/explorer-tui/tsconfig.json`
- Create: `~/explorer-tui/.env.example`
- Create: `~/explorer-tui/.gitignore`
- Create: `~/explorer-tui/bin/explorer.js`
- Create: `~/explorer-tui/src/index.tsx`

**Step 1: Create the project directory and initialize**

```bash
mkdir -p ~/explorer-tui/bin ~/explorer-tui/src
cd ~/explorer-tui
git init
```

**Step 2: Create package.json**

```json
{
  "name": "explorer-tui",
  "version": "0.1.0",
  "description": "Terminal UI for Antelope blockchain exploration",
  "type": "module",
  "bin": {
    "explorer": "./bin/explorer.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "node --test dist/**/*.test.js"
  },
  "dependencies": {
    "ink": "^5.2.0",
    "ink-text-input": "^6.0.0",
    "react": "^18.3.1",
    "ai": "^6.0.79",
    "@ai-sdk/anthropic": "^3.0.41",
    "@ai-sdk/openai": "^3.0.26",
    "@ai-sdk/google": "^3.0.24",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create bin/explorer.js**

```javascript
#!/usr/bin/env node
import '../dist/index.js';
```

**Step 5: Create .env.example**

```
# LLM API Key (set one)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
.env
```

**Step 7: Create minimal src/index.tsx**

```tsx
import React from 'react';
import { render, Box, Text } from 'ink';

function App() {
  return (
    <Box>
      <Text>explorer-tui starting...</Text>
    </Box>
  );
}

render(<App />);
```

**Step 8: Install dependencies and verify build**

```bash
cd ~/explorer-tui
npm install
npx tsc
node dist/index.js
```

Expected: prints "explorer-tui starting..." and exits.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold explorer-tui project"
```

---

### Task 2: Copy Antelope Clients and Chain Presets

**Files:**
- Create: `~/explorer-tui/src/lib/antelope/client.ts`
- Create: `~/explorer-tui/src/lib/antelope/hyperion.ts`
- Create: `~/explorer-tui/src/lib/antelope/chains.ts`
- Create: `~/explorer-tui/src/lib/antelope/lookup.ts`

**Step 1: Copy client.ts from web app**

Copy `/Users/sachitdabas/explorer/lib/antelope/client.ts` to `~/explorer-tui/src/lib/antelope/client.ts`. No changes needed — it uses native `fetch()`.

**Step 2: Copy hyperion.ts from web app**

Copy `/Users/sachitdabas/explorer/lib/antelope/hyperion.ts` to `~/explorer-tui/src/lib/antelope/hyperion.ts`. No changes needed.

**Step 3: Create chains.ts with presets extracted from chain-store**

```typescript
export interface ChainPreset {
  name: string;
  url: string;
  hyperion: string;
}

export const PRESET_CHAINS: ChainPreset[] = [
  { name: "EOS Mainnet", url: "https://eos.greymass.com", hyperion: "https://eos.hyperion.eosrio.io" },
  { name: "Jungle4 Testnet", url: "https://jungle4.greymass.com", hyperion: "https://jungle.eosusa.io" },
  { name: "WAX Mainnet", url: "https://wax.greymass.com", hyperion: "https://wax.eosrio.io" },
  { name: "Telos Mainnet", url: "https://telos.greymass.com", hyperion: "https://mainnet.telos.net" },
  { name: "FIO Mainnet", url: "https://fio.greymass.com", hyperion: "https://fio.cryptolions.io" },
  { name: "Libre", url: "https://libre.greymass.com", hyperion: "https://libre.eosusa.io" },
];
```

**Step 4: Create lookup.ts with validation helpers (no API route dependency)**

```typescript
const ACCOUNT_RE = /^[a-z1-5][a-z1-5.]{0,11}[a-z1-5]$|^[a-z1-5]$/;
const TX_RE = /^[a-f0-9]{64}$/;

export function isAccountName(text: string): boolean {
  return text.length >= 1 && text.length <= 13 && ACCOUNT_RE.test(text);
}

export function isTxId(text: string): boolean {
  return TX_RE.test(text);
}

export function stripPermission(text: string): string {
  return text.split("@")[0];
}
```

**Step 5: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/lib/antelope/
git commit -m "feat: add Antelope RPC and Hyperion clients with chain presets"
```

---

### Task 3: Copy Contract Guides

**Files:**
- Create: `~/explorer-tui/src/lib/contracts/index.ts`
- Create: `~/explorer-tui/src/lib/contracts/guides.ts`
- Create: `~/explorer-tui/src/lib/contracts/guides/` (8 guide files)

**Step 1: Copy the entire contracts directory**

Copy these files from `/Users/sachitdabas/explorer/lib/contracts/` to `~/explorer-tui/src/lib/contracts/`:
- `index.ts` — remove the `@/` import alias, use relative import `"./guides"` instead
- `guides.ts` — update imports from `"./guides/eosio-system"` etc.
- `guides/eosio-system.ts`
- `guides/eosio-token.ts`
- `guides/eosio-msig.ts`
- `guides/atomicassets.ts`
- `guides/telos-decide.ts`
- `guides/dgoods.ts`
- `guides/res-pink.ts`
- `guides/thezeosalias.ts`

Key change in `index.ts`: replace `import { GUIDES } from "./guides"` — keep as-is since it's already a relative import. Check for any `@/` aliases and convert to relative paths.

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/lib/contracts/
git commit -m "feat: add contract guide registry (8 guides)"
```

---

### Task 4: Local Config Store

**Files:**
- Create: `~/explorer-tui/src/lib/store/config.ts`

**Step 1: Write the test**

Create `~/explorer-tui/src/lib/store/config.test.ts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Config, loadConfig, saveConfig, getDataDir } from './config.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Config', () => {
  const testDir = path.join(os.tmpdir(), 'explorer-tui-test-' + Date.now());

  it('returns defaults when no file exists', () => {
    const config = loadConfig(testDir);
    assert.strictEqual(config.llmProvider, 'anthropic');
    assert.strictEqual(config.chainEndpoint, null);
  });

  it('saves and loads config', () => {
    const config: Config = {
      llmProvider: 'openai',
      llmModel: 'gpt-4o',
      llmApiKey: 'sk-test',
      chainEndpoint: 'https://eos.greymass.com',
      chainName: 'EOS Mainnet',
      hyperionEndpoint: 'https://eos.hyperion.eosrio.io',
      walletAccount: null,
    };
    saveConfig(config, testDir);
    const loaded = loadConfig(testDir);
    assert.deepStrictEqual(loaded, config);
    // Cleanup
    fs.rmSync(testDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/explorer-tui && npx tsc && node --test dist/lib/store/config.test.js
```

Expected: FAIL — module not found.

**Step 3: Implement config.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface Config {
  llmProvider: 'anthropic' | 'openai' | 'google';
  llmModel: string | null;
  llmApiKey: string | null;
  chainEndpoint: string | null;
  chainName: string | null;
  hyperionEndpoint: string | null;
  walletAccount: string | null;
}

const DEFAULTS: Config = {
  llmProvider: 'anthropic',
  llmModel: null,
  llmApiKey: null,
  chainEndpoint: null,
  chainName: null,
  hyperionEndpoint: null,
  walletAccount: null,
};

export function getDataDir(base?: string): string {
  return base || path.join(os.homedir(), '.explorer-tui');
}

export function loadConfig(base?: string): Config {
  const dir = getDataDir(base);
  const file = path.join(dir, 'config.json');
  if (!fs.existsSync(file)) return { ...DEFAULTS };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Config, base?: string): void {
  const dir = getDataDir(base);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2));
}
```

**Step 4: Run test to verify it passes**

```bash
cd ~/explorer-tui && npx tsc && node --test dist/lib/store/config.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/store/
git commit -m "feat: add local config store with JSON persistence"
```

---

### Task 5: Bookmark Store

**Files:**
- Create: `~/explorer-tui/src/lib/store/bookmarks.ts`

**Step 1: Write the test**

Create `~/explorer-tui/src/lib/store/bookmarks.test.ts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Bookmark, loadBookmarks, addBookmark, removeBookmark } from './bookmarks.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Bookmarks', () => {
  const testDir = path.join(os.tmpdir(), 'explorer-tui-bm-' + Date.now());

  it('starts empty', () => {
    const bm = loadBookmarks(testDir);
    assert.strictEqual(bm.length, 0);
  });

  it('adds and removes bookmarks', () => {
    const b: Omit<Bookmark, 'id' | 'createdAt'> = {
      toolName: 'get_account',
      label: 'My EOS',
      result: { balance: '100 EOS' },
      chainName: 'EOS Mainnet',
    };
    const added = addBookmark(b, testDir);
    assert.strictEqual(added.toolName, 'get_account');
    assert.strictEqual(loadBookmarks(testDir).length, 1);

    removeBookmark(added.id, testDir);
    assert.strictEqual(loadBookmarks(testDir).length, 0);

    fs.rmSync(testDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/explorer-tui && npx tsc && node --test dist/lib/store/bookmarks.test.js
```

**Step 3: Implement bookmarks.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Bookmark {
  id: string;
  toolName: string;
  label: string;
  result: Record<string, unknown>;
  chainName: string;
  createdAt: string;
}

function getFile(base: string): string {
  return path.join(base, 'bookmarks.json');
}

export function loadBookmarks(base: string): Bookmark[] {
  const file = getFile(base);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Bookmark[], base: string): void {
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(getFile(base), JSON.stringify(bookmarks, null, 2));
}

export function addBookmark(
  data: Omit<Bookmark, 'id' | 'createdAt'>,
  base: string,
): Bookmark {
  const bookmarks = loadBookmarks(base);
  const bookmark: Bookmark = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  bookmarks.push(bookmark);
  saveBookmarks(bookmarks, base);
  return bookmark;
}

export function removeBookmark(id: string, base: string): void {
  const bookmarks = loadBookmarks(base).filter((b) => b.id !== id);
  saveBookmarks(bookmarks, base);
}
```

**Step 4: Run test to verify it passes**

```bash
cd ~/explorer-tui && npx tsc && node --test dist/lib/store/bookmarks.test.js
```

**Step 5: Commit**

```bash
git add src/lib/store/bookmarks.ts src/lib/store/bookmarks.test.ts
git commit -m "feat: add bookmark store with JSON persistence"
```

---

### Task 6: Conversation Store

**Files:**
- Create: `~/explorer-tui/src/lib/store/conversations.ts`

**Step 1: Implement conversations.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; result: unknown }>;
}

export interface Conversation {
  id: string;
  title: string;
  chainName: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

function getDir(base: string): string {
  return path.join(base, 'conversations');
}

export function listConversations(base: string): Omit<Conversation, 'messages'>[] {
  const dir = getDir(base);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        const { messages, ...meta } = data;
        return meta as Omit<Conversation, 'messages'>;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt)) as Omit<Conversation, 'messages'>[];
}

export function loadConversation(id: string, base: string): Conversation | null {
  const file = path.join(getDir(base), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveConversation(conv: Conversation, base: string): void {
  const dir = getDir(base);
  fs.mkdirSync(dir, { recursive: true });
  conv.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dir, `${conv.id}.json`), JSON.stringify(conv, null, 2));
}

export function createConversation(title: string, chainName: string, base: string): Conversation {
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title,
    chainName,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveConversation(conv, base);
  return conv;
}

export function deleteConversation(id: string, base: string): void {
  const file = path.join(getDir(base), `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/lib/store/conversations.ts
git commit -m "feat: add conversation store with JSON file persistence"
```

---

### Task 7: Encrypted Keychain

**Files:**
- Create: `~/explorer-tui/src/lib/wallet/keychain.ts`

**Step 1: Write the test**

Create `~/explorer-tui/src/lib/wallet/keychain.test.ts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Keychain } from './keychain.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Keychain', () => {
  const testDir = path.join(os.tmpdir(), 'explorer-tui-kc-' + Date.now());
  const password = 'test-password-123';

  it('initializes empty keychain', () => {
    const kc = new Keychain(testDir);
    kc.unlock(password);
    assert.strictEqual(kc.listKeys().length, 0);
  });

  it('imports and retrieves a key', () => {
    const kc = new Keychain(testDir);
    kc.unlock(password);
    kc.importKey('mykey', '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');
    const keys = kc.listKeys();
    assert.strictEqual(keys.length, 1);
    assert.strictEqual(keys[0].name, 'mykey');

    const retrieved = kc.getKey('mykey');
    assert.strictEqual(retrieved, '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');
  });

  it('persists across instances', () => {
    const kc2 = new Keychain(testDir);
    kc2.unlock(password);
    assert.strictEqual(kc2.listKeys().length, 1);
    assert.strictEqual(kc2.getKey('mykey'), '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');
  });

  it('fails with wrong password', () => {
    const kc3 = new Keychain(testDir);
    assert.throws(() => kc3.unlock('wrong-password'), /decrypt/i);
    fs.rmSync(testDir, { recursive: true });
  });

  it('removes a key', () => {
    const dir2 = path.join(os.tmpdir(), 'explorer-tui-kc2-' + Date.now());
    const kc = new Keychain(dir2);
    kc.unlock(password);
    kc.importKey('k1', 'secret1');
    kc.importKey('k2', 'secret2');
    assert.strictEqual(kc.listKeys().length, 2);
    kc.removeKey('k1');
    assert.strictEqual(kc.listKeys().length, 1);
    fs.rmSync(dir2, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ~/explorer-tui && npx tsc && node --test dist/lib/wallet/keychain.test.js
```

**Step 3: Implement keychain.ts**

```typescript
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface StoredKey {
  name: string;
  encryptedPrivateKey: string; // base64
  iv: string;   // base64
  tag: string;  // base64
}

interface KeychainFile {
  salt: string;       // base64
  verifier: string;   // base64 — encrypted known string for password validation
  verifierIv: string; // base64
  verifierTag: string;// base64
  keys: StoredKey[];
}

const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100_000;
const VERIFY_PLAINTEXT = 'explorer-tui-keychain-ok';

export class Keychain {
  private derivedKey: Buffer | null = null;
  private data: KeychainFile | null = null;
  private filePath: string;

  constructor(private base: string) {
    this.filePath = path.join(base, 'keychain.enc');
  }

  unlock(password: string): void {
    if (fs.existsSync(this.filePath)) {
      this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      const salt = Buffer.from(this.data!.salt, 'base64');
      this.derivedKey = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha512');
      // Verify password by decrypting the verifier
      try {
        this.decrypt(this.data!.verifier, this.data!.verifierIv, this.data!.verifierTag);
      } catch {
        this.derivedKey = null;
        this.data = null;
        throw new Error('Failed to decrypt keychain — wrong password?');
      }
    } else {
      // New keychain
      const salt = crypto.randomBytes(32);
      this.derivedKey = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha512');
      const { encrypted, iv, tag } = this.encrypt(VERIFY_PLAINTEXT);
      this.data = {
        salt: salt.toString('base64'),
        verifier: encrypted,
        verifierIv: iv,
        verifierTag: tag,
        keys: [],
      };
      this.save();
    }
  }

  get isUnlocked(): boolean {
    return this.derivedKey !== null;
  }

  listKeys(): Array<{ name: string }> {
    this.ensureUnlocked();
    return this.data!.keys.map((k) => ({ name: k.name }));
  }

  importKey(name: string, privateKey: string): void {
    this.ensureUnlocked();
    if (this.data!.keys.some((k) => k.name === name)) {
      throw new Error(`Key "${name}" already exists`);
    }
    const { encrypted, iv, tag } = this.encrypt(privateKey);
    this.data!.keys.push({
      name,
      encryptedPrivateKey: encrypted,
      iv,
      tag,
    });
    this.save();
  }

  getKey(name: string): string {
    this.ensureUnlocked();
    const key = this.data!.keys.find((k) => k.name === name);
    if (!key) throw new Error(`Key "${name}" not found`);
    return this.decrypt(key.encryptedPrivateKey, key.iv, key.tag);
  }

  removeKey(name: string): void {
    this.ensureUnlocked();
    this.data!.keys = this.data!.keys.filter((k) => k.name !== name);
    this.save();
  }

  private ensureUnlocked(): void {
    if (!this.derivedKey || !this.data) throw new Error('Keychain is locked');
  }

  private encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.derivedKey!, iv);
    let enc = cipher.update(plaintext, 'utf-8', 'base64');
    enc += cipher.final('base64');
    return {
      encrypted: enc,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.derivedKey!,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    let dec = decipher.update(encrypted, 'base64', 'utf-8');
    dec += decipher.final('utf-8');
    return dec;
  }

  private save(): void {
    fs.mkdirSync(this.base, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd ~/explorer-tui && npx tsc && node --test dist/lib/wallet/keychain.test.js
```

**Step 5: Commit**

```bash
git add src/lib/wallet/
git commit -m "feat: add AES-256-GCM encrypted keychain"
```

---

### Task 8: LLM Tool Definitions (Adapted)

**Files:**
- Create: `~/explorer-tui/src/lib/llm/tools.ts`
- Create: `~/explorer-tui/src/lib/llm/system.ts`

**Step 1: Copy and adapt tools.ts**

Copy `/Users/sachitdabas/explorer/lib/llm/tools.ts` to `~/explorer-tui/src/lib/llm/tools.ts`.

Changes needed:
1. Replace `@/lib/antelope/client` → `../antelope/client.js`
2. Replace `@/lib/antelope/hyperion` → `../antelope/hyperion.js`
3. Replace `@/lib/contracts` → `../contracts/index.js`
4. In the `build_transaction` tool execute function, add the wallet account to the authorization field so the TUI can sign it:

```typescript
// Change the build_transaction execute to include authorization
execute: async ({ actions, description }) => {
  return {
    type: "transaction_proposal" as const,
    description,
    actions: actions.map((a) => ({
      ...a,
      authorization: a.authorization || [{ actor: '', permission: 'active' }],
    })),
    status: "pending_signature" as const,
  };
},
```

**Step 2: Create system.ts with TUI-adapted system prompt**

```typescript
export function buildSystemPrompt(opts: {
  chainEndpoint: string | null;
  hyperionEndpoint: string | null;
  walletAccount: string | null;
  chainName: string | null;
  availableGuides: string[];
}): string {
  const guidesListStr = opts.availableGuides.length > 0
    ? `\n\nAvailable contract guides (call get_contract_guide to use): ${opts.availableGuides.join(', ')}`
    : '';

  return `You are an Antelope blockchain explorer assistant running in a terminal (TUI). You help users understand and interact with Antelope-based blockchains (EOS, WAX, Telos, etc.).

You have access to tools that let you query on-chain data in real-time. Use them to answer questions about accounts, transactions, blocks, smart contracts, and token balances.

When a user wants to perform an action on the blockchain (transfer tokens, stake resources, buy RAM, vote for producers, etc.), use the build_transaction tool to create a transaction proposal. The user will review and sign it with their local keychain.

Guidelines:
- Always use tools to fetch real data rather than making assumptions
- After ALL tool calls are complete, write a short text summary explaining the results
- Before querying contract-specific data or building transactions, ALWAYS call get_contract_guide first
- When no contract guide is available, call get_abi to check the action's parameters before building the transaction
- When the guide contains FOLLOW-UP instructions, follow them
- Be concise but informative — terminal users prefer compact output
- Format data for terminal readability: use plain text, avoid HTML/markdown links
- Wrap account names and transaction IDs in backticks

${opts.chainEndpoint ? "Connected chain: " + (opts.chainName || opts.chainEndpoint) : "No chain connected."}
${opts.hyperionEndpoint ? "Hyperion history API is available." : "Hyperion not available — history queries are limited."}
${opts.walletAccount ? `User's wallet account: ${opts.walletAccount}` : "No wallet connected."}${guidesListStr}`;
}
```

**Step 3: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 4: Commit**

```bash
git add src/lib/llm/
git commit -m "feat: add LLM tool definitions and system prompt for TUI"
```

---

### Task 9: LLM Provider Setup

**Files:**
- Create: `~/explorer-tui/src/lib/llm/provider.ts`

**Step 1: Implement provider.ts**

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModelV1 } from 'ai';

export type LLMProvider = 'anthropic' | 'openai' | 'google';

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
};

export function createLLM(
  provider: LLMProvider,
  apiKey: string,
  model?: string | null,
): LanguageModelV1 {
  const modelId = model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/lib/llm/provider.ts
git commit -m "feat: add multi-provider LLM setup (Anthropic, OpenAI, Google)"
```

---

### Task 10: Terminal Formatters

**Files:**
- Create: `~/explorer-tui/src/utils/format.ts`

**Step 1: Implement format.ts**

```typescript
export function progressBar(used: number, total: number, width = 20): string {
  if (total === 0) return '░'.repeat(width) + '  0%';
  const pct = Math.min(used / total, 1);
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `${bar} ${Math.round(pct * 100)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMicroseconds(us: number): string {
  if (us < 1000) return `${us} μs`;
  return `${(us / 1000).toFixed(1)} ms`;
}

export function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

export function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/utils/
git commit -m "feat: add terminal formatters (progress bars, bytes, time)"
```

---

### Task 11: StatusBar Component

**Files:**
- Create: `~/explorer-tui/src/components/StatusBar.tsx`

**Step 1: Implement StatusBar**

```tsx
import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  chainName: string | null;
  walletAccount: string | null;
  mode: string;
}

export function StatusBar({ chainName, walletAccount, mode }: StatusBarProps) {
  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">explorer</Text>
      <Text> │ </Text>
      <Text color={chainName ? 'green' : 'red'}>
        {chainName || 'not connected'}
      </Text>
      {walletAccount && (
        <>
          <Text> │ </Text>
          <Text color="yellow">{walletAccount}</Text>
        </>
      )}
      <Box flexGrow={1} />
      <Text dimColor>[{mode}]</Text>
    </Box>
  );
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/components/StatusBar.tsx
git commit -m "feat: add StatusBar component showing chain and wallet"
```

---

### Task 12: ToolCard Component

**Files:**
- Create: `~/explorer-tui/src/components/ToolCard.tsx`

**Step 1: Implement ToolCard**

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { progressBar, formatBytes, formatMicroseconds } from '../utils/format.js';

interface ToolCardProps {
  toolName: string;
  result: Record<string, unknown>;
}

export function ToolCard({ toolName, result }: ToolCardProps) {
  if (result.error) {
    return (
      <Box borderStyle="single" borderColor="red" flexDirection="column" paddingX={1}>
        <Text color="red" bold>✗ {toolName}</Text>
        <Text color="red">{String(result.error)}</Text>
      </Box>
    );
  }

  // Special rendering for known tool types
  if (toolName === 'get_account') return <AccountCard result={result} />;
  if (toolName === 'build_transaction') return <TransactionCard result={result} />;

  // Generic: render as key-value pairs
  return (
    <Box borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
      <Text color="green" bold>─ {toolName}</Text>
      {renderObject(result, 0)}
    </Box>
  );
}

function AccountCard({ result }: { result: Record<string, unknown> }) {
  const ram = result.ram as { used: number; quota: number } | undefined;
  const cpu = result.cpu as { used: number; max: number } | undefined;
  const net = result.net as { used: number; max: number } | undefined;

  return (
    <Box borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
      <Text color="green" bold>─ get_account</Text>
      <Text>Account: <Text bold>{String(result.account_name)}</Text></Text>
      <Text>Balance: <Text bold color="yellow">{String(result.balance)}</Text></Text>
      {ram && <Text>RAM:  {progressBar(ram.used, ram.quota)}  ({formatBytes(ram.used)}/{formatBytes(ram.quota)})</Text>}
      {cpu && <Text>CPU:  {progressBar(cpu.used, cpu.max)}  ({formatMicroseconds(cpu.used)}/{formatMicroseconds(cpu.max)})</Text>}
      {net && <Text>NET:  {progressBar(net.used, net.max)}  ({formatBytes(net.used)}/{formatBytes(net.max)})</Text>}
    </Box>
  );
}

function TransactionCard({ result }: { result: Record<string, unknown> }) {
  const actions = result.actions as Array<{ account: string; name: string; data: unknown }> | undefined;
  return (
    <Box borderStyle="single" borderColor="magenta" flexDirection="column" paddingX={1}>
      <Text color="magenta" bold>─ Transaction Proposal</Text>
      <Text>{String(result.description)}</Text>
      {actions?.map((a, i) => (
        <Text key={i} dimColor>  [{i + 1}] {a.account}::{a.name}</Text>
      ))}
      <Text color="yellow">Sign with /sign or reject with /reject</Text>
    </Box>
  );
}

function renderObject(obj: unknown, depth: number): React.ReactNode {
  if (depth > 3) return <Text dimColor>[nested]</Text>;
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map((item, i) => (
      <Box key={i} paddingLeft={2}>
        <Text dimColor>[{i}] </Text>
        {typeof item === 'object' && item !== null ? renderObject(item, depth + 1) : <Text>{String(item)}</Text>}
      </Box>
    ));
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj).map(([key, val]) => (
      <Box key={key} paddingLeft={depth > 0 ? 2 : 0}>
        <Text color="cyan">{key}: </Text>
        {typeof val === 'object' && val !== null
          ? renderObject(val, depth + 1)
          : <Text>{String(val)}</Text>}
      </Box>
    ));
  }
  return <Text>{String(obj)}</Text>;
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/components/ToolCard.tsx
git commit -m "feat: add ToolCard component with account/tx special rendering"
```

---

### Task 13: ChatInput Component

**Files:**
- Create: `~/explorer-tui/src/components/ChatInput.tsx`

**Step 1: Implement ChatInput**

```tsx
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <Box borderStyle="single" borderColor="white" paddingX={1}>
      <Text color="cyan" bold>{'> '}</Text>
      {disabled ? (
        <Text dimColor>thinking...</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder || 'Ask about the blockchain or type /help'}
        />
      )}
    </Box>
  );
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/components/ChatInput.tsx
git commit -m "feat: add ChatInput component with text input"
```

---

### Task 14: Command Parser

**Files:**
- Create: `~/explorer-tui/src/lib/commands.ts`

**Step 1: Implement command parser**

```typescript
export interface Command {
  name: string;
  args: string[];
  raw: string;
}

export function parseCommand(input: string): Command | null {
  if (!input.startsWith('/')) return null;
  const parts = input.slice(1).split(/\s+/);
  const name = parts[0]?.toLowerCase();
  if (!name) return null;
  return { name, args: parts.slice(1), raw: input };
}

export const COMMANDS: Record<string, string> = {
  chain: 'Switch chain (interactive picker)',
  account: 'Look up an account — /account <name>',
  table: 'Query table rows — /table <code> <table> [scope]',
  block: 'Look up a block — /block <number>',
  tx: 'Look up a transaction — /tx <id>',
  wallet: 'Manage encrypted keychain',
  bookmarks: 'View saved bookmarks',
  bookmark: 'Save last tool result',
  config: 'Edit settings (LLM provider, API key)',
  history: 'List past conversations',
  clear: 'Clear chat',
  sign: 'Sign pending transaction',
  reject: 'Reject pending transaction',
  help: 'Show available commands',
};
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/lib/commands.ts
git commit -m "feat: add command parser with help text"
```

---

### Task 15: ChainSelector Component

**Files:**
- Create: `~/explorer-tui/src/components/ChainSelector.tsx`

**Step 1: Implement ChainSelector**

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { PRESET_CHAINS } from '../lib/antelope/chains.js';

interface ChainSelectorProps {
  onSelect: (chain: { name: string; url: string; hyperion: string }) => void;
  onCancel: () => void;
}

export function ChainSelector({ onSelect, onCancel }: ChainSelectorProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(PRESET_CHAINS.length - 1, s + 1));
    if (key.return) onSelect(PRESET_CHAINS[selected]);
    if (key.escape || input === 'q') onCancel();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">Select a chain (↑/↓ + Enter):</Text>
      <Text> </Text>
      {PRESET_CHAINS.map((chain, i) => (
        <Box key={chain.name}>
          <Text color={i === selected ? 'green' : undefined}>
            {i === selected ? '▸ ' : '  '}
            {chain.name}
          </Text>
          <Text dimColor> {chain.url}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text dimColor>Press Esc to cancel</Text>
    </Box>
  );
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/components/ChainSelector.tsx
git commit -m "feat: add ChainSelector component with arrow key navigation"
```

---

### Task 16: Chat Component (Core AI Chat View)

**Files:**
- Create: `~/explorer-tui/src/components/Chat.tsx`

This is the most complex component. It handles LLM streaming, tool call rendering, and message display.

**Step 1: Implement Chat.tsx**

```tsx
import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { streamText } from 'ai';
import type { LanguageModelV1 } from 'ai';
import type { ToolSet } from 'ai';
import { ToolCard } from './ToolCard.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: Array<{ toolName: string; result: Record<string, unknown> }>;
}

interface ChatProps {
  model: LanguageModelV1;
  tools: ToolSet;
  systemPrompt: string;
  onToolResult?: (toolName: string, result: Record<string, unknown>) => void;
}

export function Chat({ model, tools, systemPrompt, onToolResult }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreaming('');

    try {
      const coreMessages = [...messages, userMsg].map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const result = streamText({
        model,
        system: systemPrompt,
        messages: coreMessages,
        tools,
        maxSteps: 5,
      });

      let fullText = '';
      const toolResults: ChatMessage['toolResults'] = [];

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.textDelta;
          setStreaming(fullText);
        } else if (part.type === 'tool-result') {
          const tr = { toolName: part.toolName, result: part.result as Record<string, unknown> };
          toolResults.push(tr);
          onToolResult?.(part.toolName, part.result as Record<string, unknown>);
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: fullText, toolResults },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      ]);
    } finally {
      setIsLoading(false);
      setStreaming('');
    }
  }, [messages, model, tools, systemPrompt, onToolResult]);

  return { messages, streaming, isLoading, sendMessage };
}

// Presentational component for rendering message list
export function ChatMessages({ messages, streaming }: {
  messages: ChatMessage[];
  streaming: string;
}) {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          {msg.role === 'user' ? (
            <Text><Text color="cyan" bold>You: </Text>{msg.content}</Text>
          ) : (
            <>
              {msg.toolResults?.map((tr, j) => (
                <ToolCard key={j} toolName={tr.toolName} result={tr.result} />
              ))}
              {msg.content && <Text>{msg.content}</Text>}
            </>
          )}
        </Box>
      ))}
      {streaming && (
        <Box flexDirection="column">
          <Text>{streaming}</Text>
          <Text dimColor>...</Text>
        </Box>
      )}
    </Box>
  );
}
```

**Step 2: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 3: Commit**

```bash
git add src/components/Chat.tsx
git commit -m "feat: add Chat component with LLM streaming and tool calls"
```

---

### Task 17: Main App Component

**Files:**
- Modify: `~/explorer-tui/src/app.tsx` (create)
- Modify: `~/explorer-tui/src/index.tsx`

**Step 1: Implement app.tsx**

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { ChatInput } from './components/ChatInput.js';
import { ChatMessages, Chat } from './components/Chat.js';
import { ChainSelector } from './components/ChainSelector.js';
import { ToolCard } from './components/ToolCard.js';
import { parseCommand, COMMANDS } from './lib/commands.js';
import { loadConfig, saveConfig, getDataDir, type Config } from './lib/store/config.js';
import { addBookmark, loadBookmarks } from './lib/store/bookmarks.js';
import { AntelopeClient } from './lib/antelope/client.js';
import { HyperionClient } from './lib/antelope/hyperion.js';
import { createChainTools } from './lib/llm/tools.js';
import { buildSystemPrompt } from './lib/llm/system.js';
import { createLLM } from './lib/llm/provider.js';
import { listAvailableGuides } from './lib/contracts/index.js';

type Mode = 'chat' | 'chain-select' | 'help' | 'bookmarks';

export function App() {
  const { exit } = useApp();
  const [config, setConfig] = useState<Config>(() => loadConfig());
  const [mode, setMode] = useState<Mode>(config.chainEndpoint ? 'chat' : 'chain-select');
  const [lastToolResult, setLastToolResult] = useState<{ toolName: string; result: Record<string, unknown> } | null>(null);
  const [directResults, setDirectResults] = useState<Array<{ toolName: string; result: Record<string, unknown> }>>([]);

  const dataDir = getDataDir();
  const hasApiKey = Boolean(config.llmApiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);

  // Resolve API key from config or env
  const apiKey = config.llmApiKey
    || process.env.ANTHROPIC_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || '';

  const model = hasApiKey ? createLLM(config.llmProvider, apiKey, config.llmModel) : null;
  const tools = createChainTools(config.chainEndpoint, config.hyperionEndpoint, config.chainName);
  const guides = listAvailableGuides(config.chainName || undefined).map((g) => g.contract);
  const systemPrompt = buildSystemPrompt({
    chainEndpoint: config.chainEndpoint,
    hyperionEndpoint: config.hyperionEndpoint,
    walletAccount: config.walletAccount,
    chainName: config.chainName,
    availableGuides: guides,
  });

  // Chat hook
  const chat = model ? Chat({ model, tools, systemPrompt, onToolResult: (name, result) => setLastToolResult({ toolName: name, result }) }) : null;

  const handleChainSelect = useCallback(async (chain: { name: string; url: string; hyperion: string }) => {
    const newConfig = { ...config, chainEndpoint: chain.url, chainName: chain.name, hyperionEndpoint: chain.hyperion };
    setConfig(newConfig);
    saveConfig(newConfig);
    setMode('chat');
  }, [config]);

  const handleCommand = useCallback(async (input: string) => {
    const cmd = parseCommand(input);
    if (!cmd) {
      // Regular chat message
      if (chat) {
        await chat.sendMessage(input);
      } else {
        setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: 'No LLM API key configured. Run /config to set one, or set ANTHROPIC_API_KEY env var.' } }]);
      }
      return;
    }

    switch (cmd.name) {
      case 'chain':
        setMode('chain-select');
        break;

      case 'account': {
        if (!cmd.args[0]) {
          setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: 'Usage: /account <name>' } }]);
          break;
        }
        if (!config.chainEndpoint) {
          setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: 'No chain connected. Run /chain first.' } }]);
          break;
        }
        const client = new AntelopeClient(config.chainEndpoint);
        try {
          const account = await client.getAccount(cmd.args[0]);
          const result = {
            account_name: account.account_name,
            balance: account.core_liquid_balance || '0',
            ram: { used: account.ram_usage, quota: account.ram_quota },
            cpu: account.cpu_limit,
            net: account.net_limit,
          };
          setDirectResults((prev) => [...prev, { toolName: 'get_account', result }]);
          setLastToolResult({ toolName: 'get_account', result });
        } catch (e) {
          setDirectResults((prev) => [...prev, { toolName: 'get_account', result: { error: e instanceof Error ? e.message : 'Failed' } }]);
        }
        break;
      }

      case 'block': {
        if (!cmd.args[0] || !config.chainEndpoint) {
          setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: !config.chainEndpoint ? 'No chain connected.' : 'Usage: /block <number>' } }]);
          break;
        }
        const client = new AntelopeClient(config.chainEndpoint);
        try {
          const block = await client.getBlock(Number(cmd.args[0]));
          setDirectResults((prev) => [...prev, { toolName: 'get_block', result: block }]);
        } catch (e) {
          setDirectResults((prev) => [...prev, { toolName: 'get_block', result: { error: e instanceof Error ? e.message : 'Failed' } }]);
        }
        break;
      }

      case 'table': {
        if (cmd.args.length < 2 || !config.chainEndpoint) {
          setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: 'Usage: /table <code> <table> [scope]' } }]);
          break;
        }
        const client = new AntelopeClient(config.chainEndpoint);
        try {
          const result = await client.getTableRows({
            code: cmd.args[0],
            table: cmd.args[1],
            scope: cmd.args[2] || cmd.args[0],
          });
          setDirectResults((prev) => [...prev, { toolName: 'get_table_rows', result }]);
        } catch (e) {
          setDirectResults((prev) => [...prev, { toolName: 'get_table_rows', result: { error: e instanceof Error ? e.message : 'Failed' } }]);
        }
        break;
      }

      case 'tx': {
        if (!cmd.args[0] || !config.chainEndpoint) {
          setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: 'Usage: /tx <id>' } }]);
          break;
        }
        // Try Hyperion first, fall back to RPC
        if (config.hyperionEndpoint) {
          const hyperion = new HyperionClient(config.hyperionEndpoint);
          try {
            const result = await hyperion.getTransaction(cmd.args[0]);
            setDirectResults((prev) => [...prev, { toolName: 'get_transaction', result }]);
            break;
          } catch { /* fall through to RPC */ }
        }
        const client = new AntelopeClient(config.chainEndpoint);
        try {
          const result = await client.getTransaction(cmd.args[0]);
          setDirectResults((prev) => [...prev, { toolName: 'get_transaction', result }]);
        } catch (e) {
          setDirectResults((prev) => [...prev, { toolName: 'get_transaction', result: { error: e instanceof Error ? e.message : 'Failed' } }]);
        }
        break;
      }

      case 'bookmark':
        if (lastToolResult) {
          addBookmark({
            toolName: lastToolResult.toolName,
            label: `${lastToolResult.toolName} result`,
            result: lastToolResult.result,
            chainName: config.chainName || 'unknown',
          }, dataDir);
          setDirectResults((prev) => [...prev, { toolName: 'info', result: { message: 'Bookmarked!' } }]);
        } else {
          setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: 'No recent tool result to bookmark.' } }]);
        }
        break;

      case 'bookmarks': {
        const bms = loadBookmarks(dataDir);
        if (bms.length === 0) {
          setDirectResults((prev) => [...prev, { toolName: 'info', result: { message: 'No bookmarks saved.' } }]);
        } else {
          setMode('bookmarks');
        }
        break;
      }

      case 'config': {
        // Simple inline config display/set
        if (cmd.args.length === 0) {
          setDirectResults((prev) => [...prev, {
            toolName: 'config',
            result: {
              llmProvider: config.llmProvider,
              llmModel: config.llmModel || 'default',
              llmApiKey: config.llmApiKey ? '***' + config.llmApiKey.slice(-4) : 'not set',
              chainEndpoint: config.chainEndpoint || 'not set',
            },
          }]);
        }
        // /config provider <name>
        if (cmd.args[0] === 'provider' && cmd.args[1]) {
          const provider = cmd.args[1] as Config['llmProvider'];
          const newConfig = { ...config, llmProvider: provider };
          setConfig(newConfig);
          saveConfig(newConfig);
          setDirectResults((prev) => [...prev, { toolName: 'info', result: { message: `LLM provider set to ${provider}` } }]);
        }
        // /config key <apikey>
        if (cmd.args[0] === 'key' && cmd.args[1]) {
          const newConfig = { ...config, llmApiKey: cmd.args[1] };
          setConfig(newConfig);
          saveConfig(newConfig);
          setDirectResults((prev) => [...prev, { toolName: 'info', result: { message: 'API key saved' } }]);
        }
        break;
      }

      case 'clear':
        setDirectResults([]);
        break;

      case 'help':
        setMode('help');
        break;

      case 'quit':
      case 'exit':
        exit();
        break;

      default:
        setDirectResults((prev) => [...prev, { toolName: 'error', result: { error: `Unknown command: /${cmd.name}. Type /help for available commands.` } }]);
    }
  }, [chat, config, dataDir, lastToolResult, exit]);

  // Render based on mode
  if (mode === 'chain-select') {
    return (
      <Box flexDirection="column">
        <StatusBar chainName={config.chainName} walletAccount={config.walletAccount} mode="chain" />
        <ChainSelector
          onSelect={handleChainSelect}
          onCancel={() => config.chainEndpoint ? setMode('chat') : undefined}
        />
      </Box>
    );
  }

  if (mode === 'help') {
    return (
      <Box flexDirection="column">
        <StatusBar chainName={config.chainName} walletAccount={config.walletAccount} mode="help" />
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Text bold color="cyan">Available Commands</Text>
          <Text> </Text>
          {Object.entries(COMMANDS).map(([name, desc]) => (
            <Box key={name}>
              <Text color="green">{'  /'}{name.padEnd(12)}</Text>
              <Text dimColor>{desc}</Text>
            </Box>
          ))}
          <Text> </Text>
          <Text dimColor>Type anything else to chat with the AI assistant.</Text>
          <Text dimColor>Press any key to return to chat...</Text>
        </Box>
        <ChatInput onSubmit={() => setMode('chat')} placeholder="Press Enter to return..." />
      </Box>
    );
  }

  if (mode === 'bookmarks') {
    const bms = loadBookmarks(dataDir);
    return (
      <Box flexDirection="column">
        <StatusBar chainName={config.chainName} walletAccount={config.walletAccount} mode="bookmarks" />
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">Bookmarks ({bms.length})</Text>
          {bms.map((bm) => (
            <ToolCard key={bm.id} toolName={bm.toolName} result={bm.result} />
          ))}
        </Box>
        <ChatInput onSubmit={() => setMode('chat')} placeholder="Press Enter to return..." />
      </Box>
    );
  }

  // Chat mode (default)
  return (
    <Box flexDirection="column">
      <StatusBar chainName={config.chainName} walletAccount={config.walletAccount} mode="chat" />
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {/* Direct command results */}
        {directResults.map((r, i) => (
          <ToolCard key={`dr-${i}`} toolName={r.toolName} result={r.result} />
        ))}
        {/* AI chat messages */}
        {chat && <ChatMessages messages={chat.messages} streaming={chat.streaming} />}
      </Box>
      <ChatInput
        onSubmit={handleCommand}
        disabled={chat?.isLoading}
        placeholder={config.chainEndpoint ? 'Ask about the blockchain or type /help' : 'Type /chain to connect first'}
      />
    </Box>
  );
}
```

**Step 2: Update index.tsx**

```tsx
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

render(<App />);
```

**Step 3: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 4: Commit**

```bash
git add src/app.tsx src/index.tsx
git commit -m "feat: add main App component with chat, commands, and mode routing"
```

---

### Task 18: End-to-End Smoke Test

**Step 1: Build and run**

```bash
cd ~/explorer-tui
npm run build
node dist/index.js
```

Expected: App renders with chain selector (since no chain configured yet).

**Step 2: Test chain selection**

Use arrow keys to select "EOS Mainnet" and press Enter. Expected: status bar shows "EOS Mainnet", mode switches to chat.

**Step 3: Test direct commands**

Type `/account eosio.token` and press Enter. Expected: account card renders with balance and resource bars.

Type `/help` and press Enter. Expected: help screen shows all commands.

**Step 4: Test AI chat (requires API key)**

Set API key:
```bash
ANTHROPIC_API_KEY=<key> node dist/index.js
```

Type "What's the balance of eosio.token?" and press Enter. Expected: LLM streams response with tool call card.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```

---

### Task 19: Make it installable

**Step 1: Add bin field and make executable**

```bash
chmod +x ~/explorer-tui/bin/explorer.js
```

**Step 2: Link globally for testing**

```bash
cd ~/explorer-tui && npm link
```

Now `explorer` command should work from anywhere.

**Step 3: Commit**

```bash
git add bin/
git commit -m "feat: make explorer command globally linkable"
```

---

### Task 20: Wallet Manager Component (Phase 2)

**Files:**
- Create: `~/explorer-tui/src/components/WalletManager.tsx`

**Step 1: Implement WalletManager**

This component handles `/wallet` command: import keys, list keys, remove keys, unlock keychain.

```tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Keychain } from '../lib/wallet/keychain.js';
import { getDataDir } from '../lib/store/config.js';

interface WalletManagerProps {
  onBack: () => void;
}

type WalletMode = 'menu' | 'unlock' | 'import-name' | 'import-key';

export function WalletManager({ onBack }: WalletManagerProps) {
  const [keychain] = useState(() => new Keychain(getDataDir()));
  const [mode, setMode] = useState<WalletMode>(keychain.isUnlocked ? 'menu' : 'unlock');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importName, setImportName] = useState('');
  const [importKey, setImportKey] = useState('');
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const menuItems = ['List keys', 'Import key', 'Remove key', 'Back'];

  useInput((input, key) => {
    if (mode === 'menu') {
      if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
      if (key.downArrow) setSelected((s) => Math.min(menuItems.length - 1, s + 1));
      if (key.return) {
        if (selected === 0) {
          const keys = keychain.listKeys();
          setMessage(keys.length === 0 ? 'No keys stored.' : keys.map((k) => `  • ${k.name}`).join('\n'));
        }
        if (selected === 1) setMode('import-name');
        if (selected === 3) onBack();
      }
      if (key.escape) onBack();
    }
  });

  if (mode === 'unlock') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Unlock Keychain</Text>
        {error && <Text color="red">{error}</Text>}
        <Box>
          <Text>Password: </Text>
          <TextInput
            value={password}
            onChange={setPassword}
            mask="*"
            onSubmit={(pw) => {
              try {
                keychain.unlock(pw);
                setMode('menu');
                setError(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to unlock');
              }
              setPassword('');
            }}
          />
        </Box>
      </Box>
    );
  }

  if (mode === 'import-name') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Key name:</Text>
        <TextInput
          value={importName}
          onChange={setImportName}
          onSubmit={() => setMode('import-key')}
        />
      </Box>
    );
  }

  if (mode === 'import-key') {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>Private key for "{importName}":</Text>
        <TextInput
          value={importKey}
          onChange={setImportKey}
          mask="*"
          onSubmit={(pk) => {
            try {
              keychain.importKey(importName, pk);
              setMessage(`Key "${importName}" imported.`);
              setMode('menu');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed');
              setMode('menu');
            }
            setImportName('');
            setImportKey('');
          }}
        />
      </Box>
    );
  }

  // Menu
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">Wallet Manager</Text>
      {error && <Text color="red">{error}</Text>}
      {message && <Text color="green">{message}</Text>}
      <Text> </Text>
      {menuItems.map((item, i) => (
        <Text key={item} color={i === selected ? 'green' : undefined}>
          {i === selected ? '▸ ' : '  '}{item}
        </Text>
      ))}
    </Box>
  );
}
```

**Step 2: Wire into App — add 'wallet' mode and `/wallet` command handler**

In `app.tsx`, add `'wallet'` to the `Mode` type and add a case for mode === 'wallet' that renders `<WalletManager onBack={() => setMode('chat')} />`. Add `/wallet` command to the switch in `handleCommand`.

**Step 3: Verify build**

```bash
cd ~/explorer-tui && npx tsc
```

**Step 4: Commit**

```bash
git add src/components/WalletManager.tsx src/app.tsx
git commit -m "feat: add wallet manager with encrypted keychain UI"
```

---

### Task 21: Transaction Signing

**Files:**
- Create: `~/explorer-tui/src/lib/wallet/signer.ts`

**Step 1: Implement signer.ts**

This is a placeholder that serializes and pushes transactions using the Antelope RPC. Full Antelope transaction signing requires the `@greymass/eosio` library for serialization. For v1, we'll implement the structure and add the actual signing in a follow-up.

```typescript
import { AntelopeClient } from '../antelope/client.js';
import { Keychain } from './keychain.js';

export interface TransactionAction {
  account: string;
  name: string;
  data: Record<string, unknown>;
  authorization?: Array<{ actor: string; permission: string }>;
}

export interface SignResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export async function signAndPush(
  actions: TransactionAction[],
  walletAccount: string,
  keyName: string,
  keychain: Keychain,
  endpoint: string,
): Promise<SignResult> {
  // TODO: Implement full Antelope transaction signing
  // This requires:
  // 1. Get chain info (chain_id, ref block)
  // 2. Serialize transaction using ABI
  // 3. Sign with private key from keychain
  // 4. Push signed transaction to chain
  //
  // For now, return the unsigned transaction as a preview
  return {
    success: false,
    error: 'Transaction signing not yet implemented. Actions: ' +
      actions.map((a) => `${a.account}::${a.name}`).join(', '),
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/wallet/signer.ts
git commit -m "feat: add transaction signer scaffold (signing TODO)"
```

---

### Task 22: Final Polish and README

**Step 1: Verify full build from clean state**

```bash
cd ~/explorer-tui
rm -rf dist node_modules
npm install
npm run build
node dist/index.js
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "chore: final build verification"
```

---

## Execution Order Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Scaffold project | — |
| 2 | Antelope clients + chains | 1 |
| 3 | Contract guides | 1 |
| 4 | Config store | 1 |
| 5 | Bookmark store | 1 |
| 6 | Conversation store | 1 |
| 7 | Encrypted keychain | 1 |
| 8 | LLM tools + system prompt | 2, 3 |
| 9 | LLM provider setup | 1 |
| 10 | Terminal formatters | 1 |
| 11 | StatusBar component | 1 |
| 12 | ToolCard component | 10 |
| 13 | ChatInput component | 1 |
| 14 | Command parser | 1 |
| 15 | ChainSelector component | 2 |
| 16 | Chat component | 8, 9 |
| 17 | Main App (wires everything) | 11-16 |
| 18 | Smoke test | 17 |
| 19 | Make installable | 18 |
| 20 | Wallet manager UI | 7, 17 |
| 21 | Transaction signing | 7, 2 |
| 22 | Final polish | All |

Tasks 2-7 and 9-10 can be parallelized. Tasks 11-15 can be parallelized.
