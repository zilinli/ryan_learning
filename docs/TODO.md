# 📋 Downstream Development TODO

> Version 0.3 · 2026-08-03  
> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have  
> Baseline: 24 test files, 220 tests, service `active` at :3000

---

## ✅ Completed

### Phase 0: 极简 UI

- [x] **0.1** Remove all UI chrome (GitHub link, large logo, "New chat" btn — hamburger + voice in header)
- [x] **0.2** Mobile-first: 375px target, 44px touch targets, 18px/16px font, auto-expand textarea (1→4 lines)
- [x] **0.3** Photo-first: camera button = primary, upload = icon-only (paperclip SVG)
- [x] **0.4** Singapore bar-model diagram type: `bar` shape + `draw_geometry` tool
- [x] **0.5** BASIS G5 textbook problem templates in `prompts.ts`
- [x] **0.6** Multi-lingual word-problem parsing: `detectLanguage()`, `inferSkillsFromTextMultiLang()`, `isWordProblem()`
- [x] **0.7** Zero-login session persistence (URL-param based, localStorage-backed)

### Phase 1: Memory Module (all done)

- [x] **1.1** SM-2 forgetting decay: `Sm2State`, `applySm2Decay()`, `sm2Update()`, `outcomeToSm2Quality()` — 9 tests
- [x] **1.2** Prerequisite-aware selection: `prerequisitesSatisfied()` (≥60% threshold)
- [x] **1.3** Recall cache: `storeRecallCache()`/`loadRecallCache()` (5min TTL)
- [x] **1.4** ZPD scoring: `zpdScore()` (Gaussian peak at 0.7), `pSolve()`, `jointPSolve()`, `zpdWarmUpSkills()` — 14 tests
- [x] **1.5** Confidence-weighted BKT: high-conf wrong → double penalty; low-conf correct → dampened gain
- [x] **1.6** Elo-hybrid difficulty tracking: `eloUpdate()`, `difficultyAdjustedBktParams()` — 7 tests

### Phase 2: Agent & Prompt (partial)

- [x] **2.1** Subject-specific coaching templates (math / reading / science / writing hint ladders)
- [x] **2.3** Progressive disclosure of answer: `~~~step` fences, click-to-reveal
- [ ] **2.2** Multi-turn task planning for worksheets
- [ ] **2.4** Capture and replay student reasoning chains (L1.5 "why" answers)

### Phase 6: Testing (partial)

- [x] **6.1.6** Engagement tests — 13 tests (streak, badges, summary, serialization)
- [x] **6.2.1–6.2.6** Unit tests for SM-2, ZPD, confidence, Elo, bar models, multi-lingual — all in `bkt.test.ts` + `skill-catalog.test.ts`

### Quick Wins (done)

- [x] Dark mode toggle (`DarkToggle` in TutorShell header)
- [x] Keyboard shortcut: Shift+Enter = newline, Enter = send
- [x] `test:ci` + `coverage` scripts in `package.json`

---

## 🔴 Phase 0: Composer UI (BLOCKING — 3.5d remaining)

> **Current state:** `VoiceControls` still nested `flex-col` inside toolbar; Chinese camera labels still present; toolbar wraps on phone.  
> **Full spec:** [subsystems/ui-composer.md](subsystems/ui-composer.md)

| # | Task | Effort | Files | Details |
|---|------|--------|-------|---------|
| **0.8** | **Composer cross-device layout** | **2d** | | |
| 0.8a | Flatten VoiceControls into single toolbar row | 0.5d | `VoiceControls.tsx` | Remove `flex-col` wrapper; mic + speak + voice-select as siblings in parent toolbar; status/hints render below composer card |
| 0.8b | Phone layout (390×844 — iPhone / 360×780 — Huawei) | 0.5d | `Composer.tsx` | One-row toolbar, no-wrap; camera shows `Photo`; voice picker in popover/sheet, not inline; 44×44px hit targets; safe-area bottom padding |
| 0.8c | Tablet layout (768×1024 iPad / MatePad) | 0.5d | `Composer.tsx` | Camera shows `Snap homework`; hold-to-talk when fine pointer, tap when coarse; compact voice `<select>` or popover (never force second row) |
| 0.8d | Desktop layout (≥1024px PC) | 0.25d | `Composer.tsx`, `VoiceControls.tsx` | All text labels visible; voice `<select>` inline with English options; hover states on icon buttons; Enter send / Shift+Enter newline |
| **0.9** | **English UI chrome** | **1d** | | |
| 0.9a | English voice labels + picker options | 0.5d | `voices.ts` | `Ava · English ♀`, `Ryan · English ♂`, `Yunxi · Mandarin ♂`, `WanLung · Cantonese ♂`, `Álvaro · Español ♂`, `Jorge · Español MX ♂`; auto-hint: `Auto · Chinese defaults to Cantonese` |
| 0.9b | English action labels + aria/hints | 0.5d | `Composer.tsx`, `VoiceControls.tsx` | Camera: `Photo` (phone) / `Snap homework` (tablet/desktop); Mic: `Hold to talk` (fine pointer) / `Mic` (coarse); Speak: `Speak on` / `Speak off`; Attach: icon-only `title="Upload file"`; Send: `Send` / `Thinking…` |
| **0.10** | **Device QA checklist** | **0.5d** | | Per ui-composer.md §9 |
| 0.10a | Phone QA | 0.25d | Manual | iPhone 14 (390×844), Huawei (360×780): toolbar 1 row, no Chinese chrome, Send always visible, keyboard-open safe-area, TTS gesture-gated |
| 0.10b | Tablet + Desktop QA | 0.25d | Manual | iPad portrait (768×1024) + landscape (1024×768), PC (1280×800): `Snap homework` label, no stacked controls, full labels + inline voice on desktop, Enter sends |

