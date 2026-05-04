# Editable bookmark labels

## Goal

Let signed-in and unauthenticated users rename any bookmark from the surfaces where bookmarks are listed (sidebar, dashboard).

## Scope

In: rename in **sidebar bookmark list** and **dashboard cards**.
Out: chat tool-result cards (transient display, not a management surface), bulk rename, undo, history.

## Surfaces & data model

The `bookmarks` table already has a `label TEXT` column. No schema change.

Two persistence modes already exist in `lib/stores/history-store.tsx`:
- Authed → POST/DELETE `/api/bookmarks` with the user's JWT, server is source of truth.
- Unauthed → localStorage only (`loadLocalBookmarks` / `saveLocalBookmarks`).

The store interface already exposes `updateBookmarkLabel(id, label)`; today the body is a stub. We wire it up.

## Server

New `PATCH /api/bookmarks/:id` in `app/api/bookmarks/[id]/route.ts`:
- Auth-gated (same JWT verify pattern as the existing `DELETE`).
- Body: `{ label: string }`.
- Trim and validate non-empty after trim; reject 400 otherwise.
- `UPDATE bookmarks SET label = $1 WHERE id = $2 AND user_id = $3` — the `user_id` clause is the access control.
- Returns `{ success: true }` on success; 404 if no row matched.

## Store

`updateBookmarkLabel(id, label)`:
- Trim. If empty, no-op (treat as cancel — UI also handles this).
- Optimistic local update: `setBookmarks(prev => prev.map(b => b.id === id ? { ...b, label } : b))`.
- If authed: `fetch('/api/bookmarks/' + id, { method: 'PATCH', body: JSON.stringify({ label }) })`. On non-OK, log and revert local state.
- If not authed: persist to localStorage via `saveLocalBookmarks`.

## UI

Pattern shared by both surfaces:

- **Display state**: existing label rendered, with a pencil icon that appears on hover (alongside the existing trash icon in the sidebar; alongside the existing actions in the dashboard card).
- **Edit state**: pencil click swaps the label for a small text `<input>`, autofocused with content selected.
- **Save**: Enter key, or blur with non-empty trimmed value → call `updateBookmarkLabel`, return to display state.
- **Cancel**: Escape key, or blur with empty trimmed value → discard, return to display state without calling the store.
- **Truncation**: existing display truncation preserved; the input itself is not truncated.

## Edge cases & tradeoffs

- Three icons (tool icon + pencil + trash) on one sidebar row is tight. We accept the density for now; if it feels crowded in practice, swap pencil for a "..." menu.
- No optimistic-UI conflict: the only race is two tabs editing simultaneously; last-write-wins is fine.
- No length limit enforced server-side; the column is unbounded `TEXT`.
- API key / RLS policy unchanged — same access pattern as DELETE.

## Out of scope (explicit)

- Editing bookmark `result` content. Today it's auto-refreshed on display; user-editable result is not a goal.
- Reordering bookmarks.
- Editing labels from the chat-card bookmark icon (would require popping a small inline editor from inside a tool-result card; not worth the complexity).
