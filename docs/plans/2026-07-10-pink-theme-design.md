# Pink Theme — Design

**Date:** 2026-07-10
**Status:** Approved (brainstorm with user)

## Goal

Add a sixth theme, `pink` — dark plum surfaces with a vivid pink primary — modeled structurally on `gold` (the existing dark-with-vivid-accent theme).

## Palette

New `.pink` block in `app/globals.css`, appended after `.orange`, defining the same token set every other theme defines:

| Token | Value | Note |
|---|---|---|
| `--background` | `oklch(0.13 0.015 340)` | near-black plum |
| `--foreground` | `oklch(0.95 0.01 340)` | |
| `--card` / `--popover` | `oklch(0.17 0.02 340)` | |
| `--card-foreground` / `--popover-foreground` | `oklch(0.95 0.01 340)` | |
| `--primary` | `oklch(0.72 0.19 350)` | vivid pink |
| `--primary-foreground` | `oklch(0.15 0 0)` | |
| `--secondary` | `oklch(0.21 0.02 340)` | |
| `--secondary-foreground` | `oklch(0.95 0.01 340)` | |
| `--muted` | `oklch(0.19 0.015 340)` | |
| `--muted-foreground` | `oklch(0.68 0.04 345)` | |
| `--accent` | `oklch(0.22 0.03 345)` | |
| `--accent-foreground` | `oklch(0.8 0.15 350)` | |
| `--destructive` | `oklch(0.65 0.2 25)` | unchanged red — must stay distinguishable from pink |
| `--border` | `oklch(1 0 0 / 10%)` | matches gold |
| `--input` | `oklch(1 0 0 / 12%)` | matches gold |
| `--ring` | `oklch(0.65 0.17 350)` | |
| `--chart-1` | `oklch(0.72 0.19 350)` | pink primary |
| `--chart-2` | `oklch(0.65 0.15 160)` | stays green (dashboard identity-tile accent) |
| `--chart-3` | `oklch(0.7 0.17 70)` | |
| `--chart-4` | `oklch(0.6 0.24 300)` | |
| `--chart-5` | `oklch(0.6 0.22 16)` | |
| `--sidebar` | `oklch(0.11 0.015 340)` | |
| `--sidebar-foreground` | `oklch(0.95 0.01 340)` | |
| `--sidebar-primary` | `oklch(0.72 0.19 350)` | |
| `--sidebar-primary-foreground` | `oklch(0.15 0 0)` | |
| `--sidebar-accent` | `oklch(0.18 0.02 345)` | |
| `--sidebar-accent-foreground` | `oklch(0.72 0.19 350)` | |
| `--sidebar-border` | `oklch(1 0 0 / 8%)` | |
| `--sidebar-ring` | `oklch(0.65 0.17 350)` | |

## Registration

`components/layout/header.tsx`:
- `Theme` union: add `"pink"`
- `THEME_CYCLE`: append after `"orange"`
- `THEME_LABELS`: `pink: "Pink"`
- `DARK_CLASSES`: add `"pink"` (theme detection + class cleanup on switch)

## Deliberately unchanged

- `@custom-variant dark (&:is(.dim *, .dusk *))` in `globals.css:5` — gold and orange are dark themes and are not in this variant; pink follows that precedent.
- No other files: the entire app (dashboard terminal styling, chat cards, charts) consumes theme tokens, so pink applies automatically.

## Verification

`npm run lint` (no new errors; baseline 111) + `npm run build`; visual pass on dashboard + chat in pink checking pink-on-plum contrast and that transfer arrows (destructive red vs primary pink) remain distinguishable.
