# 📋 Downstream Development TODO

> Version 0.3 · 2026-08-03  
> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have  
> Baseline: 24 test files, 220 tests, service `active` at :3000  
> New UI spec: **[subsystems/ui-architecture.md](subsystems/ui-architecture.md)** (451 lines, covers full page design)

---

## ✅ Completed (2026-08-03)

### Phase 0: 极简 UI
- [x] **0.1** Remove all UI chrome (GitHub link, large logo, "New chat" btn — hamburger + voice in header)
- [x] **0.2** Mobile-first: 375px target, 44px touch targets, auto-expand textarea
- [x] **0.3** Photo-first: camera = primary, upload = icon-only paperclip
- [x] **0.4** Singapore bar-model `bar` shape in `draw_geometry`
- [x] **0.5** BASIS G5 textbook templates in `prompts.ts`
- [x] **0.6** Multi-lingual word-problem: `detectLanguage()`, `isWordProblem()`, `inferSkillsFromTextMultiLang()`
- [x] **0.7** Zero-login session persistence (URL-query param → localStorage)

### Phase 1: Memory Module
- [x] **1.1** SM-2 decay (`applySm2Decay`, `sm2Update`, `outcomeToSm2Quality`) — 9 tests
- [x] **1.2** Prerequisite-aware selection (`prerequisitesSatisfied`, ≥60%) — wired into warm-up
- [x] **1.3** Recall cache (`storeRecallCache`/`loadRecallCache`, 5min TTL)
- [x] **1.4** ZPD scoring (`zpdScore`, `pSolve`, `jointPSolve`, `zpdWarmUpSkills`) — 14 tests
- [x] **1.5** Confidence-weighted BKT (high-conf wrong → double penalty)
- [x] **1.6** Elo-hybrid difficulty (`eloUpdate`, `difficultyAdjustedBktParams`) — 7 tests

### Phase 2: Agent & Prompt (partial)
- [x] **2.1** Subject-specific coaching templates (math/reading/science/writing)
- [x] **2.3** Progressive disclosure (`~~~step` fences, click-to-reveal)
- [ ] **2.2** Multi-turn task planning for worksheets
- [ ] **2.4** Capture/replay student reasoning chains

### Phase 6: Testing (partial)
- [x] **6.1.6** Engagement tests — 13 tests (streak, badges, summary, serialization)
- [x] **6.2.1–6.2.6** SM-2, ZPD, confidence, Elo, multi-lingual tests

### Quick Wins
- [x] Dark mode toggle (`DarkToggle` in TutorShell header)
- [x] Keyboard: Shift+Enter = newline, Enter = send
- [x] `test:ci` + `coverage` scripts in `package.json`

---

## 🔴 Phase 0: Full-Stack UI Implementation (6d)

> **Spec:** [subsystems/ui-architecture.md](subsystems/ui-architecture.md)  
> **Current state:** `VoiceControls` nested `flex-col`; Chinese camera labels; toolbar wraps on phone; no sidebar animation; no empty/loading/error states; no focus-visible rings.

### 🔴 0.8 Composer Layout Overhaul (2d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.8a | Flatten `VoiceControls` to inline fragment — remove `flex-col` wrapper | 0.5d | `VoiceControls.tsx` |
| 0.8b | Responsive toolbar labels per ui-architecture §4.2 | 0.5d | `Composer.tsx` |
| 0.8c | Phone layout: `Photo` label, voice popover (sheet), 44×44px targets, safe-area bottom padding | 0.5d | `Composer.tsx`, `VoiceControls.tsx`, `globals.css` |
| 0.8d | Tablet layout: `Snap homework`, hold-to-talk fine-pointer, compact voice select | 0.25d | `Composer.tsx`, `VoiceControls.tsx` |
| 0.8e | Desktop layout: full labels, inline voice `<select>`, hover states | 0.25d | `Composer.tsx`, `VoiceControls.tsx` |

