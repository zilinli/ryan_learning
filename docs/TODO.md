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
| 0.10e | **Chat-first sidebar:** move SkillsPanel below chat list; collapsible strip (default closed, max 40% when open) | 0.5d | `HistorySidebar.tsx`, `SkillsPanel.tsx`, [ui-architecture §5.4–5.5](subsystems/ui-architecture.md) |

> **0.10e status (2026-08-04):** Implemented — SkillsPanel is a collapsed strip under the chat list; expand on tap.

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

## 🔴 Phase 7: Code Agent Reliability (10h)

> **Design:** [code-agent-reliability-design.md](code-agent-reliability-design.md)  
> **Spec:** [subsystems/code-agent-robustness.md](subsystems/code-agent-robustness.md)  
> **Current state:** Service crashes due to: port conflicts, SDK unhandledRejection, stale agent sessions, file write races, SSE silent drops.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 7.1 | **Port pre-flight check in `start.sh`** — kill existing on 3000/3001/8765 before launch | 0.5h | `start.sh` |
| 7.2 | **Pin `@cursor/sdk` ≥ 1.0.19** + add `process.on('unhandledRejection')` safety net | 1h | `package.json`, `cursor-agent.ts` |
| 7.3 | **Stale session detection + retry** — on bare `run.wait()` status:error, clear → resume fresh once | 2h | `cursor-agent.ts` |
| 7.4 | **Agent retry wrapper** — `executeWithRetry()` with exponential backoff (1s→2s→4s) + jitter for `CursorAgentError(isRetryable)` | 2h | new `src/lib/agent-retry.ts`, `cursor-agent.ts` |
| 7.5 | **Agent run log (JSONL)** — record agentId, runId, status, durationMs per call | 1h | new `src/lib/run-log.ts` |
| 7.6 | **Atomic file writes** — `lockedWriteJson()` with tmp+rename for `history-store.ts` and `learning-memory-store.ts` | 2h | new `src/lib/file-lock.ts`, `history-store.ts`, `learning-memory-store.ts` |
| 7.7 | **SSE heartbeat + event IDs** — 15s heartbeat during streaming + `id:` field for reconnect recovery | 1.5h | `chat/route.ts`, `agent-chat/.../chat/route.ts` |

---

## 🔴 Phase 8: Code Agent Mini Window UI (10h)

> **Design:** [subsystems/code-agent-mini-window.md](subsystems/code-agent-mini-window.md)  
> **Current state:** "Code Agent" button opens iframe to port 3001 → blank when service down; cannot close; no vibe coding. Real `MiniConsoleShell` component is orphaned (never wired).

| # | Task | Effort | Files |
|---|------|--------|-------|
| 8.1 | **Wire `MiniConsoleShell` → replace `AgentConsolePanel`** — rename to `CodeAgentPanel`, import in `TutorShell.tsx`, remove iframe approach | 2h | `MiniConsoleShell.tsx` → `CodeAgentPanel.tsx`, `TutorShell.tsx` |
| 8.2 | **Fix slide animation** — change `animate-slide-in-left` → `animate-slide-in-right` for right-side panels; add keyframe to `globals.css` | 0.5h | `CodeAgentPanel.tsx`, `globals.css` |
| 8.3 | **Close button always visible** — X button rendered in header unconditionally; body scroll lock when panel open; mobile backdrop tap + swipe-down close | 1.5h | `CodeAgentPanel.tsx` |
| 8.4 | **Empty state with guided hints** — show example prompts: "Make text bigger", "Add dark mode color", "Fix photo on mobile" | 1h | `CodeAgentPanel.tsx`, `MiniConsoleThread.tsx` |
| 8.5 | **Loading skeleton + tool status** — pulsing dots while agent initializes; badges for "Reading…", "Editing…", "Testing…" | 1.5h | `CodeAgentPanel.tsx`, `MiniConsoleThread.tsx` |
| 8.6 | **Error states** — friendly messages for: service down (retry), agent timeout, network error, no API key | 1h | `CodeAgentPanel.tsx` |
| 8.7 | **Thread improvements** — increase message truncation 300→500 chars; show 5 messages not 3; auto-scroll to bottom | 1h | `MiniConsoleThread.tsx` |
| 8.8 | **Session resume** — load previous messages from server session store on open; "New session" button | 1h | `CodeAgentPanel.tsx`, `console-session-store.ts` |
| 8.9 | **ACC "Open in tab" as fallback** — if port 3001 is reachable, show secondary link; otherwise hide | 0.5h | `CodeAgentPanel.tsx` |

