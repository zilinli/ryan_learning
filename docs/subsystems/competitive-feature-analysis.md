# Competitive Feature Analysis — 竞品功能调研 (2026-08)

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **v2 confirmed 2026-08-09** · P0 shipped on `develop`; P1–P3 backlog accepted  
> Plan: [competitive-product-plan-v2.md](competitive-product-plan-v2.md)  
> UI: [competitive-ui-design.md](competitive-ui-design.md)  
> Downstream: [TODO.md § Competitive Analysis Backlog](../TODO.md) · [ca-p0-system-design.md](ca-p0-system-design.md) · [ca-p1-system-design.md](ca-p1-system-design.md)

---

## 1. Purpose

Deep-dive similar AI tutors (2025–2026) and filter features that are **interesting and important** for Spark — without violating the design pillars in [DESIGN.md](../DESIGN.md):

1. Zero-barrier for elementary students  
2. Conversation is the core (no child-facing course dashboard)  
3. Physical-tutor metaphor: if a human tutor next to Ryan wouldn't have it, cut it  

This document is the research home. Confirmed items land as checkboxes in `docs/TODO.md`. Implementation design docs should be spun out per feature when work starts (same pattern as [v2-enhancements.md](v2-enhancements.md)).

---

## 1b. Broader user-needs research (2025–2026)

Synthesized from Common Sense Media *Generation AI* (Mar 2026), Pew teens+AI (Feb 2026), College Board GenAI brief, KidsOutAndAbout parent AI literacy survey (Dec 2025), PNAS peer-pressure WTP study (2026), plus product UX patterns (XSolve multi-question scan, iMasterly Socratic photo tutor, arXiv LLM scaffolding papers).

### Parent jobs-to-be-done

| Need | Evidence | Spark response |
|------|----------|----------------|
| Help with homework **without cheating** | ~60% parents OK with schoolwork AI; majority reject emotional companion AI; fear of answer-copying | Keep Socratic anti-spoiler; never default to solver mode |
| Visibility without nagging child | Parent dashboards on Synthesis/ShowYourWork; parents feel unprepared to guide AI (52%+) | **D2** daily one-liner first; weekly report demoted to P3 |
| Don't fall behind peers | WTP for AI homework tools rises with peer adoption | Fast worksheet path (**CA-1**) so homework nights feel covered |
| Responsible use / bias awareness | Top literacy ask: spot misinformation + responsible school use | Curriculum-aligned prompts; BASIS/Singapore methods; no out-of-syllabus shortcuts |

### Student jobs-to-be-done (esp. elementary / G4)

| Need | Evidence | Spark response |
|------|----------|----------------|
| Scan **whole worksheet** once | XSolve / Photomath multi-Q; re-scan kills focus | **CA-1** planner |
| Low typing cost / voice | Magic Homework Buddy; Buddy.ai; arXiv "follow-up dock" | Photo + mic; **CA-4** barge-in |
| Private second question (no embarrassment) | Formative interviews in reasoning-facilitator paper | Chat continuity + soft openers (**CA-3**) |
| Practice what I missed | Socra gaps; 豆包错题本; students value practice (College Board) | **CA-2** 3-drill offer |
| Multiple explanations when stuck | Synthesis multi-rep; classroom pilots show reframe > repeat | **CA-7** (P1) |
| See *where* work broke | Zanaya / ShowYourWork / MATHia step diagnosis | **CA-5** (P1) |

### Product implication ranking

1. Homework completion flow (CA-1) + anti-cheat pedagogy (already strong)  
2. Retention loop: opener + post-session drills (CA-3, CA-2)  
3. Voice interruptibility (CA-4)  
4. Deeper diagnosis / representations (P1)  
5. Parent digest (P2) — important trust, lower daily child impact  

---

## 2. Spark baseline (what we already have)

| Strength | Notes |
|----------|--------|
| Socratic hint ladder (L0–L3 + L1.5 / L2.5) | Stronger pedagogy than typical answer apps |
| BKT + SM-2 + ZPD | Cognitive memory already ahead of most chatbots |
| Photo / voice / multilingual + dialect (Teochew/Hakka) | Unique family moat vs Western products |
| Entertainments hub + Code Agent | Broader than pure tutors |
| Chat-first UI | Explicitly rejects EdTech dashboard clutter |

**Already in TODO (not re-invented here):** worksheet planning (2.2), reasoning-chain capture (2.4), Desmos (3.3), voice-only (4.1), parent radar (1.7), dialect STT/TTS Phase G.

---

## 3. Competitor map

