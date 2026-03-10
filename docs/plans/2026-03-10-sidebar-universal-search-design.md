# Sidebar Universal Search

## Overview
Add a universal search input to the left sidebar (below Chain Info, above Bookmarks/Recents) that auto-detects input type and opens results directly in the right panel. No AI credits consumed.

## Component
- Single text input with search icon, placeholder "Search account, tx, block..."
- Live type badge appears as user types showing detected type:
  - `Account` — matches `^[a-z1-5][a-z1-5.]{0,11}[a-z1-5]$` or `^[a-z1-5]$`
  - `Transaction` — matches `^[a-f0-9]{64}$`
  - `Block` — matches `^\d+$`
  - No badge if input doesn't match any pattern
- On Enter or search button click: calls `/api/lookup` with detected type
- On success: opens result in right panel via `setContext(type, data)`, clears input
- On error: shows inline error text below input
- Account lookups added to recent accounts list (consistent with existing behavior)

## Placement
Below Chain Info section, above Bookmarks/Recents in the left panel.

## No changes to
- Chat flow, AI tools, or credit system
- Right panel components
- Existing sidebar sections