---

## 🔴 Phase 9: STT Service Reliability (4h)

> **Design:** [subsystems/stt-service-reliability.md](subsystems/stt-service-reliability.md)  
> **Current state:** STT server crashes in loop (EADDRINUSE 6x consecutive); no process supervision; task queue depth warnings.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 9.1 | **systemd unit for STT server** — `Restart=on-failure`, `RestartSec=5`, `MemoryMax=2G`, `StartLimitBurst=6` | 1h | `/etc/systemd/system/spark-stt.service` |
| 9.2 | **Pre-flight port check + SIGTERM handler in Python** — kill existing on 8765; graceful shutdown on SIGTERM/SIGINT | 1h | `scripts/stt_server.py`, `start.sh` |
| 9.3 | **Sequential model loading with error isolation** — load Whisper first, then SenseVoice; continue if one fails | 0.5h | `scripts/stt_server.py` |
| 9.4 | **Enhanced /health endpoint** — add memory RSS, queue depth, model status per engine | 0.5h | `scripts/stt_server.py` |
| 9.5 | **STT health check script** — `health-stt.sh` for monitoring + startup dependency | 0.5h | new `scripts/health-stt.sh`, `start.sh` |
| 9.6 | **Whisper CPU perf tuning** — `beam_size=1` (single beam ~40% faster on CPU) | 0.5h | `scripts/stt_server.py` |

---

## 🔴 Phase 10: Reliability Tests (14h)

> **Design:** [code-agent-test-design.md](code-agent-test-design.md)  
> **Current state:** 0% test coverage on agent reliability paths, file concurrency, SSE encoding.

### 10.1 Unit Tests (6h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 10.1a | Agent session recovery tests — stale detection, retry count, backoff timing, TTL eviction | 2h | new `src/lib/__tests__/cursor-agent-reliability.test.ts` |
| 10.1b | Atomic file write tests — concurrency safety, crash recovery, tmp cleanup | 1.5h | new `src/lib/__tests__/history-store-atomic.test.ts` |
| 10.1c | Agent run log tests — append, getLast, replay, error rate calculation | 1h | new `src/lib/__tests__/run-log.test.ts` |
| 10.1d | SSE encode tests — event+data format, id field, heartbeat, special chars | 1h | new `src/lib/__tests__/sse-encode.test.ts` |
| 10.1e | File lock tests — serialized writes, different-file concurrency | 0.5h | `src/lib/__tests__/history-store-atomic.test.ts` |

### 10.2 Integration Tests (5h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 10.2a | Agent session recovery integration — stale session retry, rate limit backoff | 1.5h | new `scripts/verify-agent-recovery.mjs` |
| 10.2b | SSE reliability integration — heartbeat timing, reconnect with Last-Event-ID, proxy headers | 1h | new `scripts/verify-sse-reliability.mjs` |
| 10.2c | File locking integration — concurrent history writes, concurrent learning memory, corrupt JSON skip | 1h | new `scripts/verify-file-locking.mjs` |
| 10.2d | STT reliability integration — health check, restart recovery, concurrent transcription | 1.5h | new `scripts/verify-stt-reliability.mjs` |

