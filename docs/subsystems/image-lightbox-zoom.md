# Image Lightbox — Stacking Fix & Zoom Controls

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **design** · August 2026  
> Scope: Chat homework photo viewer (`ImageLightbox` + `ChatThread`)

---

## 1. Problem Statement

When a student taps a homework photo in the chat thread, `ImageLightbox` opens full-screen. On desktop (and large tablets), **large photos are visually clipped by the left History sidebar**:

| Symptom | Observation |
|---------|-------------|
| Occlusion | Left edge of the photo sits *under* the sidebar |
| Missing chrome | No zoom-in / zoom-out controls |
| Homework UX | Schedules / worksheets need readable detail; current `object-contain` fit often makes text too small |

Screenshot evidence (2026-08-07): a Spanish class schedule (`HORARIO DE CLASES…`) opened from chat; the LUNES column is hidden behind the sidebar.

---

## 2. Root Cause — Stacking Context Trap

```
TutorShell (flex row)
├── HistorySidebar wrapper     →  relative z-20   ← paints ABOVE main column
└── Main column                →  relative z-10
    └── ChatThread
        └── ImageLightbox      →  fixed z-[80]    ← trapped inside z-10 context
```

`ImageLightbox` already uses `fixed inset-0 z-[80]`, which is numerically higher than the sidebar’s `z-20`. That does **not** help: a `position` + `z-index` on an ancestor creates a **stacking context**. Children cannot escape it. The lightbox’s `z-[80]` only competes with siblings *inside* the `z-10` main column; the sibling sidebar at `z-20` still wins globally.

Related z-index map (current):

| Layer | z-index | Notes |
|-------|---------|-------|
| Main chat column | `z-10` | Contains lightbox today |
| Desktop sidebar | `z-20` | Occludes lightbox |
| Code Agent panel | `z-30` | Right drawer |
| Mobile sidebar drawer | `z-40` | Full-screen overlay |
| Camera / PinGate / delete confirm | `z-50` | Modals |
| ImageLightbox (intended) | `z-[80]` | **Ineffective while nested under z-10** |

---

## 3. Goals & Non-Goals

### Goals

1. **Top-most overlay** — opened photo must cover sidebar, header, Code Agent bubble, and other chrome.
2. **Zoom in / zoom out** — explicit buttons + keyboard; optional pinch on touch.
3. **Readable homework** — student can enlarge dense worksheets / schedules without leaving the lightbox.
4. **Child-safe close** — Esc, Close button, backdrop tap (when not dragging/panning) still dismiss.
5. **Tests** — unit + component coverage for stacking portal, zoom bounds, keyboard.

### Non-Goals (this phase)

- Multi-image carousel / swipe between attachments
- Annotation / crop / draw on photo
- Download-from-lightbox button (download already exists on file chips)
- Changing sidebar z-index architecture globally (portal is the targeted fix)

---

## 4. Proposed Design

### 4.1 Portal to `document.body`

Render the lightbox via `createPortal(..., document.body)` so it leaves the `z-10` stacking context.

```tsx
// Conceptual
return createPortal(
  <div className="fixed inset-0 z-[200] …" role="dialog" aria-modal="true">…</div>,
  document.body,
);
```

**Target z-index:** `z-[200]` — above Camera (`50`), PinGate (`50`), Code Agent (`30`), mobile sidebar (`40`). Document this in a short “overlay ladder” comment in the component so future modals don’t regress.

**Why not lower the sidebar?** Sidebar stacking is intentional (it must float above chat scroll). Raising lightbox out of the tree is the correct, local fix.

### 4.2 Layout (after open)

```
┌──────────────────────────────────────────────┐
│ [ − ]  [ + ]  100%              [ Close ]    │  ← toolbar (safe-area aware)
│                                              │
│              ┌──────────────┐                │
│              │              │  ← pan area    │
│              │    IMAGE     │    (overflow)  │
│              │              │                │
│              └──────────────┘                │
│                                              │
│  Tap dimmed area to close · Esc closes       │
└──────────────────────────────────────────────┘
```

- Backdrop: `bg-black/80` (unchanged feel).
- Image container: full viewport minus toolbar; `overflow: auto` (or transform-based pan) so zoomed content is scrollable/pannable.
- Image: `transform: scale(zoom)` with `transform-origin: center` **or** width/height scaled via CSS `max-width/max-height` × zoom factor. Prefer **CSS transform** for crisp GPU scaling and simpler pan.

### 4.3 Zoom Model

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial zoom | `1` (fit) | Current “contain” behavior = fit-to-viewport |
| Min zoom | `1` | No zoom-out below fit (avoids tiny floating image) |
| Max zoom | `4` | Enough for worksheet text; caps memory/gesture wildness |
| Step | `0.25` | Predictable button steps (1 → 1.25 → … → 4) |
| Reset | Double-tap image **or** “Fit” control | Returns to `1` |

**Controls**

| Control | Action |
|---------|--------|
| **＋** button | `zoom = min(max, zoom + step)` |
| **−** button | `zoom = max(min, zoom - step)` |
| Keyboard `+` / `=` | Zoom in |
| Keyboard `-` | Zoom out |
| Keyboard `0` | Reset to fit |
| Keyboard `Escape` | Close (existing) |
| Pinch (touch, optional nice-to-have) | Continuous zoom clamped to [min, max] |
| Wheel + Ctrl/Cmd (optional) | Desktop trackpad zoom |

