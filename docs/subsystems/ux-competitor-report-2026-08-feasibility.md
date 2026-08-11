# UX Competitor Report 2026-08 — Feasibility Analysis

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Source: *Spark AI Tutor UX 竞品调研报告* (2026-08-11)  
> Status: **accepted** · maps report → backlog  
> Related: [competitive-feature-analysis.md](competitive-feature-analysis.md) · [ui-architecture.md](ui-architecture.md) · [ca-p0-system-design.md](ca-p0-system-design.md)

---

## 1. Problem

The 2026-08-11 UX competitor report rates Spark’s core chat as solid (Physical Tutor Test, dialect, BKT) but calls out six perceptible gaps vs Ello / 豆包爱学 / Buddy.ai:

1. **Latency perception** — blank “Thinking…” during 10–30s agent loops  
2. **Passive tutoring** — wait for student message (vs active intervene)  
3. **No layered / confirm-step interaction** beyond what already ships  
4. **Weak visual interactivity** (static Mermaid/KaTeX vs Synthesis boards)  
5. **Voice latency / kid ASR**  
6. **Thin tutor persona / emotional rhythm**

Many report items **already exist** in Spark (CA-P0 opener, barge-in, `~~~step`, worksheet planner). This doc separates **absorb now**, **backlog**, and **reject / defer** so we do not re-invent shipped work or chase Ello-class infra on a 4GB home host.

---

## 2. Feasibility matrix (report → Spark)

| Report recommendation | Feasibility | Verdict | Notes |
|----------------------|-------------|---------|-------|
| Phased wait status (识别→分析→讲解) | **High** | **Ship now (UX-RPT.1)** | Context-aware labels + timed phases; no fake progress bar |
| “Taking longer…” after long wait | **High** | **Ship now (UX-RPT.1)** | Already in ui-architecture §7.3; wire client timer |
| 豆包-style step confirm / Next | **Done** | Keep | `~~~step` + StepReveal (R3) |
| Per-step follow-up chips (“更简单 / 懂了”) | **High** | **Ship now (UX-RPT.2)** | AITutor pattern #3; chips → composer quick-fill |
| Stronger `~~~step` prompt use | **High** | **Ship now (UX-RPT.3)** | Soft persona + when to use fences |
| Soft tutor persona (not Duolingo character) | **High** | **Ship now (UX-RPT.3)** | Prompt-only; Physical Tutor Test |
| Proactive opener / homework yield | **Done (CA-3)** | Harden later | B1 shipped |
| Worksheet multi-Q planner | **Done (CA-1)** | Harden cuts | A1 |
| Post-session 3 drills | **Done (CA-2)** | — | A2 |
| TTS barge-in | **Done (CA-4)** | Then B2b | B2a |
| Dual-agent / sub-1s Ello architecture | **Low** | **Defer P3+** | Cursor SDK sync loop; host cost |
| Predictive branch answers | **Low–Med** | **Defer** | Fits A2 MC later; not this sprint |
| Proprietary child ASR | **Low** | **Defer** | Keep Bailian/Whisper + dialect path |
| Full-duplex voice | **Low** | **Defer (B2b)** | After barge-in hardening |
| Animated tutor mascot | **Med** | **Reject for now** | Noise vs Physical Tutor Test |
| Duolingo streaks / leaderboards | — | **Reject** | Explicit non-goal |
| Interactive Desmos / dynamic board | **Med** | **P1–P2 backlog** | CA-8 / CA-9 |
| Rule-engine scaffolding (vs ad-hoc prompt) | **Med** | **Backlog** | pedagogy-loop exists; full rule engine later |
| Parent digest narrative polish | **Med** | **P2 backlog** | D2 / R6 exist; IA polish separate |
| Automatic error book UI | **Med** | **Absorb via A2/A3** | Chat-first, not new app |

---

## 3. Approach (this slice)

### UX-RPT.1 — Wait-phase status (latency *perception*)

We cannot cut Cursor agent TTFB to Ello’s &lt;1s on current stack. We **can** match 豆包’s honesty: tell the child *what stage* we are in.

**Client-owned phases** (do not invent fake tool progress):

| Condition | Phase sequence (advance by wall clock until tool/delta status) |
|-----------|------------------------------------------------------------------|
| Has photo/file | Looking at your photo… → Figuring it out… → Taking a bit longer… → Still working — hang tight… |
| Text only | Thinking… → Working on it… → Taking a bit longer… → Still working — hang tight… |

**Server** still emits real tool labels (`Drawing a diagram…`, `Searching the web…`). Client prefers **tool status** over timed phase when both exist. Clear status on first delta / done / error.

**Anti-pattern:** Fake determinate progress bars (Mavik Labs 2026 — breaks trust).

### UX-RPT.2 — Step follow-up chips

After a `~~~step` row is revealed, show two ≥44px chips:

- **Got it** → fills composer with a short affirm (language-neutral English chrome; message can be “Got it — what’s next?”)
- **Simpler** → “Can you explain that step more simply?”

Chips dispatch `spark:quick-reply` CustomEvent; Composer listens and sets draft text (does not auto-send — child decides).

### UX-RPT.3 — Prompt: persona + step discipline

- One short **persona** line: calm, warm coach (9–12yo), encourage → challenge rhythm; not a cartoon mascot.  
- Reinforce: multi-step worked reasoning → `~~~step`; after each revealed step the UI offers chips — agent should still end with one question when not using fences.

---

## 4. Key files

| File | Role |
|------|------|
| `src/lib/tutor-wait-status.ts` | Phase labels + timing helpers |
| `src/components/TutorShell.tsx` | Start phase timer on send; merge with SSE status |
| `src/components/MarkdownMessage.tsx` | StepReveal chips + event |
| `src/components/Composer.tsx` | Listen `spark:quick-reply` → draft |
| `src/lib/prompts.ts` | Persona + step reinforcement |
| `src/lib/tutor-wait-status.test.ts` | Unit tests |

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Status flicker (phase vs tool) | Prefer tool/SSE label; only advance phases when status still looks “thinking/working” |
| Quick-reply auto-send | Never auto-send; fill draft only |
| Prompt bloat | ≤6 new lines in prompts.ts |
| Child ignores chips | Optional; Next already works |

---

## 6. Test design

### Unit
- `nextWaitPhase` / `initialWaitStatus` transitions and photo vs text labels  
- Phase index clamps; “taking longer” appears after configured ms  

### Integration / component (light)
- StepReveal fires `spark:quick-reply` detail on chip click (jsdom)  

### Manual
- [ ] Photo homework: status shows “Looking at your photo…” then updates / tool labels  
- [ ] Wait &gt;12s without tokens: “Taking a bit longer…”  
- [ ] Multi-step `~~~step`: Next → Got it / Simpler fills composer  
- [ ] Physical Tutor Test: no new chrome in empty chat beyond status line  

---

## 7. Out of scope (this slice)

Ello dual-agent, child ASR fine-tune, full-duplex, mascot avatar, streaks, Desmos embed, rule-engine rewrite, parent dashboard redesign.

---

*Feasibility accepted 2026-08-11 — implement UX-RPT.1–3 then backlog remainder via competitive CA IDs.*