### 10.3 E2E + Chaos Tests (3h)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 10.3a | Code agent mini window E2E — open, send prompt, verify SSE reply, check diff display, close window | 1.5h | new `scripts/verify-code-agent-e2e.mjs` |
| 10.3b | Graceful degradation E2E — stop STT, verify text chat still works; stop ACC, verify mini window error | 1h | new `scripts/verify-e2e-reliability.mjs` |
| 10.3c | Setup CI pipeline (GitHub Actions) — unit on push/PR, integration on self-hosted | 0.5h | `.github/workflows/reliability.yml` |

---

## 🟢 Nice-to-Have

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1.7 | Parent dashboard — skill radar chart, mastery timeline, heatmap | 5d | NOT visible to child |
| N1 | Export learning memory as printable PDF | 1d | For parent review |
| N2 | Inline skill tag on each message (agent-only) | 0.5d | Which skill was practiced |
| N3 | Tree-shake unused UI from production bundle | 0.5d | |
| N4 | Code agent: support `/fix`, `/explain`, `/add` slash commands | 1d | Quick vibe coding shortcuts |
| N5 | Code agent: "Undo last change" button in mini window | 0.5d | Uses git revert |
| N6 | Code agent: syntax-highlighted code blocks in thread | 1d | Prism.js or Shiki in MiniConsoleThread |

---

## 🔴 Phase 11: Code Agent v3 — Multi-Modal, Auto-Git, Service Resilience (22h)

> **Design:** [code-agent-v3-enhancements.md](code-agent-v3-enhancements.md)  
> **Priorities:** 11A (upload ⊹ voice) · 11C (auto-git) · 11D (service restart)  
> **Status:** ✅ ALL DONE — implemented & verified 2026-08-04

### 11A: Image & PDF Upload (6h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11A.1 | Extend `ChatRequest` type + `AgentStreamEvent` for attachments | 0.5h | `agent-chat/src/lib/types.ts` |
| ✅ 11A.2 | `buildAttachmentLines()` in prompts — extract PDF text (pdftotext), decode text files, describe images | 1.5h | `agent-chat/src/lib/prompts.ts` |
| ✅ 11A.3 | Update `streamAgentResponse()` to accept attachments, inject into prompt | 1h | `agent-chat/src/lib/agent.ts` |
| ✅ 11A.4 | Update SSE chat route to forward attachments | 0.5h | `agent-chat/src/app/api/chat/route.ts` |
| ✅ 11A.5 | Frontend: camera button + file picker + attachment pills with thumbnail previews | 1.5h | `agent-chat/public/index.html` |
| ✅ 11A.6 | Frontend: `fileToAttachment()` — read file → base64, compress images, clip text | 1h | `agent-chat/public/index.html` |

### 11B: Chinese/English Voice Input (3h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11B.1 | Voice lang toggle button ("zh"↔"en") in input bar; `voiceLang` state | 1h | `agent-chat/public/index.html` |
| ✅ 11B.2 | Wire lang into Web Speech API `recognition.lang` and server STT `language` param | 0.5h | `agent-chat/public/index.html` |
| ✅ 11B.3 | Visual feedback: recording pulse per language, auto-reset after transcription, re-focus input | 1h | `agent-chat/public/index.html` |
| ✅ 11B.4 | Update system prompt: note user's voice language preference for reply language | 0.5h | `agent-chat/src/lib/prompts.ts` |

### 11C: Auto Commit + Push to Develop (6h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11C.1 | `git-ops.ts` — `runTests(workspace)` with 120s timeout, exitCode + stderr capture | 1.5h | `agent-chat/src/lib/git-ops.ts` 🆕 |
| ✅ 11C.2 | `git-ops.ts` — `stageAndCommit(workspace, message)` with empty-diff guard | 1h | `agent-chat/src/lib/git-ops.ts` |
| ✅ 11C.3 | `git-ops.ts` — `pushBranch(workspace, branch)` with auth-failure detection | 0.5h | `agent-chat/src/lib/git-ops.ts` |
| ✅ 11C.4 | `git-ops.ts` — `detectFileChanges(events)` from tool_call stream events | 1h | `agent-chat/src/lib/git-ops.ts` |
| ✅ 11C.5 | Post-stream git hook in chat route — if `AUTO_GIT_ENABLED` and changes detected, run test gate → commit → push | 1h | `agent-chat/src/app/api/chat/route.ts` |
| ✅ 11C.6 | Extend SSE "done" event — include `commitSha`, `commitMessage`, `testResult` | 0.5h | `agent-chat/src/lib/types.ts`, `agent.ts` |
| ✅ 11C.7 | Frontend: display commit SHA + test result badge in final message | 0.5h | `agent-chat/public/index.html` |

