# 📋 Downstream Development TODO

> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have

---

## Phase 0: 极简 UI & 课程对齐 (🔴 — Foundation)

> **最高原则：界面简单易用，小学生 0 基础上手。对话是重点，极简风格。**

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 0.1 | 🔴 Remove all UI chrome beyond chat + voice + sidebar toggle | 2d | `TutorShell.tsx`, `Composer.tsx` | No dashboard, no progress bars, no settings beyond voice selector; verify: "would a physical tutor have this?" |
| 0.2 | 🔴 Mobile-first responsive: 375px target, 16px+ base font, 24px+ input text | 2d | All components | Reference: Khan Academy mobile, 豆包爱学; test on iPhone SE screen size |
| 0.3 | 🔴 Photo-first workflow: one-tap camera → OCR/NLP → agent | 3d | `Composer.tsx`, `photo-vault.ts`, Agent | Inspired by 豆包爱学 拍照搜题; Ryan snaps worksheet → "帮我看看这道题" → agent infers problem + question |
| 0.4 | 🟡 Singapore bar-model diagram type in `draw_geometry` | 3d | `geometry-svg.ts`, `tutor-harness.ts` | Bar-model shape type: horizontal/vertical bars with labels, comparison models, part-whole models |
| 0.5 | 🟡 BASIS G5 textbook problem templates | 2d | `prompts.ts`, Agent | Pre-load Envision Math G5 topic list; agent generates G5-appropriate problem difficulty |
| 0.6 | 🟡 Multi-lingual word-problem parsing (EN + 中文) | 2d | `skill-catalog.ts`, Agent | Detect and preserve language in word problems; agent responds in same language as question |
| 0.7 | 🟡 Zero-login session persistence (URL-param-based) | 1d | `storage.ts`, `TutorShell.tsx` | No auth flow; session ID in URL query param → localStorage; cross-device via URL sharing |

---

