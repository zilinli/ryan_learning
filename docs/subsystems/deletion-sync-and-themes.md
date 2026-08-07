# Deletion Sync & Multi-Theme System

> Version 0.2 · 2026-08-07
> Priority: 🔴 critical (deletion bug) · 🟡 important (themes)
> Status: design finalized — server PUT guard + client push filter + periodic re-hydration + 4-theme system

---

## 1. Cross-Device Deletion Sync

### 1.1 Problem

When PC1 deletes a conversation, the server JSON file is removed, but PC2's
local copy survives `mergeConversationLists` (which uses union logic).
PC2's next `pushStoreToServer` re-uploads the deleted conversation — a
**reincarnation bug**.

**Root cause (confirmed by code audit, 2026-08-07):**

1. Server `PUT /api/history` (→ `upsertServerConversation(s)`) **never checks
   the deletion log**. Any device can re-create a deleted conversation.
2. PC2's debounced save effect pushes its **un-hydrated** local store (which
   still contains the deleted chat) *before* the async init hydration
   completes — the re-upload wins.
3. PC2 only hydrates on init / account switch; while the tab stays open it
   never learns about deletions made on PC1.

### 1.2 Design — Server-Side Deletion Log (tombstones)

A lightweight tombstone-based approach:

```
data/deletions/{accountId}.json    ←  { sessionId: number (epoch ms), … }
```

- On `DELETE /api/history?sessionId=…&accountId=…`, the server writes a
  tombstone entry **before** unlinking the JSON file and **before** deleting
  the conversation's media files under `data/media`.
- On every `GET /api/history?accountId=…`, the server attaches a
  `deletions` field: `{ [sessionId]: deletedAt }`.
- Tombstones auto-expire after 30 days (TTL enforced on every read/write).

### 1.3 The Three Defenses (all required)

The tombstone alone is not enough. Three layers close every reincarnation path:

| # | Defense | Where | Effect |
|---|---------|-------|--------|
| 1 | **Server PUT guard** | `history-store.ts` (`upsertServerConversation`, `upsertServerConversations`) | Any upsert of a session with a fresh tombstone is rejected (`null` / skipped). **Authoritative — the server never resurrects a deleted chat, regardless of client timing.** |
| 2 | **Client push filter** | `history-sync.ts` (`pushStoreToServer`) | The client caches the last-seen deletion map (`hydrateFromServer` / `deleteServerChat` update it) and drops tombstoned sessions before pushing. |
| 3 | **Hydration on both sides** | `history-sync.ts` (`hydrateFromServer`) + `TutorShell.tsx` | (a) On init/switch: filter tombstoned sessions out of the local list before merging. (b) **Periodic re-hydration every 60 s + on tab `visibilitychange`**: an open tab on PC2 drops conversations that PC1 deleted, and picks up new ones — live cross-device consistency without reload. |

**Ordering rule (hydrate-before-push):** the init chain must run
`hydrateFromServer` before the first `pushStoreToServer`. The debounced save
effect may still push pre-hydration data; that is safe only because of
Defense #1.

### 1.4 Media / File Cleanup

`deleteServerConversation` already:

