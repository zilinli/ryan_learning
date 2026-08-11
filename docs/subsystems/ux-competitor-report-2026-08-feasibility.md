# UX Competitor Report 2026-08 — Feasibility Analysis

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Source: *Spark AI Tutor UX 竞品调研报告* (2026-08-11)  
> Status: **accepted** · calibrated backlog (UX-RPT.1–3 shipped; Slice A–D next)  
> Related: [competitive-feature-analysis.md](competitive-feature-analysis.md) · [ui-architecture.md](ui-architecture.md) · [ca-p0-system-design.md](ca-p0-system-design.md) · [parent-gate.md](parent-gate.md)

---

## 1. Problem

The 2026-08-11 UX competitor report rates Spark’s core chat as solid (Physical Tutor Test, dialect, BKT) but calls out six perceptible gaps vs Ello / 豆包爱学 / Buddy.ai:

1. **Latency perception** — blank “Thinking…” during 10–30s agent loops  
2. **Passive tutoring** — wait for student message (vs active intervene)  
3. **No layered / confirm-step interaction** beyond what already ships  
4. **Weak visual interactivity** (static Mermaid/KaTeX vs Synthesis boards)  
5. **Voice latency / kid ASR**  
6. **Thin tutor persona / emotional rhythm**

Many report items **already exist** in Spark (CA-P0 opener, barge-in, `~~~step`, worksheet planner, `/family`). This doc separates **shipped**, **Slice A–D**, **backlog**, and **reject / defer**.

---

## 2. Calibration (report vs codebase)

| Report claim | Actual |
|--------------|--------|
| 分步确认 ❌ | **Shipped** — `~~~step` + StepReveal Next + Got it / Simpler |
| Passive wait only | **Partial** — session opener / idle nudge / practice kickoff |
| No parent console / “不做家长控制台” | **Keep `/family`** (narrative KPI + mistake coaching); **reject mega admin** |
| Only blank Thinking… | **Shipped** — phased wait status (UX-RPT.1) |
| Soft persona missing | **Shipped** — prompt persona (UX-RPT.3) |

---

## 3. Feasibility matrix (report → Spark)

| Report recommendation | Feasibility | Verdict | Notes |
|----------------------|-------------|---------|-------|
| Phased wait status | **High** | **Done (UX-RPT.1)** | `tutor-wait-status.ts` |
| “Taking longer…” | **High** | **Done (UX-RPT.1)** | Timed phases |
| 豆包-style step confirm / Next | **High** | **Done (R3)** | `~~~step` + StepReveal |
| Per-step follow-up chips | **High** | **Done (UX-RPT.2)** | Got it / Simpler |
| Soft persona + step discipline | **High** | **Done (UX-RPT.3)** | Prompt-only |
| Local recall fast-path (arithmetic) | **Med** | **Slice A (UX-RPT.7)** | Narrow whitelist only |
| Stream Markdown audit | **High** | **Slice A (UX-RPT.7)** | Document gaps; no rewrite |
| Whisper hot-load 180s | **Low–Med** | **Defer** | Cloud STT is primary |
| Core Idea layered reply | **Med–High** | **Slice C (UX-RPT.9)** | Prompt + optional answer fold |
| Voice status UI (timer / level) | **Med–High** | **Slice B (UX-RPT.8)** | No full-duplex |
| Opener Continue / Something else | **High** | **Slice C (UX-RPT.9)** | Harden existing chips |
| Named mascot chrome | **Med** | **Reject** | Soft persona only |
| Win/struggle emotion rhythm | **Med** | **Slice D (UX-RPT.10)** | Prompt + light counters |
| Kid daily blurb card | **Med** | **Slice D (UX-RPT.10)** | Reuse digest; dismissible |
| Kid privacy copy | **High** | **Slice D (UX-RPT.10)** | `/privacy` |
| Error guide templates | **High** | **Slice D (UX-RPT.10)** | Static + prompt |
| Dual-agent / sub-1s Ello | **Low** | **Defer P3+** | Cursor SDK + 4GB host |
| Predictive branches | **Low–Med** | **Defer** | Later A2 MC |
| Child ASR fine-tune | **Low** | **Defer** | Bailian / dialect path |
| Full-duplex voice | **Low** | **Defer (B2b)** | After barge-in |
| Animated tutor | **Med** | **Reject** | Physical Tutor Test |
| Streaks / leaderboards | — | **Reject** | Non-goal |
| Desmos / dynamic board | **Med** | **Backlog CA-9** | Geometry milestone |
| Rule-engine scaffolding | **Med** | **Backlog** | `pedagogy-loop` partial |
| Dedicated `/mistakes` app | **Med** | **Reject route** | Chat + `/family` patterns |
| Parent mega console | — | **Reject** | Keep `/family` only |