## Phase 1: Memory Module Depth (🔴)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 1.1 | 🔴 Add SM-2 forgetting decay to BKT skills | 3d | `bkt.ts`, `learning-memory.ts` | Reference: [x1ee7/sm2-spaced-repetition](https://github.com/x1ee7/sm2-spaced-repetition); decay `pKnown` by days since last review |
| 1.2 | 🔴 Implement prerequisite-aware warm-up selection | 2d | `skill-catalog.ts` | When starting a new session, pick weakest skill whose prerequisites are ≥ 60% |
| 1.3 | 🔴 Store `recall_learner_skills` tool results in prompt context snippet | 1d | `prompts.ts`, `tutor-harness.ts` | Cache the last tool call result in `learningMemoryPromptLines` so agent doesn't need to call the tool every turn |
| 1.4 | 🔴 Add ZPD-based problem difficulty recommendation | 2d | `bkt.ts` | Compute `P(solve)` per skill; recommend skills closest to 0.7 (zone of proximal development). Reference: [bkt.tyche.institute pipeline](https://bkt.tyche.institute/en/06-reference/01-pipeline-overview/) |
| 1.5 | 🟡 Confidence-weighted BKT updates | 1d | `learning-memory.ts` | High confidence + wrong answer → larger slip penalty; low confidence + correct → smaller gain |
| 1.6 | 🟡 Add item difficulty tracking (Elo-hybrid per topic) | 3d | `bkt.ts`, `learning-memory.ts` | Track conversation-turn difficulty as Elo score; adjust `pGuess`/`pSlip` per turn difficulty. Reference: Pelánek (2016) |
| 1.7 | 🟢 Memory visualization dashboard (parent view) | 5d | `SkillsPanel.tsx` | Standalone page showing: skill radar chart, mastery timeline, struggle heatmap |

## Phase 2: Agent & Prompt Refinement (🟡)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 2.1 | 🟡 Add subject-specific coaching templates | 2d | `prompts.ts`, `AGENTS.md` | Separate prompt sections for math / reading / science / writing with subject-specific hint ladders |
| 2.2 | 🟡 Implement multi-turn task planning | 3d | Agent | When student uploads a worksheet, agent plans a sequence: Q1→Q2→Q3 before starting |
| 2.3 | 🟡 Progressive disclosure of answer (step-by-step reveal) | 2d | Agent, `MarkdownMessage.tsx` | Click-to-reveal each step instead of blocking all at once |
| 2.4 | 🟡 Capture and replay student reasoning chains | 3d | `learning-memory.ts` | Store "why" answers (L1.5 responses) as reasoning examples for future reference |

## Phase 3: Geometry & Visualization (🟡)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 3.1 | 🟡 Interactive geometry: drag to measure | 5d | `DiagramBlock.tsx`, SVG | Click/drag rulers, angle measures on geometry diagrams |
| 3.2 | 🟡 Animated step-by-step geometry constructions | 3d | `geometry-svg.ts` | Animate triangle construction, angle bisector, perpendicular line |
| 3.3 | 🟢 Add Desmos-like graphing for algebra | 5d | New component | Coordinate plane with point plotting, line drawing |

## Phase 4: Voice & Multi-Modal (🟢)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 4.1 | 🟢 Voice-only mode (no screen needed) | 5d | `speech-player.ts`, `Composer.tsx` | Full voice conversation loop: STT→agent→TTS→STT |
| 4.2 | 🟢 Arabic numerals read naturally in all languages | 1d | `tts-text.ts` | `$x^2$` → "x squared" in EN, "x 平方" in ZH/Yue |
| 4.3 | 🟢 Parent voice note recording | 3d | New component | Parent records a voice message attached to chat for Ryan |

## Phase 5: Platform & DevOps (🟢)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 5.1 | 🟢 PWA install + offline mode | 3d | `layout.tsx`, service worker | Cache app shell, offline-capable chat history |
| 5.2 | 🟢 Docker deployment | 2d | Dockerfile | Single-container deploy with health check |
| 5.3 | 🟢 Automated BKT parameter tuning from logs | 3d | `bkt.ts` | Batch-fit `pLearn`, `pSlip`, `pGuess` from history JSON |
| 5.4 | 🟢 Error telemetry (Sentry or custom) | 2d | Agent, API | Track agent failures, TTS timeouts, STT errors |

---

## Phase 6: Testing Infrastructure & Coverage (🔴 — Quality Gate)

> 目标: 每行代码都有测试守护。每个生产 bug 都有回归测试。

### 6.1 Existing Coverage Gaps (🔴 — Critical)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 6.1.1 | 🔴 Add unit tests for `cursor-agent.ts` (SDK wrapper) | 2d | `cursor-agent.ts`, vitest | Mock Cursor SDK; test agent creation, prompt invocation, error handling, retry, cancellation |
| 6.1.2 | 🔴 Add unit tests for `speech-player.ts` (browser TTS queue) | 2d | `speech-player.ts`, jsdom | Mock Web Audio API; test queue management, abort/cancel, autoplay on mobile, fallback on error |
| 6.1.3 | 🔴 Add unit tests for `history-sync.ts` (multi-device sync) | 1d | `history-sync.ts` | Test sync conflicts, merge resolution, partial sync, corrupted data recovery |
| 6.1.4 | 🔴 Add unit tests for `chat/route.ts` (core SSE endpoint) | 2d | `app/api/chat/route.ts` | Mock Cursor Agent; test prompt assembly, memory merge in-route, error codes (400/500), streaming chunk validation |
| 6.1.5 | 🔴 Add React component tests (TutorShell, Composer, MarkdownMessage) | 3d | `@testing-library/react`, jsdom | Test message send (Enter), photo upload (click camera), diagram rendering (img presence), mobile layout (375px), voice record toggle |
| 6.1.6 | 🔴 Add unit tests for `engagement.ts` (streak/badge logic) | 1d | `engagement.ts` | Test streak continuity (consecutive days), streak reset (missed day), badge unlocking (3-day/7-day/10-turns/50-turns), daily reset at midnight |

### 6.2 Coverage for Planned Features (🟡 — Write Tests Before/During Implementation)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 6.2.1 | 🟡 Tests for SM-2 forgetting decay | 1d | `bkt.test.ts`, Phase 1.1 | Decay curve correctness, ease-factor clamping [1.3, ∞), days-since-review weighting, boundary: never-reviewed skill |
| 6.2.2 | 🟡 Tests for ZPD-based scoring | 1d | `bkt.test.ts`, Phase 1.4 | P(solve) computation, geo-mean joint, closeness-to-target scoring, boundary: skills at 0%/100% |
| 6.2.3 | 🟡 Tests for confidence-weighted BKT updates | 0.5d | `learning-memory.test.ts`, Phase 1.5 | High-conf + wrong → large penalty, low-conf + correct → small gain, confidence=null → default behavior |
| 6.2.4 | 🟡 Tests for Elo-hybrid difficulty tracking | 1d | `bkt.test.ts`, Phase 1.6 | Elo update correctness, dynamic K-value, difficulty→BKT param mapping, boundary: new topic (default Elo) |
| 6.2.5 | 🟡 Tests for Singapore bar-model diagrams | 1d | `geometry-svg.test.ts`, Phase 0.4 | Horizontal/vertical bars, comparison models, part-whole models, label positioning, overflow with many bars |
| 6.2.6 | 🟡 Tests for multi-lingual word-problem parsing | 0.5d | `skill-catalog.test.ts`, Phase 0.6 | EN+ZH mixed detection, language preservation, code-switching in single message |
| 6.2.7 | 🟡 Tests for photo-first workflow | 1d | `image-process.test.ts` (new), Phase 0.3 | Image resize to max dimensions, format conversion, MIME detection, corrupt image handling, IndexedDB read/write for photo cache |
| 6.2.8 | 🟡 Tests for voice-only mode | 1d | `speech-player.test.ts`, Phase 4.1 | Full voice loop: STT→agent→TTS→STT, abort mid-conversation, silence detection (end of turn), mobile autoplay permission |
| 6.2.9 | 🟡 Tests for progressive disclosure UI | 0.5d | Component test, Phase 2.3 | Click-to-reveal step transitions, reveal-all option, keyboard accessibility |
| 6.2.10 | 🟡 Tests for PWA offline mode | 1d | E2E test, Phase 5.1 | Offline page load, cached chat history display, re-sync on reconnect, stale-data handling |

### 6.3 API Route Tests (🟡)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 6.3.1 | 🟡 Route unit tests for `learning/route.ts` | 0.5d | vitest, mock FS | Test GET (empty server), PUT (valid/invalid body), cross-session persistence, max memory size guard |
| 6.3.2 | 🟡 Route unit tests for `history/route.ts` | 0.5d | vitest, mock FS | Test GET (list), PUT (upsert), DELETE, search, stats, max conversation limit enforcement |
| 6.3.3 | 🟡 Route unit tests for `tts/route.ts` + `transcribe/route.ts` | 0.5d | vitest, mock Edge TTS | Test error responses, missing body, unsupported language, timeout handling |
| 6.3.4 | 🟡 Route unit tests for `media/[mediaId]/route.ts` | 0.5d | vitest, mock FS | Test GET (valid/invalid mediaId), content-type header, missing file 404, path traversal guard |

### 6.4 CI/CD (🟢)

| # | Task | Effort | Dependencies | Notes |
|---|------|--------|-------------|-------|
| 6.4.1 | 🟢 GitHub Actions CI: unit + build | 1d | `.github/workflows/ci.yml` | Run `npm test` + `npm run build` on every push/PR; fail on lint errors |
| 6.4.2 | 🟢 GitHub Actions CI: integration (self-hosted) | 1d | Self-hosted runner | Run `verify:all` on self-hosted runner with access to local STT/TTS services; nightly cron job |
| 6.4.3 | 🟢 Vitest coverage reporter (text + html) | 0.5d | `vitest.config.ts` | Add `coverage: { provider: 'v8', reporter: ['text', 'html'] }`; enforce 70% threshold for CI |
| 6.4.4 | 🟢 Pre-commit hook: lint + typecheck | 0.5d | husky, lint-staged | `tsc --noEmit` + `eslint` before each commit; skip on CI (already covered) |

---

## Quick Wins (< 1 day each)

- [ ] Add "last practiced" timestamp to SkillsPanel UI
- [ ] Export learning memory as printable PDF for parent review
- [ ] Add "suggest a topic" button based on weakest skill (but hidden: only for parent mode, not visible to child)
- [ ] Inline skill tag display on each message (which skill was practiced) — agent-only, not child-visible
- [ ] Keyboard shortcut: `Ctrl+Enter` to send (already Enter; add `Shift+Enter` for newline → swap)
- [ ] Add dark mode support
- [ ] Remove all unused UI elements from production bundle (tree-shake unused icons, fonts)
- [ ] Reduce input box height on mobile to 44px touch target (single-line until multi-line expands)
- [ ] Add 豆包爱学-style "拍题" hint on camera button: "拍下题目，我来帮你"
- [ ] Run `vitest --coverage` and add HTML report to `.gitignore`; enforce >70% for `src/lib/`
- [ ] Add `test:ci` script that runs vitest with junit reporter for CI integration