---

## 🔴 Phase 6: Testing Gaps (5 items, ~10d)

| # | Task | Effort | Risk | Notes |
|---|------|--------|------|-------|
| **6.1.1** | `cursor-agent.ts` unit tests | 2d | Core AI layer untested | Mock Cursor SDK: agent creation, prompt invocation, error handling, retry, cancellation |
| **6.1.2** | `speech-player.ts` unit tests | 2d | TTS queue bugs break voice | Mock Web Audio API: queue management, abort/cancel, autoplay on mobile, fallback on error |
| **6.1.3** | `history-sync.ts` unit tests | 1d | Data loss risk | Sync conflicts, merge resolution, partial sync, corrupted data recovery |
| **6.1.4** | `chat/route.ts` unit tests | 2d | Main endpoint untested | Mock Cursor Agent: prompt assembly, memory merge, error codes (400/500), streaming validation |
| **6.1.5** | React component tests | 3d | Zero UI coverage | `@testing-library/react` + jsdom: TutorShell (message send), Composer (photo upload, keyboard), MarkdownMessage (diagram render), 375px layout |

---

## 🟡 Phase 2: Agent & Prompt (2 items, ~6d)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 2.2 | Multi-turn task planning for worksheets | 3d | Agent | When student uploads a worksheet photo, agent plans: Q1→Q2→Q3 before starting |
| 2.4 | Capture and replay student reasoning chains | 3d | `learning-memory.ts` | Store L1.5 "why" answers as reasoning examples; replay for analogous problems |

---

## 🟡 Phase 3: Geometry & Visualization (3 items, ~13d)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 3.1 | Interactive geometry: drag to measure | 5d | `DiagramBlock.tsx`, SVG | Click/drag rulers, angle measures on geometry diagrams |
| 3.2 | Animated step-by-step geometry constructions | 3d | `geometry-svg.ts` | Animate triangle construction, angle bisector, perpendicular line |
| 3.3 | Desmos-like graphing for algebra | 5d | New component | Coordinate plane with point plotting, line drawing |

---

## 🟡 Phase 4: Voice & Multi-Modal (3 items, ~9d)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 4.1 | Voice-only mode (no screen needed) | 5d | `speech-player.ts`, `Composer.tsx` | Full voice loop: STT→agent→TTS→STT |
| 4.2 | Arabic numerals read naturally in all languages | 1d | `tts-text.ts` | `x²` → "x squared" in EN, "x 平方" in ZH/Yue; `½` → "one half" |
| 4.3 | Parent voice note recording | 3d | New component | Parent records a voice message attached to chat for Ryan |

---

## 🟢 Phase 5: Platform & DevOps (4 items, ~9d)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 5.1 | PWA install + offline mode | 3d | `layout.tsx`, service worker | Cache app shell, offline-capable chat history |
| 5.2 | Docker deployment | 2d | Dockerfile | Single-container deploy with health check |
| 5.3 | Automated BKT parameter tuning from logs | 3d | `bkt.ts` | Batch-fit `pLearn`, `pSlip`, `pGuess` from history JSON |
| 5.4 | Error telemetry (Sentry or custom) | 2d | Agent, API | Track agent failures, TTS timeouts, STT errors |

---

## 🟢 Other Testing (5 items, ~6d)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.2.5 | Singapore bar model render tests | 1d | Horizontal/vertical bars, comparison/part-whole, label positioning |
| 6.2.7 | Photo-first workflow tests | 1d | Image resize, format conversion, MIME detection, corrupt image, IndexedDB |
| 6.2.9 | Progressive disclosure UI tests | 0.5d | Click-to-reveal transitions, reveal-all, keyboard accessibility |
| 6.3.1–6.3.4 | API route unit tests (4 routes) | 2d | `learning/`, `history/`, `tts/`+`transcribe/`, `media/[mediaId]/` |
| 6.4.1+6.4.3+6.4.4 | CI/CD: GitHub Actions + coverage threshold + pre-commit | 2d | `npm test` + `npm run build` on push/PR; 70% `src/lib/` threshold; `tsc --noEmit` + `eslint` |

---

## 🟢 Nice-to-Have

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1.7 | Memory visualization dashboard (parent view) | 5d | Skill radar chart, mastery timeline, struggle heatmap — NOT visible to child |
| N1 | Export learning memory as printable PDF | 1d | For parent review |
| N2 | Inline skill tag on each message | 0.5d | Agent-only, not child-visible — which skill was practiced |
| N3 | Tree-shake unused UI from production bundle | 0.5d | Remove unused icons, fonts from build |

---

## 📊 Summary

| Phase | Done | Remaining | Est. Time |
|-------|------|-----------|-----------|
| **Phase 0** UI | 0.1–0.7 | 0.8, 0.9, 0.10 | ~3.5d |
| **Phase 1** Memory | 1.1–1.6 | 1.7 (nice-to-have) | ~5d |
| **Phase 2** Agent | 2.1, 2.3 | 2.2, 2.4 | ~6d |
| **Phase 3** Geometry | — | 3.1–3.3 | ~13d |
| **Phase 4** Voice | — | 4.1–4.3 | ~9d |
| **Phase 5** Platform | — | 5.1–5.4 | ~9d |
| **Phase 6** Testing | 6.1.6, 6.2.1–6 | gaps + add-ons | ~16d |

**Critical path (next sprints):** Phase 0 (3.5d) → Phase 6 critical gaps (6.1.1–5, 10d) → Phase 2 (6d)  
**Immediate next step:** 0.8a (flatten VoiceControls) + 0.9a (English voice labels)
