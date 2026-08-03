# 📋 Downstream Development TODO

> Priority: 🔴 critical · 🟡 important · 🟢 nice-to-have

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

## Quick Wins (< 1 day each)

- [ ] Add "last practiced" timestamp to SkillsPanel UI
- [ ] Export learning memory as printable PDF for parent review
- [ ] Add "suggest a topic" button based on weakest skill
- [ ] Inline skill tag display on each message (which skill was practiced)
- [ ] Keyboard shortcut: `Ctrl+Enter` to send (already Enter; add `Shift+Enter` for newline → swap)
- [ ] Add dark mode support
