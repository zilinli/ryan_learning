# 📋 Downstream Development TODO

> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have  
> ✅ = done this round (commit: to be pushed)

---

## ✅ Completed (this round — 2026-08-03)

### Phase 0: 极简 UI

- [x] **0.1** Remove all UI chrome (GitHub link, large logo, "New chat" btn — hamburger + voice in header)
- [x] **0.2** Mobile-first: 375px target, 44px touch targets, 18px/16px font, auto-expand textarea (1→4 lines)
- [x] **0.3** Photo-first: camera button = primary, upload = icon-only (paperclip SVG) — English label pending **0.9**
- [x] **0.4** Singapore bar-model diagram type: `bar` shape with label, quantityLabel, dashed, fill/stroke

### Phase 1: Memory Module Depth

- [x] **1.1** SM-2 forgetting decay: `Sm2State`, `applySm2Decay()`, `sm2Update()`, `outcomeToSm2Quality()` — 9 tests
- [x] **1.2** Prerequisite-aware selection: `prerequisitesSatisfied()` (≥60% threshold), integrated into warm-up
- [x] **1.3** Recall cache: `storeRecallCache()`/`loadRecallCache()` with 5min TTL, invalidated on new turn
- [x] **1.4** ZPD scoring: `zpdScore()` (Gaussian peak at 0.7), `pSolve()`, `jointPSolve()`, `zpdWarmUpSkills()` — 14 tests
- [x] **1.5** Confidence-weighted BKT: high-conf wrong → double penalty; low-conf correct → dampened gain

### Phase 6: Testing

- [x] **6.1.6** `engagement.test.ts` — 13 tests (streak, badges, summary, prompt serialization)

### Quick Wins

- [x] Keyboard shortcut: Shift+Enter = newline, Enter = send
- [x] Reduce input box to 44px touch target (single-line, auto-expand to 4 lines)
- [x] ~~豆包爱学-style camera hint: "拍下题目，我来帮你"~~ → superseded by **0.9** English chrome (`Photo` / `Snap homework`)
- [x] `test:ci` + `coverage` scripts in `package.json`
- [x] `__pycache__/` in `.gitignore`

---

## Phase 0: 极简 UI & 课程对齐 (剩余)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 0.5 | ✅ BASIS G5 textbook problem templates | 2d | `prompts.ts`, Agent | Pre-load Envision Math G5 topic list; agent generates G5-appropriate problem difficulty |
| 0.6 | ✅ Multi-lingual word-problem parsing (EN + 中文) | 2d | `skill-catalog.ts`, Agent | `detectLanguage()`, `inferSkillsFromTextMultiLang()`, `isWordProblem()` — HK cantonese detection |
| 0.7 | ✅ Zero-login session persistence (URL-param-based) | 1d | `storage.ts`, `TutorShell.tsx` | URL query param → localStorage; cross-device via URL sharing |
| **0.8** | **🔴 Composer cross-device layout** | **2d** | `Composer.tsx`, `VoiceControls.tsx` | Spec: [ui-composer.md](subsystems/ui-composer.md) |
| 0.8a | 🔴 Flatten VoiceControls into single toolbar row | 0.5d | `VoiceControls.tsx` | Remove `flex-col` wrapper; mic + speak + voice-select all siblings in toolbar; status/hints below composer |
| 0.8b | 🔴 Phone layout: one-row toolbar, no-wrap | 0.5d | `Composer.tsx` | 390×844 target; camera shows `Photo` (not Chinese); voice picker in popover/sheet; `44×44px` hit targets |
| 0.8c | 🟡 Tablet layout: richer labels | 0.5d | `Composer.tsx` | 768×1024 portrait; camera `Snap homework`; hold-to-talk fine pointer, tap coarse |
| 0.8d | 🟡 Desktop layout: full inline voice select | 0.25d | `Composer.tsx`, `VoiceControls.tsx` | ≥1024px; all text labels visible; voice `<select>` inline; Enter send / Shift+Enter newline |
| **0.9** | **🔴 English UI chrome** | **0.5d** | `voices.ts`, `VoiceControls.tsx` | All visible chrome in English only |
| 0.9a | 🔴 English voice labels | 0.25d | `voices.ts` | `Ava · English ♀`, `Ryan · English ♂`, `Yunxi · Mandarin ♂`, `WanLung · Cantonese ♂` etc. |
| 0.9b | 🔴 English action labels + hints | 0.25d | `Composer.tsx`, `VoiceControls.tsx` | Camera: `Photo`/`Snap homework`; Mic: `Hold to talk`/`Mic`; Speak: `Speak on`; Voice: `Auto · Chinese → Cantonese` |
| **0.10** | **🟡 Device QA checklist** | **0.5d** | 0.8, 0.9 | Per ui-composer.md §9 |
| 0.10a | 🟡 Phone QA: iPhone 14 (390×844), Huawei (360×780) | 0.25d | Manual | Toolbar 1 row; no Chinese chrome; Send visible; keyboard-open safe-area; TTS gesture-gated |
| 0.10b | 🟡 Tablet + Desktop QA: iPad (768/1024), PC (1280×800) | 0.25d | Manual | Tablet: `Snap homework` label, no stacked controls; Desktop: full labels + inline voice, Enter sends |