Toolbar buttons: min **44×44** touch targets; English labels/`aria-label` (`Zoom in`, `Zoom out`, `Close`); show current percent (`100%` … `400%`).

**Pan when zoomed**

- At `zoom === 1`: no pan; backdrop click closes (current behavior).
- At `zoom > 1`: pointer drag pans the image; backdrop click still closes only if the pointer didn’t move > ~5px (distinguish tap vs drag).

### 4.4 Focus & Accessibility

- On open: focus Close button (or first toolbar control); trap Tab within lightbox.
- `role="dialog"` + `aria-modal="true"` + `aria-label` (existing).
- Body scroll lock (existing `overflow: hidden`).
- Announce zoom changes via `aria-live="polite"` on the percent label (optional but cheap).

### 4.5 Mobile / Safe Area

- Toolbar respects `safe-top` / `env(safe-area-inset-*)`.
- Pinch zoom is **Phase 14B** (nice); Phase 14A ships buttons + keyboard so phones still work without pinch.

---

## 5. Component API

Keep the public props minimal; zoom is internal state.

```ts
type ImageLightboxProps = {
  src: string;
  alt?: string;
  onClose: () => void;
};
```

Internal state:

```ts
zoom: number;          // 1 … 4
offset: { x: number; y: number }; // pan when zoom > 1
```

Helpers (pure, unit-testable):

```ts
// src/lib/lightbox-zoom.ts  (new)
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

export function clampZoom(z: number): number;
export function zoomIn(z: number): number;
export function zoomOut(z: number): number;
export function formatZoomPercent(z: number): string; // "100%", "125%", …
```

`ChatThread` call site stays unchanged — only `ImageLightbox` internals + portal change.

---

## 6. Implementation Plan (for TODO)

| Step | Change | Files |
|------|--------|-------|
| 1 | Extract pure zoom helpers | `src/lib/lightbox-zoom.ts` 🆕 |
| 2 | Portal + `z-[200]` + stacking comment | `ImageLightbox.tsx` |
| 3 | Toolbar: − / + / percent / Close | `ImageLightbox.tsx` |
| 4 | Pan when zoomed; backdrop-tap vs drag | `ImageLightbox.tsx` |
| 5 | Keyboard: `+` `-` `0` Esc | `ImageLightbox.tsx` |
| 6 | Unit tests for zoom helpers | `src/lib/lightbox-zoom.test.ts` 🆕 |
| 7 | Component tests: portal target, z-index class, zoom buttons, Esc | `src/components/ImageLightbox.test.tsx` 🆕 |
| 8 | Manual QA checklist (desktop sidebar occlusion, phone) | QA only |

---

## 7. Test Plan

### 7.1 Unit — `lightbox-zoom.test.ts`

| Case | Expect |
|------|--------|
| `zoomIn(1)` | `1.25` |
| `zoomIn(3.9)` | clamps to `4` |
| `zoomOut(1)` | stays `1` |
| `zoomOut(1.25)` | `1` |
| `clampZoom(0.5)` / `clampZoom(99)` | `1` / `4` |
| `formatZoomPercent(1)` / `(1.25)` / `(4)` | `"100%"` / `"125%"` / `"400%"` |

### 7.2 Component — `ImageLightbox.test.tsx` (@testing-library/react)

| Case | Expect |
|------|--------|
| Renders into `document.body` (portal) | Dialog node is direct child of `body` (or under portal root), not inside a mocked `z-10` ancestor |
| Has class including `z-[200]` (or documented token) | Overlay above sidebar ladder |
| Click Zoom in | Percent label updates; image style/transform reflects scale |
| Click Zoom out at 100% | Stays at 100% |
| Press Escape | `onClose` called |
| Click Close | `onClose` called |
| Backdrop click at zoom 1 | `onClose` called |

### 7.3 Manual / regression

| Device | Check |
|--------|-------|
| Desktop ≥1024 with sidebar open | Full photo visible; no sidebar over image |
| Phone 390×844 | Toolbar reachable; zoom buttons usable; Close works |
| With Code Agent open | Lightbox still covers Code Agent panel |
| Large schedule / worksheet | Zoom to 200%+ readable |

### 7.4 Out of scope for automated E2E this phase

Playwright/visual E2E can wait; unit + RTL cover the regression class (stacking + zoom math). Optional later: `scripts/verify-lightbox.mjs` smoke if we add a static fixture page.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Portal breaks SSR | `"use client"` already; portal only after mount (`useEffect` + `mounted` flag or `typeof document`) |
| High z-index wars | Document ladder; pick `200` with comment; avoid magic `9999` |
| Pan fights backdrop close | Movement threshold before treating as drag |
| Transform blur on some browsers | Prefer integer device-pixel-friendly scales; test on Chrome Android |
| Focus trap complexity | Start with focus Close on open; full trap if Tab leaks in QA |

---

## 9. Acceptance Criteria

1. With desktop sidebar visible, opening any chat photo shows the **entire** image above the sidebar (no occlusion).
2. User can **Zoom in** and **Zoom out** via toolbar buttons; percent label updates.
3. Keyboard `+` / `-` / `0` / `Esc` work as specified.
4. At zoom > 1, user can pan to inspect edges of large worksheets.
5. All new unit + component tests pass; existing suite remains green.

---

## 10. Related Docs

- [ui-architecture.md](ui-architecture.md) — shell / sidebar layout
- [TODO.md](../TODO.md) — Phase 14 tasks
- Component today: `src/components/ImageLightbox.tsx` (mounted from `ChatThread.tsx`)