### 11D: Service Restart with Verification (7h) ✅

| # | Task | Effort | Files |
|---|------|--------|-------|
| ✅ 11D.1 | `/api/setup` health endpoint for ACC | 0.5h | `agent-chat/src/app/api/setup/route.ts` 🆕 |
| ✅ 11D.2 | `systemd` unit for ACC (`spark-acc.service`) | 0.5h | `/etc/systemd/system/spark-acc.service` 🆕 |
| ✅ 11D.3 | `restart-services.sh` — ordered stop → start → health-check gate with timeout + retry per service | 2h | `scripts/restart-services.sh` 🆕 |
| ✅ 11D.4 | `health-check.mjs` — standalone checker: 3 services × health endpoint, JSON output, exit 0/1 | 1h | `scripts/health-check.mjs` 🆕 |
| ✅ 11D.5 | Health matrix: STT (8765/health 60s), Spark (3000/api/setup 30s), Spark page (3000/ 15s), ACC (3001/ 15s) | 1h | `scripts/restart-services.sh`, `scripts/health-check.mjs` |
| ✅ 11D.6 | Update `start.sh` to call `restart-services.sh` post-launch | 1h | `start.sh` |
| ✅ 11D.7 | Integration test: kill all services, run restart script, verify all health checks pass | 1h | `scripts/verify-service-restart.mjs` 🆕 |

---

## 📊 Summary

| Phase | Priority | Sub-tasks | Est. |
|-------|----------|-----------|------|
| **Phase 0** Full UI | 🔴 Critical | 13 (0.8–0.14) | **6d** |
| **Phase 6** Testing gaps | 🔴 Critical | 5 (6.1.1–6.1.5) | **10d** |
| **Phase 7** Code Agent Reliability | 🔴 Critical | 7 (7.1–7.7) | **10h** |
| **Phase 8** Mini Window UI | 🔴 Critical | 9 (8.1–8.9) | **10h** |
| **Phase 9** STT Reliability | 🔴 Critical | 6 (9.1–9.6) | **4h** |
| **Phase 10** Reliability Tests | 🔴 Critical | 11 (10.1–10.3) | **14h** |
| **Phase 11** Code Agent v3 | 🔴 Critical | 24 (11A.1–11D.7) | **22h** |
| **Phase 2** Agent | 🟡 Important | 2 (2.2, 2.4) | **6d** |
| **Phase 3** Geometry | 🟡 Important | 3 | **13d** |
| **Phase 4** Voice | 🟡 Important | 3 | **9d** |
| **Phase 5** Platform | 🟢 Nice | 4 | **9d** |
| **Phase 6** Test add-ons | 🟢 Nice | 3 (6.2.5, 6.2.7, 6.3–6.4) | **7.5d** |
| **Nice-to-Have** | 🟢 Nice | 10 | **11d** |

**Total new critical work (Phases 7–10):** ~38 hours (~5 days)

**Updated critical path:** Phase 7 (agent reliability 10h) → Phase 8 (mini window 10h) → Phase 9 (STT 4h) → Phase 10 (tests 14h) → **Phase 11** (Code Agent v3 22h) → Phase 0 UI (6d) → Phase 6 tests (10d)

**Next immediate steps:**
1. **Phase 11A.1** — Extend `ChatRequest` type for attachments (0.5h, foundation for upload)
2. **Phase 11D.2** — Create `spark-acc.service` systemd unit (0.5h, stability)
3. **Phase 11C.1** — Build `git-ops.ts` test runner (1.5h, auto-git foundation)
