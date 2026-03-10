# Sidebar Universal Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a universal search input to the sidebar that auto-detects account names, transaction IDs, and block numbers, then opens results directly in the right panel.

**Architecture:** One new component (`SidebarSearch`) placed in `left-panel.tsx` below Chain Info. Uses existing `lookup.ts` fetch helpers and `context-store` to open results. No new API routes or stores needed.

**Tech Stack:** React, Tailwind CSS, shadcn/ui, existing lookup utilities

---

### Task 1: Add `isBlockNum` helper to lookup.ts

**Files:**
- Modify: `lib/antelope/lookup.ts:1-12`

**Step 1: Add the helper**

Add after the existing `isTxId` function (line 12):

```typescript
export function isBlockNum(text: string): boolean {
  return /^\d+$/.test(text) && text.length > 0
}
```

**Step 2: Commit**

```bash
git add lib/antelope/lookup.ts
git commit -m "feat: add isBlockNum helper to lookup utils"
```

---

### Task 2: Create SidebarSearch component

**Files:**
- Create: `components/layout/sidebar-search.tsx`

**Step 1: Create the component**

```tsx
"use client"

import { useState, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { isAccountName, isTxId, isBlockNum, fetchAccountData, fetchBlockData, fetchTxData } from "@/lib/antelope/lookup"

type DetectedType = "Account" | "Transaction" | "Block" | null

function detectType(input: string): DetectedType {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null
  if (isTxId(trimmed)) return "Transaction"
  if (/^\d+$/.test(trimmed)) return "Block"
  if (isAccountName(trimmed)) return "Account"
  return null
}

export function SidebarSearch() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { endpoint, hyperionEndpoint } = useChain()
  const { setContext } = useDetailContext()

  const detected = detectType(query)

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed || !detected || !endpoint) return

    setLoading(true)
    setError("")

    try {
      if (detected === "Account") {
        const data = await fetchAccountData(trimmed, endpoint)
        setContext("account", data)
      } else if (detected === "Block") {
        const data = await fetchBlockData(trimmed, endpoint)
        setContext("block", data)
      } else if (detected === "Transaction") {
        const data = await fetchTxData(trimmed, endpoint, hyperionEndpoint)
        setContext("transaction", data)
      }
      setQuery("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed")
    } finally {
      setLoading(false)
    }
  }, [query, detected, endpoint, hyperionEndpoint, setContext])

  return (
    <div className="space-y-1">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError("") }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
          placeholder="Search account, tx, block..."
          className="w-full text-xs bg-background border border-border rounded-md pl-2 pr-16 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          disabled={!endpoint || loading}
        />
        <div className="absolute right-1 flex items-center gap-1">
          {detected && !loading && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-normal">
              {detected}
            </Badge>
          )}
          <button
            onClick={handleSubmit}
            disabled={!detected || loading || !endpoint}
            className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors cursor-pointer"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/layout/sidebar-search.tsx
git commit -m "feat: create SidebarSearch component with auto-detect type badge"
```

---

### Task 3: Add SidebarSearch to LeftPanel

**Files:**
- Modify: `components/layout/left-panel.tsx`

**Step 1: Import the component**

Add import at top of file (after existing imports around line 13):

```typescript
import { SidebarSearch } from "@/components/layout/sidebar-search"
```

**Step 2: Insert below Chain Info section**

In the JSX, insert `<SidebarSearch />` between the Chain Info `<Separator />` (line 153) and the View Toggle button (line 156). The result should look like:

```tsx
        <Separator />

        {/* Search */}
        <SidebarSearch />

        <Separator />

        {/* View Toggle — show only the other view */}
```

**Step 3: Verify visually**

Run: `npm run dev` (or whatever dev command)
Expected: Search input visible in sidebar below chain info, above the Chat/Dashboard toggle. Typing an account name shows "Account" badge, typing 64-char hex shows "Transaction", typing a number shows "Block". Submitting opens the result in the right panel.

**Step 4: Commit**

```bash
git add components/layout/left-panel.tsx
git commit -m "feat: add universal search to sidebar below chain info"
```

---

### Task 4: Manual verification

**Step 1: Test account lookup**
Type `eosio` → badge shows "Account" → press Enter → account opens in right panel, appears in recents

**Step 2: Test block lookup**
Type `100` → badge shows "Block" → press Enter → block opens in right panel

**Step 3: Test transaction lookup**
Paste a 64-char hex tx ID → badge shows "Transaction" → press Enter → tx opens in right panel

**Step 4: Test error handling**
Type `zzzzzzzzzzzz` (invalid account) → press Enter → error message appears below input

**Step 5: Test no-endpoint state**
Disconnect chain → input should be disabled
