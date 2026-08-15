# Sidebar density & readability (HistorySidebar)

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **implemented** · August 2026  
> Related: [ui-architecture.md](ui-architecture.md) §5.4

---

## Problem

Left nav made **Search chats** and conversation titles hard to read (`text-sm` / `11px` meta). Footer spent vertical space on **Progress** and **Dictionary** each as full-width rows, shrinking the chat list — the primary surface.

## Approach

1. **Chat-first type scale** — Search input + conversation titles at **16px** (`text-base`); meta/snippet at **12px** (`text-xs`); slightly taller list rows.
2. **Compact 3-column footer** — no dedicated Progress/Dict rows:
   - `Family | Me | Progress`
   - `Studio | Games | Dict`
   - `GitHub | Help & feedback`
   - `Code Agent` (full width)
3. **Footer chrome** — tighter padding (`py-2`, `gap-1.5`) but **12px** nav labels (up from 11px) so links stay readable while reclaiming list height.
4. **Sidebar width** — `min(28rem, 88vw)` so longer titles wrap less aggressively.

## Key files

| File | Role |
|------|------|
| `src/components/HistorySidebar.tsx` | Search, list type, footer grid |
| `README.md` | Sidebar row layout blurb |
| `docs/subsystems/ui-architecture.md` | §5.4 footer note |

## Risks

- 3-column labels may truncate on very narrow drawers → use short labels (`Dict`) + `title` tooltips.
- Touch targets stay ≥36–40px (`min-h-9` / `min-h-10`); do not drop below ~36px.

## Test design

| Layer | What |
|-------|------|
| **Unit** | Existing history-merge / search helpers unchanged; optional smoke that footer hrefs remain `/family`, `/me`, `/dashboard`, `/studio`, `/entertain`, `/dict`. |
| **Integration** | `npm test` / vitest on related modules if any fail after CSS-only edits. |
| **Manual** | Desktop + phone drawer: titles readable; Progress not alone; chat list gains visible height; Code Agent / Games still reachable. |
