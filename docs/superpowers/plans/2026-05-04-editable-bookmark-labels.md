# Editable Bookmark Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename any bookmark from the sidebar list and dashboard cards; persist the new name to the server (or localStorage when not authed).

**Architecture:** The client store already wires `updateBookmarkLabel` to PATCH `/api/bookmarks/:id` and to update local state / localStorage. The dashboard card already has inline-rename UI. Two pieces are missing: the PATCH route is not implemented on the server (calls 405 silently), and the sidebar has no rename affordance. This plan adds both.

**Tech Stack:** Next.js App Router (`app/api/...` route handlers), Supabase JS client (admin), React 19, Tailwind, lucide-react icons. No automated test framework in this repo — verification is via `curl` against the running build for the API and manual browser checks for the UI.

---

## Reality check vs. the spec

Spec says "the store interface already exposes `updateBookmarkLabel`; today the body is a stub. We wire it up." The body is **already implemented** in `lib/stores/history-store.tsx:144-159` and does optimistic-local + PATCH-when-authed. No store work needed. Spec also says we add the rename UI to dashboard cards — `components/dashboard/dashboard-card.tsx:153-219` already has it. So the implementation reduces to:

- **Server PATCH route** (the broken half — today's PATCH calls return 405 and the server stays in sync only by accident, when the user reloads from a fresh fetch)
- **Sidebar rename UI** (mirror the dashboard pattern)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `app/api/bookmarks/[id]/route.ts` | Modify | Add `PATCH` handler that updates `label` (and tolerates `result` for parity with the existing client call). Auth-gated. |
| `components/layout/left-panel.tsx` | Modify | Add inline rename to each sidebar bookmark row (mirror dashboard pattern). |

No new files. No test files (project has no test runner). Verification commands inline below.

---

## Task 1: Add `PATCH /api/bookmarks/[id]` route

**Files:**
- Modify: `app/api/bookmarks/[id]/route.ts`

- [ ] **Step 1: Probe production to confirm PATCH currently 405s**

```bash
curl -s -X PATCH https://talkblock.me/api/bookmarks/00000000-0000-0000-0000-000000000000 \
  -H "Content-Type: application/json" \
  -d '{"label":"x"}' -i | head -3
```

Expected: `HTTP/2 405` (Method Not Allowed) — confirms the route handler doesn't export `PATCH`.

- [ ] **Step 2: Add the `PATCH` export**

Open `app/api/bookmarks/[id]/route.ts` and append after the existing `DELETE` export:

```typescript
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let body: { label?: unknown; result?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates: { label?: string; result?: Record<string, unknown> } = {}
  if (typeof body.label === "string") {
    const trimmed = body.label.trim()
    if (!trimmed) return Response.json({ error: "label cannot be empty" }, { status: 400 })
    updates.label = trimmed
  }
  if (body.result !== null && typeof body.result === "object" && !Array.isArray(body.result)) {
    updates.result = body.result as Record<string, unknown>
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updatable fields provided" }, { status: 400 })
  }

  const supabase = createAdminClient()!
  const { data, error } = await supabase
    .from("bookmarks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .single()

  if (error || !data) return Response.json({ error: "Bookmark not found" }, { status: 404 })
  return Response.json({ success: true })
}
```

Why this shape:
- Accepts both `label` and `result` because the store already PATCHes both fields (`updateBookmarkLabel`, `updateBookmarkResult`); a label-only handler would silently break `updateBookmarkResult`.
- Trims and rejects empty `label` server-side as a defense in depth — the client also guards, but a paste of pure whitespace shouldn't blank a bookmark.
- The `eq("user_id", userId)` is the access control: the route trusts the JWT, the WHERE clause prevents cross-user updates.
- `.select("id").single()` so we can detect "no row matched" as a 404.

- [ ] **Step 3: Build and verify locally**

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors. (If it fails, the most likely cause is a Supabase `.update().select()` typing mismatch — fix the cast and rebuild.)

- [ ] **Step 4: Commit and push**

```bash
git add app/api/bookmarks/\[id\]/route.ts
git commit -m "feat: PATCH /api/bookmarks/[id] for label and result updates"
git push origin main
```

- [ ] **Step 5: Wait for Vercel deploy and verify 405 is gone**

```bash
SHA=$(git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

Expected: `Vercel: success`. Then re-probe:

```bash
curl -s -X PATCH https://talkblock.me/api/bookmarks/00000000-0000-0000-0000-000000000000 \
  -H "Content-Type: application/json" \
  -d '{"label":"x"}' -i | head -3
```

Expected: `HTTP/2 401` (Unauthorized — because no JWT). Crucially, **not** 405 anymore: that proves the handler is wired up.

- [ ] **Step 6: Authenticated end-to-end check**

Pick one bookmark id belonging to a real test user from the DB (use stored Supabase credentials):

```bash
# Use stored SBP token and PROJ ref to query database for a test bookmark
curl -s -X POST -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$PROJ/database/query" \
  -d '{"query":"select b.id, b.label, p.account_name from bookmarks b join profiles p on p.id=b.user_id where p.account_name=$$sdabas.gm$$ limit 1;"}'
```

Take the returned `id`, then call PATCH with the diagnostic JWT (saved in earlier turns; refresh from `/api/auth/login` if expired):

```bash
JWT="<paste current diagnostic JWT>"
BOOKMARK_ID="<paste id>"
curl -s -X PATCH "https://talkblock.me/api/bookmarks/$BOOKMARK_ID" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"label":"renamed-by-curl"}' -i | head -10
```

Expected: `HTTP/2 200` and body `{"success":true}` — but only if the JWT belongs to the bookmark's owner. If using diagnostic111's JWT against sdabas.gm's bookmark, expect `404` (which is the access-control check working). For a real authoritative test, query a bookmark that diagnostic111 owns; if none exist, create one through the UI first or skip this step in favor of the manual UI check in Task 2.

---

## Task 2: Add inline rename to sidebar bookmark rows

**Files:**
- Modify: `components/layout/left-panel.tsx:179-216`

The dashboard card already does inline rename (`components/dashboard/dashboard-card.tsx:153-219`). We mirror that pattern in the sidebar — the same trim/Enter/Esc/blur semantics, just in a tighter visual footprint.

- [ ] **Step 1: Pull the rename handlers and editor state into the sidebar**

Find the bookmark map block in `components/layout/left-panel.tsx` (around line 191) and replace the `chainBookmarks.map((bookmark) => { ... })` body with a small extracted row component declared inside the file. Above the existing `LeftPanel` function (or as a private component at the top of the file), add:

```typescript
function BookmarkRow({
  bookmark,
  Icon,
  onShow,
  onRemove,
  onRename,
}: {
  bookmark: { id: string; tool_name: string; label: string }
  Icon: React.ElementType
  onShow: () => void
  onRemove: () => void
  onRename: (label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(bookmark.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setValue(bookmark.label)
    setEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  const save = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== bookmark.label) onRename(trimmed)
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save()
    if (e.key === "Escape") cancel()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={save}
          className="h-6 text-xs px-1.5 flex-1"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <button
        className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors text-left truncate flex-1 cursor-pointer"
        onClick={onShow}
      >
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{bookmark.label}</span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={startEditing}
        aria-label="Rename bookmark"
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onRemove}
        aria-label="Delete bookmark"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
```

Notes for the engineer:
- `e.stopPropagation()` on the pencil click prevents the parent button's `onShow` from firing first.
- The component takes only the bookmark fields it actually needs, and parents pass the icon resolved — keeps this row dumb and consistent with how the existing list resolves icons inline.
- Save semantics: trim, ignore if empty or unchanged, call `onRename` otherwise. Esc/blur with no change is a no-op.

- [ ] **Step 2: Add required imports**

Near the top of `components/layout/left-panel.tsx`, ensure these imports exist (add what's missing):

```typescript
import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Pencil } from "lucide-react"
```

The file already imports `Bookmark`, `Trash2`, etc. from `lucide-react` and `Button` — extend the existing import lines, don't duplicate them.

- [ ] **Step 3: Pull `updateBookmarkLabel` from the history store**

Find:

```typescript
const { bookmarks, removeBookmark } = useHistory()
```

Change to:

```typescript
const { bookmarks, removeBookmark, updateBookmarkLabel } = useHistory()
```

- [ ] **Step 4: Render `BookmarkRow` from the bookmark loop**

Replace the existing JSX inside `chainBookmarks.map(...)` with:

```typescript
{chainBookmarks.map((bookmark) => {
  const Icon = TOOL_ICONS[bookmark.tool_name] || FileText
  return (
    <BookmarkRow
      key={bookmark.id}
      bookmark={bookmark}
      Icon={Icon}
      onShow={() => handleBookmarkClick(bookmark)}
      onRemove={() => removeBookmark(bookmark.id)}
      onRename={(label) => updateBookmarkLabel(bookmark.id, label)}
    />
  )
})}
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Manual browser verification**

Run `npm run dev`. In the browser:
1. Sign in, save a bookmark from a chat (use the bookmark icon on any tool result).
2. Hover the bookmark row in the sidebar — pencil + trash icons appear.
3. Click pencil → label becomes an input, autofocused, content selected.
4. Type a new label, press Enter → label updates, edit state clears.
5. Click pencil again, press Escape → no change.
6. Click pencil again, blur (click outside) → save with current value (or no-op if empty/unchanged).
7. Reload the page — the rename persists (proves PATCH from Task 1 is hitting the DB).

If step 7 fails: the new label still shows immediately because of the optimistic local update, but reverts on reload. That means PATCH is failing — check Network tab for `/api/bookmarks/<id>` response status.

- [ ] **Step 7: Commit and push**

```bash
git add components/layout/left-panel.tsx
git commit -m "feat: inline rename for sidebar bookmarks"
git push origin main
```

- [ ] **Step 8: Wait for deploy and smoke-test on prod**

```bash
SHA=$(git rev-parse HEAD)
until s=$(gh api repos/sdabas9/talkblock/commits/$SHA/status --jq '.state' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "Vercel: $s"
```

Then on https://talkblock.me, repeat the manual checks from Step 6 against production.

---

## Done criteria

- `curl -X PATCH .../api/bookmarks/<id>` returns 200 for an authenticated owner, 401 unauthenticated, 404 for cross-user, 400 for empty `label`.
- Sidebar bookmark row shows pencil + trash on hover; clicking pencil enters edit mode; Enter/blur saves, Esc cancels.
- After rename, page reload preserves the new label (server-side persistence works).
- Dashboard card rename — already in place — also persists across reload now that the PATCH route exists.
