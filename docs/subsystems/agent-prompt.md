# Subsystem: Agent & Prompt Pipeline

> Parent: [Design Overview](/docs/DESIGN.md)

---

## 1. Responsibility

Convert raw user input + learner context into a structured prompt that drives the Cursor SDK agent, then stream the reply back to the browser.

---

## 2. Architecture

```mermaid
flowchart TB
    subgraph Input
        UT[userText]
        IM[imageCount / fileSummaries]
        HI[history · 8 turns]
        PR[studentProfile]
        LM[learningMemory · BKT]
        EN[engagement · streak/badges]
        VO[voiceId / replyLanguage]
    end

    subgraph Builder["buildTutorPrompt()"]
        direction TB
        L1["audienceLine + styleLine"]
        L2["studentProfilePromptLines"]
        L3["learningMemoryPromptLines"]
        L4["formatEngagementLines"]
        L5["mediaLines + formatHistory"]
        L6["formatRules + thinkFirstRules"]
        L7["homeworkCoach (conditional)"]
        L8["OUTPUT_HYGIENE"]
        L1 --> L2 --> L3 --> L4 --> L5 --> L6 --> L7 --> L8
    end

    subgraph Output
        PROMPT["System Prompt · ~4000 chars"]
    end

    UT --> Builder
    IM --> Builder
    HI --> Builder
    PR --> Builder
    LM --> Builder
    EN --> Builder
    VO --> Builder
    Builder --> PROMPT
```

---

## 3. Prompt Layers

| # | Layer | Lines | Example |
|---|-------|-------|---------|
| 1 | Audience + Style | 2 | `Audience: international-school student … reply in 粤语` |
| 2 | Student Profile | 8 | `Name: Ryan (9). BASIS G4. Stronger: science curiosity.` |
| 3 | Learning Memory | 6–12 | `Skills: fractions ~76%, division ~32%. Focus on division.` |
| 4 | Engagement | 3 | `streak 3d · today 2 · total turns 12 · badge: 3-day streak` |
| 5 | Media + History | variable | Photo N descriptions, extracted PDF text, last 8 chat turns |
| 6 | Format Rules | 14 | Markdown, LaTeX, geometry diagrams, reading-comprehension cues |
| 7 | Think-First Coaching | 40+ | Hint ladder, anti-spoiler, interactive patterns, analogies, writing, science |
| 8 | Homework Coach | 11 (conditional) | Extra scaffolding when photos/files attached |

---

## 4. Hint Ladder

```mermaid
flowchart TD
    Q["Student asks conceptual question"]
    L0["L0 · Locate / Clarify\n→ What do you notice?"]
    L1["L1 · Interactive Choice\n→ 2–3 options · Which do you pick?"]
    L15["L1.5 · Explain Reasoning\n→ Why B? What clues?"]
    L2["L2 · Process Nudge\n→ Try ___ method · No key numbers"]
    L25["L2.5 · Second Chance\n→ Wrong → re-check this part"]
    L3["L3 · Stronger Scaffold\n→ Still stuck → more hints"]
    FULL["Full Solution\n→ Only if explicitly asked"]

    Q --> L0
    L0 --> L1
    L1 --> L15
    L15 -->|"correct"| L2
    L15 -->|"wrong"| L25
    L25 -->|"still wrong"| L3
    L2 -->|"stuck"| L3
    L3 -->|"explicit ask"| FULL

    L15 -.->|"2+ 'I don't get it'"| ANALOGY["Analogy Switch\nfractions → pizza\nplace value → money"]
    ANALOGY --> L2
```

---

## 5. Tool Dispatch

```mermaid
flowchart LR
    A["Agent decides to use tool"]
    A --> WS["web_search\nDuckDuckGo → Google\nkid-friendly sources"]
    A --> FP["fetch_page\nRead URL text"]
    A --> PY["run_python\nSandbox · 8s timeout"]
    A --> JS["run_js\nSandbox · 8s timeout"]
    A --> DG["draw_geometry\nShape spec → SVG markdown image"]
    A --> RS["recall_learner_skills\nRead BKT mastery snapshot"]

    DG --> IMG["![alt](data:image/svg+xml;base64,…)"]
    RS --> JSON["JSON · strengths / focus / recent"]
```

**Tool narration filtering** (`tutor-text-filter.ts`): If the agent says "Let me use web_search…" that chatter is stripped before the student sees the reply.

---

## 6. Output Hygiene

Rules injected into every prompt:

- Never narrate tools (`draw_geometry`, `web_search`, …)
- Status / thinking stays off-screen — only teaching text + diagrams shown
- Reply format: Markdown + LaTeX + `draw_geometry` images

---

## 7. AGENTS.md

The companion file `tutor-workspace/AGENTS.md` mirrors the prompt in a format the agent can reference. It is the **source of truth** for teaching behavior. Edits to `prompts.ts` should be reflected there.

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| Pure recall (7×8) | Skip Socratic ladder; confirm + memory tip |
| Medium computation (256÷8) | One hint first; confirm after attempt |
| "I don't know" | Stay at L0–L1; do not leap to answer |
| "I give up" | Empathize, shrink task, offer easier choice |
| Bored / "what should I do?" | 5-minute brain teaser (riddle, puzzle) |
| Empty user text | `defaultStudentLine()` per language |
| No history | Omit `[Recent chat]` block |

---

## Next: [Learning Memory & BKT](learning-memory.md)
