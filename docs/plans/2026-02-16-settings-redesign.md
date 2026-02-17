# Settings Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the settings dialog into a tabbed layout (Chain / AI) and add a persistent model badge to the header.

**Architecture:** Replace the stacked sections in the settings dialog with shadcn Tabs component. Add a `getModelLabel()` helper to the LLM store. Add a clickable model badge chip in the header that opens the same settings dialog.

**Tech Stack:** React 19, shadcn/ui Tabs, Tailwind CSS 4, existing stores (llm-store, chain-store, auth-store, credits-store)

---

### Task 1: Add `getModelLabel` helper to LLM store

**Files:**
- Modify: `lib/stores/llm-store.tsx`

**Step 1: Export a `getModelLabel` function**

Add a new exported helper function below `CHUTES_MODEL_LABELS` that returns a short display name for any model string:

```typescript
export function getModelLabel(model: string): string {
  if (CHUTES_MODEL_LABELS[model]) return CHUTES_MODEL_LABELS[model]
  // Strip org prefix for models like "deepseek-ai/DeepSeek-V3"
  const parts = model.split("/")
  return parts[parts.length - 1]
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add lib/stores/llm-store.tsx
git commit -m "feat: add getModelLabel helper to LLM store"
```

---

### Task 2: Convert settings dialog to tabbed layout

**Files:**
- Modify: `components/layout/header.tsx`

**Step 1: Add Tabs imports**

Add to the imports in `header.tsx`:

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
```

Also import `Link2, Link2Off` from lucide-react (for chain tab icon), and `Bot` (for AI tab icon).

**Step 2: Replace dialog content**

Replace the current `<div className="overflow-y-auto px-6 pb-6 space-y-6">` section (lines 89-108) with a tabbed layout:

```tsx
<Tabs defaultValue="chain" className="px-6 pb-6">
  <TabsList className="w-full">
    <TabsTrigger value="chain" className="flex-1 gap-1.5">
      <Link2 className="h-3.5 w-3.5" />
      Chain
    </TabsTrigger>
    <TabsTrigger value="ai" className="flex-1 gap-1.5">
      <Bot className="h-3.5 w-3.5" />
      AI
    </TabsTrigger>
  </TabsList>
  <TabsContent value="chain" className="mt-4">
    <ChainSelector inline />
  </TabsContent>
  <TabsContent value="ai" className="mt-4 space-y-6">
    <LLMSettings inline />
    {user && llmMode === "builtin" && (
      <>
        <Separator />
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Usage & Credits</h3>
          <UsageSummary />
        </section>
      </>
    )}
  </TabsContent>
</Tabs>
```

Remove the old `<section>` wrappers and `<Separator />` elements between them.

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add components/layout/header.tsx
git commit -m "feat: convert settings dialog to tabbed layout"
```

---

### Task 3: Add model badge chip to header

**Files:**
- Modify: `components/layout/header.tsx`

**Step 1: Import getModelLabel**

Add to imports:

```typescript
import { getModelLabel } from "@/lib/stores/llm-store"
```

**Step 2: Make settings dialog controlled**

Add state for the dialog open/close inside the `Header` component:

```typescript
const [settingsOpen, setSettingsOpen] = useState(false)
```

Change the `<Dialog>` to `<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>`.

**Step 3: Add model badge chip**

Add the following between the settings gear `</Dialog>` closing tag and the sidebar toggle button:

```tsx
<button
  onClick={() => setSettingsOpen(true)}
  className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors"
>
  <span className={`h-1.5 w-1.5 rounded-full ${
    isConfigured
      ? llmMode === "builtin" ? "bg-green-500" : "bg-blue-500"
      : "bg-yellow-500"
  }`} />
  <span className="max-w-[120px] truncate">
    {isConfigured
      ? `${getModelLabel(config?.model || "")} · ${llmMode === "builtin" ? "Built-in" : "BYOK"}`
      : "No AI · Configure"}
  </span>
</button>
```

This requires adding `config` and `isConfigured` from `useLLM()`. Update the existing destructure:

```typescript
const { llmMode, config, isConfigured } = useLLM()
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Visual check**

Run dev server, verify:
- Header shows model badge chip (e.g. "Kimi K2 Thinking TEE · Built-in" with green dot)
- Clicking chip opens settings dialog
- Settings dialog has Chain / AI tabs
- Chain tab shows chain selector with all existing functionality
- AI tab shows LLM mode toggle, provider/model config, and usage/credits

**Step 6: Commit**

```bash
git add components/layout/header.tsx
git commit -m "feat: add persistent model badge to header"
```

---

### Task 4: Clean up LLM settings label references

**Files:**
- Modify: `components/settings/llm-settings.tsx`

**Step 1: Use getModelLabel in selects**

Import and use `getModelLabel` instead of `CHUTES_MODEL_LABELS[m] || m` in both BuiltinPanel and BYOKPanel model selectors:

```typescript
import { useLLM, LLMProviderType, getModelLabel } from "@/lib/stores/llm-store"
```

Replace `{CHUTES_MODEL_LABELS[m] || m}` with `{getModelLabel(m)}` in both SelectItem renders (BuiltinPanel line 49 and BYOKPanel line 149).

Remove the `CHUTES_MODEL_LABELS` import since it's no longer needed.

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add components/settings/llm-settings.tsx
git commit -m "refactor: use getModelLabel helper in LLM settings"
```
