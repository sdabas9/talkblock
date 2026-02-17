# Settings Redesign

## Goal

Reorganize the settings dialog into a tabbed layout (Chain / AI) and add a persistent model badge to the header so the active model and mode are always visible.

## Header Model Badge

A small clickable chip next to the settings gear icon:

- Built-in mode: `Kimi K2 · Built-in` with green dot
- BYOK mode: `GPT-4o · BYOK` with blue dot
- Not configured: `No AI · Configure` with yellow dot

Clicking the chip opens the settings dialog.

## Tabbed Settings Dialog

Two tabs using shadcn/ui Tabs component:

### Chain tab
- Preset chain grid (existing ChainContent)
- Custom RPC endpoint input
- Connected chain info (Chain ID, Head Block, Producer)
- Disconnect button

### AI tab
- Mode toggle (Built-in / BYOK) segmented control
- Built-in: model selector + status badge
- BYOK: provider selector, API key input, model selector + status badge
- Usage & Credits section (when authenticated + built-in mode): free requests, credit balance, token usage, Buy Credits button

## What stays the same
- All existing functionality preserved
- UsageIndicator in header remains
- Gear icon remains, chip added beside it