| Product | Core differentiation | Takeaway for Spark |
|---------|---------------------|-------------------|
| **Khanmigo** | Socratic + huge content library; teacher tools win more than student chat | Validates hint ladder; do **not** rebuild a course catalog |
| **Synthesis Tutor** | Gamified adaptive math, multi-representation reteach, parent progress | "Want to practice" comes from short game loops + multi-rep, not more chrome |
| **豆包爱学 2.0** | Guided explanation, dynamic board, barge-in Q&A, error book, homework grading | Biggest product gap: explanation form + post-session practice loop |
| **Socra** | Photo Socratic + post-session knowledge gaps + targeted drills | Session-end artifacts plug cleanly into BKT |
| **Zanaya / MATHia** | Step-level diagnosis, fine-grained KCs, JIT misconception feedback | Move from right/wrong → which step / which misconception |
| **ShowYourWork / CalcGPT** | Scratch-work vision + embedded Desmos | Scratch paper + graphs as a toolkit next to chat |
| **Buddy.ai** | Voice-first, barge-in, kid ASR, COPPA | Voice-only must be real turn-taking, not TTS-then-record |
| **Photomath / Gauth** | Worksheet OCR + step solutions (often answer-forward) | Steal multi-problem page flow; keep Socratic (no spoilers by default) |
| **ALEKS** | Knowledge-space “learnable now” set | Internal ammo for B1; never expose map UI (**C5** P3 idea) |
| **松鼠 AI / Squirrel AI** | Fine KC graph + teach-practice-feedback | KC methodology yes; child-facing graph **no** |
| **IXL** | Practice-as-diagnosis (SmartScore) | Fold into **A2** as default BKT update (**C6**) |
| **Duolingo Max** | Roleplay + Explain My Answer | Resume-after-interrupt copy for **B2b** |
| **ELSA Speak** | Phoneme feedback + kid ASR forgiveness | **B3** after Phase G |
| **国内 AI 老师「打断续讲」** | Interrupt mid-explain, resume at breakpoint | **B2b** state design reference |

---

## 4. Recommended features (v2 confirmed)

ID aliases: A1=CA-1, A2=CA-2(+C6), B1=CA-3, B2a=CA-4, C1–C4=CA-5…8.

Filter: high learning value × feasible on current stack (Next.js tutor + Cursor agent + local/cloud STT/TTS + 4GB host) × chat-first UX.

### P0 — High value, high feasibility

| ID | Feature | Sources | What to build | Feasibility | Brainstorm / constraints |
|----|---------|---------|---------------|-------------|--------------------------|
| **CA-1** | Whole-page worksheet planner | Photomath, Gauth, 豆包拍题, Socra | Vision splits Q1→Qn → Socratic per item → minimal progress ("2/8") → end-of-set weak-skill summary | **High** — photo+agent exist; need task state machine | Collapsible checklist; default UI shows only current item. **Strengthens TODO 2.2** |
| **CA-2** | Post-session gaps → 3 targeted drills | 豆包错题本, Socra Knowledge Gaps | On session end, BKT/miscue → offer 3 drills; optional "tomorrow" → SM-2 | **High** — BKT+generation exist; need end hook + storage | Child sees one line: "要不要再练 3 道？" — not an error-book app |
| **CA-3** | Proactive ZPD / due-review opener | Duolingo/Khanmigo agents, Zanaya spaced practice | New chat opens with one offer: "今天适合练 X，还是先拍作业？" | **High** — `zpdWarmUpSkills` / `needsReviewSkills` exist | At most once/day; homework always wins if child says so |
| **CA-4** | TTS barge-in + voice turns | 豆包可打断, Buddy barge-in | Tap mic during TTS → stop + listen; later continuous half-duplex | **Med-High** — STT/TTS ready; true &lt;300ms WebSocket hard | Split Phase 4.1 → **4.1a barge-in** then **4.1b** continuous voice |

### P1 — Teaching depth

| ID | Feature | Sources | What to build | Feasibility | Brainstorm / constraints |
|----|---------|---------|---------------|-------------|--------------------------|
| **CA-5** | Scratch-work vision | ShowYourWork, Zanaya, MATHia | Photo of work / light canvas → locate bad step → feed L2.5 | **Medium** — multimodal yes; structured step parse needs prompt+eval | Photo first, canvas later; links to TODO **2.4** |
| **CA-6** | Misconception tag library (JIT) | MATHia JIT / Skillometer | Seed G4 tags (e.g. add fractions w/o common denom) → memory + targeted prompts | **Med-High** — schema + seeds; cold-start curated | Start 20–30 tags: fractions + place value |
| **CA-7** | Multi-representation auto-switch | Synthesis blocks→number line→word problem | After repeated "还是不懂", force bar model / number line / story; remember what worked | **High** — analogy switch exists; need enum + memory field | Deepens existing analogy mechanism |
| **CA-8** | Dynamic board / step animation | 豆包板书, Photomath Animated Steps | Geometry SVG updates labels with dialogue; optional step highlight | **Medium** — static SVG exists; timed sync is design work | Continues v2 §6.6 + Phase 3 geometry |

### P1 additions (v2)

| ID | Feature | Sources | What to build | Feasibility | Constraints |
|----|---------|---------|---------------|-------------|-------------|
| **A3** | Cross-day gap merge | 豆包错题本, Squirrel AI | Aggregate recurring weak skills across days → opener cites them | **Medium** | Requires A2; **must** decay/expire gaps |
| **B3** | Voice tolerance / confirm-intent | ELSA, Buddy.ai | Low ASR confidence → “你是说除以还是除法？” | **Medium** | **After Phase G**, not inside G acceptance |