---

## Phase 1: Memory Module Depth (剩余)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 1.6 | ✅ Add item difficulty tracking (Elo-hybrid per topic) | 3d | `bkt.ts`, `learning-memory.ts` | Track conversation-turn difficulty as Elo score; adjust `pGuess`/`pSlip` per turn difficulty. Reference: Pelánek (2016) |
| 1.7 | 🟢 Memory visualization dashboard (parent view) | 5d | `SkillsPanel.tsx` | Standalone page: skill radar chart, mastery timeline, struggle heatmap; NOT visible to child |

---

## Phase 2: Agent & Prompt Refinement (all pending)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 2.1 | ✅ Add subject-specific coaching templates | 2d | `prompts.ts`, `AGENTS.md` | Separate prompt sections for math / reading / science / writing with subject-specific hint ladders |
| 2.2 | 🟡 Implement multi-turn task planning | 3d | Agent | When student uploads a worksheet, agent plans a sequence: Q1→Q2→Q3 before starting |
| 2.3 | ✅ Progressive disclosure of answer (step-by-step reveal) | 2d | Agent, `MarkdownMessage.tsx` | Click-to-reveal each step via `~~~step` fences |
| 2.4 | 🟡 Capture and replay student reasoning chains | 3d | `learning-memory.ts` | Store "why" answers (L1.5 responses) as reasoning examples for future reference |

---

## Phase 3: Geometry & Visualization (all pending)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 3.1 | 🟡 Interactive geometry: drag to measure | 5d | `DiagramBlock.tsx`, SVG | Click/drag rulers, angle measures on geometry diagrams |
| 3.2 | 🟡 Animated step-by-step geometry constructions | 3d | `geometry-svg.ts` | Animate triangle construction, angle bisector, perpendicular line |
| 3.3 | 🟢 Add Desmos-like graphing for algebra | 5d | New component | Coordinate plane with point plotting, line drawing |

---

## Phase 4: Voice & Multi-Modal (all pending)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 4.1 | 🟢 Voice-only mode (no screen needed) | 5d | `speech-player.ts`, `Composer.tsx` | Full voice conversation loop: STT→agent→TTS→STT |
| 4.2 | 🟢 Arabic numerals read naturally in all languages | 1d | `tts-text.ts` | `$x^2$` → "x squared" in EN, "x 平方" in ZH/Yue |
| 4.3 | 🟢 Parent voice note recording | 3d | New component | Parent records a voice message attached to chat for Ryan |

---

## Phase 5: Platform & DevOps (all pending)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 5.1 | 🟢 PWA install + offline mode | 3d | `layout.tsx`, service worker | Cache app shell, offline-capable chat history |
| 5.2 | 🟢 Docker deployment | 2d | Dockerfile | Single-container deploy with health check |
| 5.3 | 🟢 Automated BKT parameter tuning from logs | 3d | `bkt.ts` | Batch-fit `pLearn`, `pSlip`, `pGuess` from history JSON |
| 5.4 | 🟢 Error telemetry (Sentry or custom) | 2d | Agent, API | Track agent failures, TTS timeouts, STT errors |

---

## Phase 6: Testing Infrastructure & Coverage (mostly pending)

> 验收状态: 24 files · 197 tests · build ✅ · 1/24 testing tasks done

### 6.1 Existing Coverage Gaps (🔴 — 1/6 done)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.1.1 | 🔴 `cursor-agent.ts` unit tests | 2d | Mock Cursor SDK; agent creation, prompt invocation, error handling, retry, cancellation |
| 6.1.2 | 🔴 `speech-player.ts` unit tests | 2d | Mock Web Audio API; queue management, abort/cancel, autoplay on mobile, fallback on error |
| 6.1.3 | 🔴 `history-sync.ts` unit tests | 1d | Sync conflicts, merge resolution, partial sync, corrupted data recovery |
| 6.1.4 | 🔴 `chat/route.ts` unit tests | 2d | Mock Cursor Agent; prompt assembly, memory merge, error codes (400/500), streaming validation |
| 6.1.5 | 🔴 React component tests (TutorShell, Composer, MarkdownMessage) | 3d | `@testing-library/react`, jsdom; message send, photo upload, diagram rendering, 375px layout |
| ~~6.1.6~~ | ~~`engagement.ts` tests~~ | ~~已 ✅~~ | 13 tests: streak continuity/reset, badge unlocking, summary, prompt serialization |

