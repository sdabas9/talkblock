# Stop Response Control — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm with user)

## Goal

Let the user cancel an in-progress AI response from the chat input: while a response is streaming, the send button morphs into a stop button (ChatGPT/Claude pattern).

## Changes

**`components/chat/chat-panel.tsx`**
- Destructure `stop` from the existing `useChat(...)` call (`const { messages, sendMessage, setMessages, status, stop } = useChat({...})`).
- Pass `streaming={isLoading}` and `onStop={stop}` to `<ChatInput>` (isLoading already = `status === "submitted" || status === "streaming"`).

**`components/chat/chat-input.tsx`**
- Props: add `streaming?: boolean` and `onStop?: () => void`.
- Button: when `streaming`, render a `Square` icon (lucide), always enabled, `onClick={onStop}`, `aria-label="Stop response"`; otherwise unchanged send behavior (`SendHorizontal`, disabled when empty or `disabled`).
- Textarea: unchanged (stays disabled while loading, exactly as today).

## Behavior (AI SDK v6 built-ins — no server changes)

- `stop()` aborts the streaming fetch; the partial assistant message remains in the chat.
- Status transitions to `ready`, so the existing status-watch effects (conversation autosave, credits refresh, chat-panel.tsx:101-109) fire the same as on natural completion; streaming indicator clears.
- Stop works in both the `submitted` phase (before first token) and the `streaming` phase.
- Trade-off, accepted: an aborted stream may skip `recordUsage` in the server's `onFinish` — identical to the pre-existing close-the-tab case. Billing changes out of scope.

## Verification

`npm run lint` (no new errors; baseline 111) + `npm run build`; live dev check: send a message → button morphs to stop → click mid-stream → partial text stays, status returns to ready, input re-enables, send icon returns.