---

## 4. Shipped slice (UX-RPT.1–3)

### UX-RPT.1 — Wait-phase status

Client-owned phases (no fake progress bars). Tool/SSE labels win over timed phases.

| Condition | Phase sequence |
|-----------|----------------|
| Has photo/file | Looking at your photo… → Figuring it out… → Taking a bit longer… → Still working — hang tight… |
| Text only | Thinking… → Working on it… → Taking a bit longer… → Still working — hang tight… |

### UX-RPT.2 — Step follow-up chips

After a revealed `~~~step`: **Got it** / **Simpler** → `spark:quick-reply` → Composer draft (never auto-send).

### UX-RPT.3 — Prompt persona + step discipline

Calm coach for 9–12yo; multi-step reasoning → `~~~step`.

---

## 5. Next slices (A–D)

### Slice A — Latency perception finish (UX-RPT.7)

1. **Stream audit** — confirm photo/text paths paint first token via existing delta filter; note gaps in TODO only.  
2. **`local-recall.ts`** — whitelist simple two-operand arithmetic; instant user+assistant bubbles in `TutorShell.handleSend`; else Agent.  
3. Manual UX-RPT.6 remains for photo wait + chips.

### Slice B — Voice status UX (UX-RPT.8)

1. Mic: recording timer + simple level pulse (RMS from recorder if available).  
2. Transcript already editable in Composer — keep visible.  
3. TTS: keep Listen button highlight (`speakingMessageId`); no karaoke text.

### Slice C — Layered reply IA (UX-RPT.9)

1. Prompt: Core idea ≤120 chars, then `~~~step`; no early final answer dump.  
2. UI: optional **Show answer** fold for `~~~answer` fences (default hidden).  
3. Opener chips: **Continue** / **Something else** wording on empty-state card.

### Slice D — Emotion + docs (UX-RPT.10)

1. Struggle/win short encouragement via prompt + turn outcome.  
2. Dismissible kid daily blurb from `buildParentDailyDigest` / idle line.  
3. Kid-friendly `/privacy` copy.  
4. Static error-guide templates for soft fails.

### Explicit non-goals (prototype)

Streaks, multi-tab learning hub, dedicated mistakes route, parent mega-admin, paywall, forced login, mascot avatar, Ello dual-agent, child ASR fine-tune, full-duplex voice.

---

## 6. Key files

| File | Role |
|------|------|
| `src/lib/tutor-wait-status.ts` | Wait phases |
| `src/lib/local-recall.ts` | Narrow arithmetic fast-path |
| `src/lib/emotion-rhythm.ts` | Win/struggle copy helpers |
| `src/lib/error-guides.ts` | Soft error templates |
| `src/components/TutorShell.tsx` | Send / wait / local-recall / daily blurb |
| `src/components/VoiceControls.tsx` | Mic timer + level |
| `src/components/MarkdownMessage.tsx` | Step chips + answer fold |
| `src/components/ChatThread.tsx` | Opener Continue chips |
| `src/lib/prompts.ts` | Persona, core idea, emotion |
| `src/app/privacy/page.tsx` | Kid + parent privacy copy |

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Status flicker | Prefer tool/SSE; only advance generic wait labels |
| Local recall wrong answer | Tiny whitelist + unit tests |
| Persona → cartoon chrome | Prompt only; no nameplate |
| Daily blurb vs Family | Reuse digest; dismissible; no new dashboard |
| Quick-reply auto-send | Draft only |

---

## 8. Success metrics (pragmatic)

| Metric | Target |
|--------|--------|
| Long waits understandable | Phased copy (shipped) |
| Step chips | Click fills draft |
| Voice path | Timer + editable transcript + Listen highlight |
| Real TTFB | **No** full-stack 3–5s promise; local recall only for whitelist |

### Stream audit (UX-RPT.7)

Existing path paints first token: `filterTutorDelta` → SSE `delta` → `TutorShell` rAF-batched `onDelta` → ChatThread streaming caret. Tool/SSE `status` preferred over timed wait phases. No rewrite — gaps only if a future path skips `consumeChatStream`.

### Manual checklist

- Photo wait phases; step chips fill composer (UX-RPT.6)
- `7×8` local recall; mic timer; Show answer; daily blurb; `/privacy` kid section (UX-RPT.11)

---

## 9. Out of scope (still)

Ello dual-agent, child ASR fine-tune, full-duplex, mascot, streaks, Desmos embed, full rule-engine rewrite, parent mega-dashboard.

---

*Feasibility accepted 2026-08-11 · calibrated Slice A–D 2026-08-11.*