### 6.2 Tests for Planned Features (🟡 — 0/10 done)

| # | Task | Effort | Phase | Notes |
|---|------|--------|-------|-------|
| 6.2.1 | ✅ Tests for SM-2 decay | 1d | Phase 1.1 | ✅ already covered by `bkt.test.ts` (9 tests) — still need decay-on-load integration test |
| 6.2.2 | ✅ Tests for ZPD scoring | 1d | Phase 1.4 | ✅ already covered by `bkt.test.ts` (14 tests) — still need `zpdWarmUpSkills` unit test |
| 6.2.3 | ✅ Tests for confidence-weighted BKT | 0.5d | Phase 1.5 | ✅ logic tested in `bkt.test.ts` — still need end-to-end: high-conf→penalty verified through `recordLearningTurnMemory` |
| 6.2.4 | ✅ Tests for Elo-hybrid difficulty | 1d | Phase 1.6 | 7 tests: Elo update (correct/incorrect/practice), dynamic K, clamping, difficultyAdjustedBktParams |
| 6.2.5 | 🟡 Tests for Singapore bar models | 1d | Phase 0.4 | Horizontal/vertical bars, comparison/part-whole, label positioning, overflow — render output validation |
| 6.2.6 | ✅ Tests for multi-lingual word-problem | 0.5d | Phase 0.6 | 6 tests: detectLanguage (EN/ZH-CN/ZH-HK/mixed), inferSkillsFromTextMultiLang, isWordProblem |
| 6.2.7 | 🟡 Tests for photo-first workflow | 1d | Phase 0.3 | Image resize, format conversion, MIME detection, corrupt image, IndexedDB read/write |
| 6.2.8 | 🟡 Tests for voice-only mode | 1d | Phase 4.1 | STT→agent→TTS→STT loop, abort mid-conversation, silence detection |
| 6.2.9 | 🟡 Tests for progressive disclosure UI | 0.5d | Phase 2.3 | Click-to-reveal transitions, reveal-all, keyboard accessibility |
| 6.2.10 | 🟡 Tests for PWA offline mode | 1d | Phase 5.1 | Offline load, cached history, re-sync, stale-data handling |

### 6.3 API Route Tests (🟡 — 0/4 done)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.3.1 | 🟡 `learning/route.ts` | 0.5d | GET (empty), PUT (valid/invalid), cross-session persistence, max memory guard |
| 6.3.2 | 🟡 `history/route.ts` | 0.5d | GET (list), PUT (upsert), DELETE, search, stats, max conversation limit |
| 6.3.3 | 🟡 `tts/` + `transcribe/route.ts` | 0.5d | Error responses, missing body, unsupported language, timeout |
| 6.3.4 | 🟡 `media/[mediaId]/route.ts` | 0.5d | GET (valid/invalid mediaId), content-type, missing 404, path traversal |

### 6.4 CI/CD (🟢 — 0/4 done)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 6.4.1 | 🟢 GitHub Actions CI: unit + build | 1d | `npm test` + `npm run build` on push/PR |
| 6.4.2 | 🟢 GitHub Actions CI: integration (self-hosted) | 1d | `verify:all` on self-hosted runner; nightly cron |
| 6.4.3 | 🟢 Vitest coverage: text + html reporter | 0.5d | Enforce 70% threshold for `src/lib/` |
| 6.4.4 | 🟢 Pre-commit hook: lint + typecheck | 0.5d | `tsc --noEmit` + `eslint` before commit |

---

## Quick Wins (< 1 day each)

- [x] Add "last practiced" timestamp to SkillsPanel UI
- [ ] Export learning memory as printable PDF for parent review
- [x] Add "suggest a topic" button based on weakest skill (hidden: parent mode only)
- [ ] Inline skill tag display on each message (which skill was practiced) — agent-only, not child-visible
- [x] Add dark mode support
- [ ] Remove all unused UI elements from production bundle (tree-shake unused icons, fonts)
- [x] ~~Reduce input box height on mobile to 44px touch target~~ (done — Phase 0.2)
- [x] ~~Add 豆包爱学-style "拍题" hint on camera button~~ (done — Phase 0.3; English copy → **0.9**)
- [x] ~~Keyboard shortcut: Shift+Enter for newline, Enter to send~~ (done)
- [x] ~~Run `vitest --coverage` and add HTML report~~ (done — `npm run coverage`)
- [x] ~~Add `test:ci` script with junit reporter~~ (done — `package.json`)