### 🔴 0.9 English Chrome (1d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.9a | English voice labels in `TUTOR_VOICES` | 0.25d | `voices.ts` |
| 0.9b | English action labels: `Photo` / `Snap homework`, `Hold to talk` / `Mic`, `Speak on` / `Speak off`, `Send` / `Thinking…` | 0.25d | `Composer.tsx`, `VoiceControls.tsx` |
| 0.9c | Voice picker: English only per ui-architecture §4.2/§6 table | 0.25d | `VoiceControls.tsx` |
| 0.9d | `aria-label` and `title` attributes in English on all icons | 0.25d | `Composer.tsx`, `VoiceControls.tsx`, `TutorShell.tsx` |

### 🔴 0.10 Shell & Sidebar Polish (1d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.10a | Sidebar: `translateX` slide animation (250ms ease-out) | 0.25d | `HistorySidebar.tsx` |
| 0.10b | Sidebar: empty state ("No conversations yet"), delete confirmation | 0.25d | `HistorySidebar.tsx` |
| 0.10c | Header: hamburger ↔ X icon toggle; brand "✨ Spark" | 0.25d | `TutorShell.tsx` |
| 0.10d | Header: 48px fixed height on all devices | 0.25d | `TutorShell.tsx` |

### 🔴 0.11 Chat UX (1d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.11a | Chat bubbles: distinct left/right styling (agent = mist bg left, student = teal bg right) | 0.25d | `ChatThread.tsx`, `MarkdownMessage.tsx` |
| 0.11b | Auto-scroll to bottom + "↓ New messages" badge when scrolled up | 0.25d | `ChatThread.tsx` |
| 0.11c | Loading skeleton while agent is thinking (pulsing gray bubble) | 0.25d | `ChatThread.tsx`, `TutorShell.tsx` |
| 0.11d | Empty state: large centered "Ask anything about your homework…" with camera + mic hints | 0.25d | `ChatThread.tsx` |

### 🟡 0.12 States & Feedback (0.5d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.12a | Error banner: network/agent/TTS errors with coral accent | 0.25d | `TutorShell.tsx` |
| 0.12b | Voice states: speak icon pulses when TTS queued, solid when speaking, coral when error | 0.25d | `VoiceControls.tsx` |

### 🟡 0.13 Accessibility (0.5d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.13a | Focus-visible rings on all interactive elements (`focus-visible:ring-2 ring-[--teal]`) | 0.25d | All `.tsx` |
| 0.13b | Keyboard nav: Tab order (header → main → composer), Esc closes sidebar | 0.25d | `TutorShell.tsx`, `HistorySidebar.tsx` |

### 🟡 0.14 Device QA (0.5d)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 0.14a | Phone QA: iPhone 14 (390×844) + Huawei (360×780) — toolbar 1 row, no Chinese, Send visible, keyboard-open safe-area | 0.25d | Manual |
| 0.14b | Tablet + Desktop QA: iPad (768/1024) + PC (1280) — `Snap homework` label, no stacked controls, full labels + inline voice, Enter sends | 0.25d | Manual |

---

## 🔴 Phase 6: Testing Gaps (10d)

| # | Task | Effort | Risk |
|---|------|--------|------|
| 6.1.1 | `cursor-agent.ts` unit tests — mock Cursor SDK, retry, cancellation | 2d | Core AI layer untested |
| 6.1.2 | `speech-player.ts` unit tests — mock Web Audio API, queue, abort, autoplay | 2d | TTS bugs break voice |
| 6.1.3 | `history-sync.ts` unit tests — sync conflicts, merge, corrupted data | 1d | Data loss risk |
| 6.1.4 | `chat/route.ts` unit tests — mock Agent, prompt assembly, error codes | 2d | Main endpoint untested |
| 6.1.5 | React component tests — `@testing-library/react`: TutorShell, Composer, MarkdownMessage, 375px layout | 3d | Zero UI coverage |

---