### P2 — Tools & parent (chat-first preserved)

| ID | Feature | Sources | What to build | Feasibility | Brainstorm / constraints |
|----|---------|---------|---------------|-------------|--------------------------|
| **CA-9** | Embedded Desmos / graphs | CalcGPT, ScholarOS | In-chat algebra graph tool, not a new nav page | **Medium** — Phase **3.3** | Session-embedded tool |
| **D2** | Parent **daily one-liner** (PIN) | Synthesis / 豆包家长提醒 (narrowed) | Natural-language “today practiced X; stuck on Y” | **High** | Preferred over weekly charts |
| **D1** | PIN **核对模式** | (Spark-specific) | Switch prompt to show full steps; exit → Socratic | **High** | Exit must force Socratic; no child-only path |
| **CA-11** | Entertainments → skill soft link | Synthesis game loop | Rare opt-in post-game offer | **Medium** | Easy to distract |
| **CA-12** | Dialect speech quality | Spark-unique | Keep Phase **G** engineering P0 | **In progress** | Moat |

### P3 — Ideas only (do not over-schedule)

| ID | Feature | Note |
|----|---------|------|
| **B2b** | Continuous voice + interrupt-resume | After B2a; use 豆包/Duolingo Max as copy refs |
| **C5** | ALEKS-style next-learnable set | **Internal reasoning only** — never knowledge-map UI |
| **Weekly report** | Former CA-10 | Only if D2 insufficient; demoted from P2 |

**C6 (IXL practice-as-diagnosis):** not a separate backlog ID — default behavior of A2 / BKT updates.

---

## 5. Explicit non-goals (anti-patterns)

| Anti-pattern | Why reject |
|--------------|------------|
| Child course catalog / badge wall / multi-tab learning center | Violates DESIGN three pillars |
| Default instant-answer solver | Conflicts with Socratic core |
| Full COPPA productization | Home private deploy unless public app store |
| Heavy Manim / 3Blue1Brown on host | 4GB unsuitable |
| **Answer-check without PIN** | D1 is PIN-only |
| **Exposed knowledge-map / skill-tree UI** | Internal graph OK; child/parent map = course platform |
| **Leaderboards / learning streaks** | Anxiety / extrinsic grind; no parent-visible streak exception |

---

## 6. Feasibility flow (v2)

```mermaid
flowchart LR
  subgraph p0 [P0_shipped]
    W[A1_Worksheet]
    P[A2_Practice]
    Z[B1_Opener]
    B[B2a_BargeIn]
  end
  subgraph p1 [P1]
    S[C1_Scratch]
    M[C2_Misconceptions]
    A[C3_Multirep]
    D[C4_Board]
    A3[A3_CrossDay]
    B3[B3_VoiceTol]
  end
  subgraph p2 [P2]
    G[Desmos]
    D2[DailyDigest]
    D1[PIN_Check]
    E[GamesToSkills]
  end
  p0 --> p1 --> p2
```

---

## 7. Mapping to TODO / design docs

| Analysis ID | Hook | Next design when implementing |
|-------------|------|-------------------------------|
| A1 / CA-1 | **2.2** + shipped planner | Harden cut accuracy; `worksheet-planner` already |
| A2 / CA-2 (+C6) | session-practice shipped | End-hook + ZPD drill quality |
| B1 / CA-3 | session-opener shipped | Yield-to-homework hardening |
| B2a / CA-4 | speech-barge-in shipped | Manual M4; then B2b |
| A3 | After A2 | `session-practice` cross-day merge |
| B3 | After Phase G | Extend `voice-tts-stt.md` |
| C1–C4 / CA-5…8 | [ca-p1-system-design.md](ca-p1-system-design.md) | Per-feature specs |
| D2 | New | `parent-daily-digest.md` |
| D1 | New | `check-mode-pin.md` — exit→Socratic acceptance |
| CA-9 | **3.3** | Extend geometry / graphing |
| CA-11 | entertainments | Soft link section |
| CA-12 | Phase G | dialect-speech-optimization |
| C5 / weekly | P3 ideas | Plan doc only |

---

## 8. Success metrics (single-child home)

- Socratic depth: child explain/ask turn share  
- A2 gap-loop close rate (offer accepted + finished)  
- B1 opener accept vs yield ratio  
- D2 parent open/reply rate (not dashboard time)

---

## 9. Sources (sampled 2026-08)

- Khanmigo, Synthesis, 豆包爱学, Socra, Zanaya/MATHia, ShowYourWork/CalcGPT, Buddy.ai, Photomath/Gauth  
- ALEKS, 松鼠 AI, IXL, Duolingo Max, ELSA Speak, 国内 AI 老师打断续讲  
- Common Sense / Pew / College Board parent–teen AI surveys (see §1b)

---

*Analysis only — no runtime code changes required by this document update.*