1. Writes the tombstone (Defense #1 depends on this).
2. Unlinks `data/{accountId}/<sessionId>.json`.
3. `deleteMediaForSession(sessionId)` removes every
   `data/media/<mediaId>.bin` + `.json` pair whose meta references the
   session — i.e. **text, images and uploaded files are all deleted server-side**.

With the PUT guard, a tombstoned session can never re-persist media, so the
cleanup is permanent.

### 1.5 Files

| File | Role | Status |
|------|------|--------|
| `src/lib/deletion-log.ts` | Read/write/prune the per-account deletion log + `isTombstoned()` predicate | ✅ v0.1 + predicate |
| `src/app/api/history/route.ts` | Include `deletions` in GET response; DELETE → `deleteServerConversation` | ✅ v0.1 |
| `src/lib/history-store.ts` | `deleteServerConversation` writes tombstone → unlink → delete media; **PUT guard rejects tombstoned upserts** | ✅ + 🔴 PUT guard |
| `src/lib/history-sync.ts` | `hydrateFromServer` applies deletions; `pushStoreToServer` filters tombstoned; deletion cache | ✅ + 🔴 push filter |
| `src/components/TutorShell.tsx` | Periodic re-hydration timer + visibility listener | 🔴 new |
| `scripts/verify-deletion-sync.mjs` | Two-device integration test (see §1.7) | 🔴 new |
| `src/lib/deletion-log.test.ts` | Unit tests (tombstone + predicate) | ✅ |
| `src/lib/history-store-deletion.test.ts` | PUT-guard + delete-flow unit tests | 🔴 new |

### 1.6 TTL & Expiry Semantics

- Server prunes tombstones older than 30 days on any read/write of the log.
- Client treats a tombstone older than 30 days as expired and **re-allows** the
  conversation (matches server pruning — a tombstoned chat that was re-created
  after 30 days is treated as a brand-new chat).

### 1.7 Test Plan

Unit (`deletion-log.test.ts`):
- [x] Tombstone is written on delete, read back correctly
- [x] Multiple tombstones coexist
- [x] Expired tombstones (30+ days) pruned on read
- [ ] `isTombstoned` — fresh → true; expired → false; missing → false

Unit (`history-store-deletion.test.ts`):
- [ ] Upsert after delete is rejected (`null`), conversation file not re-created
- [ ] Batch upsert skips tombstoned sessions, saves the fresh ones
- [ ] DELETE removes conversation file + tombstone exists; account data untouched

Client (`history-sync`):
- [ ] `pushStoreToServer` drops tombstoned sessions (mock `fetch`)

Integration (`scripts/verify-deletion-sync.mjs`, two simulated devices):
- [ ] Device A PUT → Device B GET sees the chat
- [ ] Device A DELETE → server file + media removed
- [ ] Device B GET: chat absent from `conversations`, present in `deletions`
- [ ] Device B re-PUTs the stale chat → server rejects (no resurrection)
- [ ] Device B GET again → chat still absent

---

## 2. Multi-Theme System

### 2.1 Motivation

Current theming uses a warm brown palette with only light/dark via
`html.dark`. Users requested:
- Light (warm cream/brown, current default)
- Dark (warm dark brown, current)
- Light Blue (cool blue academic feel)
- Light Green (fresh calm feel)

### 2.2 Design — CSS `data-theme` Attribute

Use `data-theme="light" | "dark" | "light-blue" | "light-green"` on `<html>`.
Each value triggers a CSS block that sets **all** `--ink`, `--teal`, etc.
variables.

Theme preference stored in `localStorage` key `spark.theme`. An inline script
in `layout.tsx` reads it before first paint to prevent FOUC (falling back to
`prefers-color-scheme`, and migrating the legacy `spark.dark` flag).

A `ThemePicker` component (four swatch buttons) replaces the unused
`DarkToggle`. It lives in the header.

### 2.3 Color Palettes + WCAG Contrast Audit

Contrast verified programmatically (`theme-contrast.test.ts`). Targets:
**`--ink` ≥ 4.5:1**, **`--ink-muted` ≥ 4.5:1** (normal text), **`--teal` /
`--coral` ≥ 3.0:1** (large/bold text & accents) — all on their `--bg0`.

| Theme | `--bg0` | `--ink` (ratio) | `--ink-muted` (ratio) | `--teal` (ratio) | `--coral` (ratio) |
|-------|---------|------------------|-----------------------|------------------|------------------|
| light | `#f3ebe0` | `#3d2b1f` (13.0) | `#7a6555` (4.7) | `#6b8f71` (3.3) | `#b96f52` (3.3) 🔧 |
| dark | `#1a120c` | `#e8dcc8` (13.6) | `#a89078` (5.8) | `#8fb896` (8.2) | `#e09a7a` (8.0) |
| light-blue | `#eef4f8` | `#1a2a3a` (13.5) | `#4a6a7c` (5.2) 🔧 | `#3a7a9a` (4.3) | `#c0695a` (3.5) 🔧 |
| light-green | `#eef8f0` | `#1a2e1a` (13.8) | `#4a6a4a` (5.5) 🔧 | `#3a7e5a` (4.4) | `#c0695a` (3.5) 🔧 |

🔧 = corrected in v0.2 — previous values measured below AA: `--ink-muted` `#5a7a8a`/`#5a7a5a` were ~4.1–4.3:1; `--coral` `#c4785a`/`#d4786a` were ~2.8:1 on the light themes.

### 2.4 UI Harmony Rules

- **All component colors go through CSS variables.** No `#`-literal
  Tailwind arbitrary values in TSX (exceptions: ThemePicker swatches, camera
  overlay text on live preview, SVG shapes).
- Diff viewer (Code Agent panel) uses dedicated variables so added/removed
  lines stay readable on every theme:

| Var | light / light-blue / light-green | dark |
|-----|----------------------------------|------|
| `--diff-code-bg` | `rgba(255,255,255,0.6)` | `rgba(255,255,255,0.04)` |
| `--diff-add-bg` | `rgba(26,127,90,0.12)` | `rgba(63,185,80,0.18)` |
| `--diff-remove-bg` | `rgba(192,57,43,0.10)` | `rgba(255,107,107,0.16)` |
| `--diff-add` | `#1a7f5a` | `#6fd08a` |
| `--diff-remove` | `#c0392b` | `#ff9088` |

- `--surface` stays near-white on light themes and translucent white on dark.
- `color-scheme` is set per theme so native scrollbars / inputs match.
- Browser `theme-color` meta is updated at runtime by `ThemePicker` to the
  active theme's `--bg0`.

### 2.5 ThemePicker Component

- Position: header right side.
- UI: four small colored circle buttons; active theme gets a ring highlight.
- Clicking a theme: writes `spark.theme`, sets
  `document.documentElement.dataset.theme`, removes legacy `spark.dark`,
  updates `meta[name=theme-color]`.
- Backward compatibility: `spark.dark === "true"` migrates to
  `spark.theme = "dark"` on init.

### 2.6 Files

| File | Role | Status |
|------|------|--------|
| `src/app/globals.css` | `[data-theme="…"]` blocks for all 4 themes + diff vars | ✅ + 🔧 contrast fixes |
| `src/app/layout.tsx` | Inline no-FOUC script for `data-theme` | ✅ |
| `src/components/ThemePicker.tsx` | Swatch picker | ✅ + 🔧 theme-color meta |
| `src/components/TutorShell.tsx` | Mount `ThemePicker`, `DarkToggle` removed | ✅ |
| `src/components/DiffViewer.tsx` | Use `--diff-*` variables | 🔧 |
| `src/lib/theme-contrast.test.ts` | Programmatic WCAG contrast checks | 🔴 new |
| `src/components/ThemePicker.test.tsx` | jsdom component test | 🔴 new |

### 2.7 Migration from `.dark` class

Old approach: `document.documentElement.classList.toggle("dark")`.
New approach: `document.documentElement.dataset.theme = "dark"`.

Backward compatibility is retained in CSS (`html.dark:not([data-theme])`) and
in the inline script, so any tab still running the old bundle renders dark
correctly until reload.

### 2.8 Test Plan

- [ ] `ThemePicker` renders all 4 options (jsdom)
- [ ] Clicking a theme updates `document.documentElement.dataset.theme`
- [ ] `spark.theme` persisted; legacy `spark.dark` removed
- [ ] Programmatic contrast: all 4 themes pass WCAG AA thresholds above
- [ ] Diff-viewer variables exist in `globals.css` for every theme
- [ ] No `#fff` / hardcoded foreground backgrounds left in components
- [ ] Manual: switch themes on desktop + phone; chat text, sidebar, buttons
      and diff viewer remain legible