## 🟡 Phase 2: Agent & Prompt (6d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 2.2 | Multi-turn task planning — agent plans Q1→Q2→Q3 for worksheet photos | 3d | Agent |
| 2.4 | Capture/replay student reasoning — store L1.5 "why" answers as examples | 3d | `learning-memory.ts` |

---

## 🟡 Phase 3: Geometry & Visualization (13d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 3.1 | Interactive geometry: drag to measure angles/lengths on diagrams | 5d | `DiagramBlock.tsx`, SVG |
| 3.2 | Animated step-by-step geometry constructions | 3d | `geometry-svg.ts` |
| 3.3 | Desmos-like coordinate graphing for algebra | 5d | New component |

---

## 🟡 Phase 4: Voice & Multi-Modal (9d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 4.1 | Voice-only mode — full STT→agent→TTS loop, no screen needed | 5d | `speech-player.ts`, `Composer.tsx` |
| 4.2 | Natural number pronunciation — `x²` → "x squared" (EN) / "x 平方" (ZH) | 1d | `tts-text.ts` |
| 4.3 | Parent voice note recording — parent records message attached to chat | 3d | New component |

---

## 🟢 Phase 5: Platform & DevOps (9d)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 5.1 | PWA install + offline — cache app shell, offline chat history | 3d | `layout.tsx`, service worker |
| 5.2 | Docker deployment — single-container deploy with health check | 2d | Dockerfile |
| 5.3 | Automated BKT parameter tuning from logs | 3d | `bkt.ts` |
| 5.4 | Error telemetry (Sentry or custom) | 2d | Agent, API |

---

## 🟢 Remaining Testing (7.5d)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.2.5 | Singapore bar model render tests | 1d | Horizontal/vertical bars, comparison, part-whole, overflow |
| 6.2.7 | Photo-first workflow tests | 1d | Image resize, format, MIME, corrupt image, IndexedDB |
| 6.2.9 | Progressive disclosure UI tests | 0.5d | Click-to-reveal transitions, keyboard |
| 6.3.1–6.3.4 | API route unit tests (4 routes) | 2d | `learning/`, `history/`, `tts/`+`transcribe/`, `media/` |
| 6.4.1 | GitHub Actions CI: unit + build on push/PR | 1d | |
| 6.4.3 | Vitest coverage threshold (70% `src/lib/`) | 0.5d | |
| 6.4.4 | Pre-commit hook: `tsc --noEmit` + `eslint` | 0.5d | |

---

## 🟢 Nice-to-Have

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1.7 | Parent dashboard — skill radar chart, mastery timeline, heatmap | 5d | NOT visible to child |
| N1 | Export learning memory as printable PDF | 1d | For parent review |
| N2 | Inline skill tag on each message (agent-only) | 0.5d | Which skill was practiced |
| N3 | Tree-shake unused UI from production bundle | 0.5d | |

---

## 📊 Summary

| Phase | Priority | Remaining | Est. |
|-------|----------|-----------|------|
| **Phase 0** Full UI | 🔴 Critical | 13 sub-tasks (0.8–0.14) | **6d** |
| **Phase 6** Testing gaps | 🔴 Critical | 5 items (6.1.1–6.1.5) | **10d** |
| **Phase 2** Agent | 🟡 Important | 2 items (2.2, 2.4) | **6d** |
| **Phase 3** Geometry | 🟡 Important | 3 items | **13d** |
| **Phase 4** Voice | 🟡 Important | 3 items | **9d** |
| **Phase 5** Platform | 🟢 Nice | 4 items | **9d** |
| **Phase 6** Add-ons | 🟢 Nice | 7 items | **7.5d** |

**Critical path:** 0.8 Composer layout (2d) → 0.9 English chrome (1d) → 0.10 Shell polish (1d) → 0.11 Chat UX (1d) → 0.12–0.14 (1d) → Phase 6 gaps (10d)  
**Next immediate step:** 0.8a (flatten VoiceControls fragment)
