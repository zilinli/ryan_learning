# Deletion Sync & Multi-Theme System

> Version 0.1 · 2026-08-07
> Priority: 🔴 critical (deletion bug) · 🟡 important (themes)

---

## 1. Cross-Device Deletion Sync

### 1.1 Problem

When PC1 deletes a conversation, the server JSON file is removed, but PC2's
local copy survives `mergeConversationLists` (which uses union logic).
PC2's next `pushStoreToServer` re-uploads the deleted conversation — a
**reincarnation bug**.

### 1.2 Design — Server-Side Deletion Log

A lightweight tombstone-based approach:

```
data/deletions/{accountId}.json    ←  { sessionId: number (epoch ms), … }
```

- On `DELETE /api/history?sessionId=…`, the server writes a tombstone entry
  *before* unlinking the JSON file.
- On every `GET /api/history?accountId=…`, the server attaches a
  `deletions` field: `{ [sessionId]: deletedAt }`.
- `hydrateFromServer` filters out tombstoned sessions from the local
  conversation list *before* merging with the server list and *before*
  pushing back.
- Tombstones auto-expire after 30 days (client-side filter: ignore entries
  older than 30 × 86400 × 1000 ms).
- TTL is enforced server-side too during periodic cleanup (on any write to
  the deletions file).

### 1.3 Files

| File | Role |
|------|------|
| `src/lib/deletion-log.ts` | Read/write/prune the per-account deletion log |
| `src/app/api/history/route.ts` | Include `deletions` in GET response; write tombstone in DELETE |
| `src/lib/history-sync.ts` | `hydrateFromServer` applies deletion log before merging |
| `src/lib/history-store.ts` | `deleteServerConversation` writes tombstone before unlink |
| `src/lib/deletion-log.test.ts` | Unit tests |
| `src/lib/history-sync.test.ts` | (existing, may need update) |

### 1.4 Test Plan

- Tombstone is written on delete, read back correctly
- `hydrateFromServer` strips tombstoned conversations
- Expired tombstones (30+ days) are ignored
- Tombstoned conversation does NOT re-upload on next push
- No tombstone → no filtering (backward compatible)

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

Theme preference stored in `localStorage` key `spark.theme` (values:
`"light"`, `"dark"`, `"light-blue"`, `"light-green"`). An inline script in
`layout.tsx` reads this before first paint to prevent FOUC.

A `ThemePicker` component (dropdown or icon palette) replaces the unused
`DarkToggle`. It lives in the header and the sidebar footer.

### 2.3 Color Palettes

#### Light (current :root)

| Variable | Value |
|----------|-------|
| `--ink` | `#3d2b1f` |
| `--ink-muted` | `#7a6555` |
| `--teal` | `#6b8f71` |
| `--coral` | `#c4785a` |
| `--mist` | `#ebe0d2` |
| `--line` | `rgba(61,43,31,0.14)` |
| `--bg0` | `#f3ebe0` |
| `--bg1` | `rgba(90,60,35,0.28)` |
| `--bg2` | `rgba(70,45,25,0.22)` |
| Body gradient | `#f7f0e6 → #efe4d4 → #e8dcc8` |

#### Dark (current .dark)

| Variable | Value |
|----------|-------|
| `--ink` | `#e8dcc8` |
| `--ink-muted` | `#a89078` |
| `--teal` | `#8fb896` |
| `--coral` | `#e09a7a` |
| `--mist` | `rgba(60,40,25,0.45)` |
| `--line` | `rgba(232,220,200,0.14)` |
| `--bg0` | `#1a120c` |
| `--bg1` | `rgba(90,60,35,0.28)` |
| `--bg2` | `rgba(70,45,25,0.22)` |
| Body | `linear-gradient(180deg, #1f1510, #18110c, #140e0a)` |

#### Light Blue

| Variable | Value |
|----------|-------|
| `--ink` | `#1a2a3a` |
| `--ink-muted` | `#5a7a8a` |
| `--teal` | `#3a7a9a` |
| `--coral` | `#d4786a` |
| `--mist` | `#dce8f0` |
| `--line` | `rgba(26,42,58,0.12)` |
| `--bg0` | `#eef4f8` |
| `--bg1` | `rgba(50,80,110,0.18)` |
| `--bg2` | `rgba(40,70,100,0.22)` |
| Body | `#f0f6fa → #e4ecf4 → #d8e2ec` |

#### Light Green

| Variable | Value |
|----------|-------|
| `--ink` | `#1a2e1a` |
| `--ink-muted` | `#5a7a5a` |
| `--teal` | `#3a7e5a` |
| `--coral` | `#d4786a` |
| `--mist` | `#d8ece0` |
| `--line` | `rgba(26,46,26,0.12)` |
| `--bg0` | `#eef8f0` |
| `--bg1` | `rgba(40,90,60,0.18)` |
| `--bg2` | `rgba(30,80,50,0.22)` |
| Body | `#f0faf2 → #e4f4e8 → #d8ecd8` |

### 2.4 UI Harmony Rules

- **Hardcoded colors must be eliminated.** Search for any `#`-literal
  color in TSX files and replace with CSS variables or Tailwind classes.
  Exception: inline SVG shapes in atmosphere blobs.
- **Contrast check:** `--ink` on `--bg0` must have WCAG AA contrast ratio
  (≥ 4.5:1 for normal text).
- **`--coral` on `--bg0` must pass AA for large/bold text (≥ 3:1).**
- **`--teal` on `--bg0` must pass AA for large/bold text (≥ 3:1).**
- **Hardcoded white `#fff` / `#ffffff`** in components (e.g., buttons,
  overlays) should use `color-mix(in srgb, var(--bg0) 94%, white)` or
  similar for dark-theme safety.
- **`--mist` backgrounds** must be translucent enough in dark themes to
  show `--bg0` through them.

### 2.5 ThemePicker Component

- Position: header right side, between voice toggle and menu toggle (or
  replacing unused DarkToggle slot).
- UI: four small colored circle buttons (or a compact `<select>`).
- Active theme: ring highlight.
- Clicking a theme: writes `spark.theme` to localStorage, sets
  `document.documentElement.dataset.theme`, and removes the `.dark` class
  (migrating from old toggle).

### 2.6 Files

| File | Role |
|------|------|
| `src/app/globals.css` | Replace `.dark` blocks with `[data-theme="…"]` blocks for all 4 themes |
| `src/app/layout.tsx` | Update inline script for `data-theme` |
| `src/components/ThemePicker.tsx` | New component |
| `src/components/TutorShell.tsx` | Mount `ThemePicker`, remove `DarkToggle` |
| `src/components/HistorySidebar.tsx` | Optional: theme button in footer |

### 2.7 Migration from `.dark` class

Old approach: `document.documentElement.classList.toggle("dark")`.
New approach: `document.documentElement.dataset.theme = "dark"`.

**Backward compatibility**: On init, if `spark.dark === "true"` but
`spark.theme` is unset, migrate to `spark.theme = "dark"`.

### 2.8 Test Plan

- ThemePicker renders all 4 options
- Clicking a theme updates `document.documentElement.dataset.theme`
- localStorage key `spark.theme` is persisted correctly
- Theme variables have sufficient contrast (programmatic check)
- No hardcoded `#fff` in main components
- Dark theme does not show washed-out text
- Inline script applies theme before paint (no FOUC)
