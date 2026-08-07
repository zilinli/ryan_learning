# Grade-Agnostic Adaptive Tutoring Design

> Version 0.2 · August 2026  
> Status: Design — transitioning from G4-only to K-12 adaptive  
> Research basis: SmartTutor AI (Cambridge, 2025), GraphMASAL (arXiv, 2025),  
> ES-LLMs (AIED 2026), IntelliCode (arXiv, 2025),  
> BASIS Charter & Independent Schools curriculum (2025-2026)

---

## 1. Motivation

Spark is currently hardcoded for **one learner** (Ryan, age 9, BASIS G4). The hardcoding spans:

| Layer | What's hardcoded |
|-------|-----------------|
| Student profile | `name: "Ryan"`, `age: 9`, `grade: "Grade 4 (G4)"`, `school: "BASIS"` |
| Curriculum | `BASIS_G4_CURRICULUM`, `ENVISION_G5_TOPICS` injected into every prompt |
| Skill catalog | 14 skills scoped to G4–G5 math/science/reading |
| BKT priors | Tuned for "Grade-4 scaffolding" (slip=0.10, guess=0.20) |
| Prompt text | `"Ryan"`, `"(G4–G5 accessible)"`, `"BASIS-critical"`, `"BASIS-style"` |
| Account seeding | `createAccount()` copies G4 defaults to every new student |
| UI | `"Hi Ryan!"`, `"Ryan"` as message label |

**Goal**: Make Spark work for any student G1–G12 while keeping G4 as the day-1 baseline. The system should adapt upward or downward based on BKT mastery — no manual grade toggle required.

---

## 2. Design Philosophy

```
           ┌─────────────────────────────────┐
           │   Student enters with grade N    │
           │   (or defaults to G4 baseline)   │
           └──────────────┬──────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│                                                  │
│  Skill Catalog filtered by grade range           │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ K-2      │ G3-5     │ G6-8     │ G9-12    │  │
│  │ 12 skills│ 20 skills│ 24 skills│ 28 skills│  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│                                                  │
│  BKT priors auto-selected by grade band          │
│  Prompt style / vocabulary scaled by age         │
│  --------------------------------------------   │
│  Adaptive Layer: BKT mastery adjusts difficulty  │
│  │  pKnown < 0.30 → review prerequisites        │
│  │  0.30–0.70 → ZPD sweet spot (current grade)   │
│  │  pKnown > 0.70 → stretch to next grade band   │
│  │  pKnown > 0.85 across band → auto-advance    │
│  -------------------------------------------------  │
│                                                  │
└─────────────────────────────────────────────────┘
```

Three layers of adaptation:

1. **Grade Band** — static, set once. Determines initial skill pool, BKT priors, vocabulary level.
2. **BKT Mastery** — dynamic, per skill. Adjusts within-band difficulty and practice frequency.
3. **Auto-Advance** — when mastery exceeds band ceiling, suggest upgrading grade band (parent opt-in).

---

## 3. Grade Band Model

Rather than a continuous grade, we bucket into **grade bands** that share pedagogical characteristics:

| Band | Grades | Age | Reading Level | Math Scope | Language Style |
|------|--------|-----|---------------|------------|----------------|
| `early` | K–2 | 5–7 | Simple sentences, concrete examples | Counting, shapes, basic +− | "Let's count together!", 实物比喻 |
| `elementary` | 3–5 | 8–10 | Short paragraphs, concrete → semi-abstract | Fractions, decimals, geometry basics | "Great thinking!", food/sharing metaphors (G4 baseline here) |
| `middle` | 6–8 | 11–13 | Full paragraphs, abstract concepts | Pre-algebra, algebra I, geometry | "Let's break this down", abstract analogy OK |
| `high` | 9–12 | 14–17 | Academic language, multi-step reasoning | Algebra II, trig, pre-calc, calculus | "Consider this approach", formal notation OK |

The **elementary band** is the day-1 baseline because it covers Ryan's current range and the existing skill catalog.

### 3.1 Band Derivation

```
gradeBand(gradeNumber: number): GradeBand
  1–2 → "early"
  3–5 → "elementary"  ← baseline
  6–8 → "middle"
  9–12 → "high"
```

### 3.2 Why BASIS Matters: One Curriculum, K-12

Spark's default curriculum targets **BASIS International Schools** (the school Ryan attends), which has a distinctive K-12 design:

| Feature | BASIS Approach | Implication for Spark |
|---------|---------------|----------------------|
| **Teach-up philosophy** | Curriculum is consistently 1-2 grade levels ahead of traditional schools. G5 uses Envision Mathematics G6; G1 teaches "author's purpose" which Cambridge reserves for G3. | Skill `coreGrade` should reflect actual BASIS pacing, not generic grade level. |
| **Three concurrent sciences** | Starting in G6, students take **Biology, Chemistry, AND Physics** simultaneously (3 days/week each). This spirals through G6→G7→G8 with increasing depth before Honors/AP in G9. | Skill catalog must support parallel multi-science tracks in a single grade band. |
| **Accelerated math pathway** | Prealgebra (G6) → Algebra I + Geometry (G7) → Algebra II + Geometry (G8) → Precalculus/AP Calc AB (G9) → AP Calc BC (G10) → Capstone Math (G12). | Math skill progression is compressed: what Common Core spreads across 7-12, BASIS does in 6-10. |
| **Honors floor at G9** | All G9+ courses are Honors minimum; students take 4+ AP courses and exams. No "regular" track exists. | `middle` band skills must meet Honors-readiness by G8 exit. |
| **Spiraling curriculum** | Science concepts are revisited in greater depth each year (G6 Bio → G7 Bio → G8 Bio), not taught once. | BKT `pLearn` should account for prior exposure even without mastery. |
| **World language from G7** | Mandarin, Spanish, French, or Latin starting G7, continuing through G12. | Language skill tracking needs its own sub-catalog for non-English language acquisition. |
| **Senior Capstone** | G12 culminates in independent research projects + daily college counseling, not standard coursework. | `high` band should have a post-AP "capstone" mode where agent acts as research advisor, not tutor. |

#### BASIS Grade-by-Grade Course Map (source: enrollbasis.com, 2025-2026)

| Grade | Math | Science | Humanities | Language | Elective |
|-------|------|---------|------------|----------|----------|
| **K-2** | Counting, shapes, basic ± | Observations, questions | Phonics, sight words, simple sentences | — | Art, Music, PE |
| **3-4** | Multiplication, fractions intro, place value | Simple experiments, ecosystems | Reading comprehension, narrative writing | — | Engineering (G4) |
| **5** | **Accelerated Math 5** (Envision G6) | General science + experiments | English 5, World History intro | — | Engineering, Art |
| **6** | **Prealgebra** (5×/wk) | **Biology 6, Chemistry 6, Physics 6** (3×/wk each) | English 6, World History & Geography I | Latin or Writing 6 | Elective (Art, CS, etc.) |
| **7** | **Algebra & Geometry I** (5×/wk) | Biology 7, Chemistry 7, Physics 7 (3×/wk each) | English 7, World History & Geography II | World Language (Chinese/French/Spanish/Latin) | Logic or Computer Logic |
| **8** | **Algebra II & Geometry** (5×/wk) | Biology 8, Chemistry 8, Physics 8 (3×/wk each) | English 8, US History | World Language | Elective |
| **9** | Honors Precalculus or AP Calc AB | **Honors Science 1** (Bio/Chem/Phys track selected) | Honors English Lang, AP World History, US Gov | World Language | Elective |
| **10** | AP Calc AB or BC | **Honors Science 2 / AP Science 1** | AP English Lang, AP World History | World Language | Elective |
| **11** | AP Calc BC or Post-AP Math | **AP Science 2 / Honors Science 3** | AP English Lang/Lit, AP US History | World Language | AP Micro+Macro |
| **12** | **Capstone Math** (Linear Algebra, etc.) | **Capstone Science** (Organic Chem, Modern Physics, etc.) | Capstone Humanities | Capstone Language | College Counseling, Senior Project |

This course map should inform skill ordering, prerequisite chains, and `coreGrade` assignments in the expanded skill catalog.
---

## 4. Skill Catalog Expansion

Current: 14 skills, G4–G5 only. Proposed: multi-band catalog.

### 4.1 New Skill Type

```typescript
type SkillDefinition = {
  id: string;
  label: string;
  /** Minimum grade for this skill to appear */
  minGrade: number;
  /** Grade at which this skill is "core" (ZPD-weighted) */
  coreGrade: number;
  /** Maximum grade after which this skill is considered mastered/retired */
  maxGrade: number;
  /** Skill band */
  band: GradeBand;
  /** Prerequisite skill IDs (within same or lower band) */
  prerequisites: string[];
  /** Subject area */
  subject: "math" | "science" | "reading" | "writing" | "general";
};
```

### 4.2 Skill Expansion Plan

Expand from 14 → ~80 skills across all bands:

**K-2 (early) — ~12 skills**
- Counting & cardinality, place value to 100, addition/subtraction within 20
- Basic shapes, measurement, telling time
- Letter sounds, sight words, simple sentences
- Observations & questions (science)

**G3-5 (elementary) — ~20 skills** ← current G4 catalog is here
- Multiplication/division fluency, fractions & decimals, place value
- Geometry basics, area/perimeter, multi-step word problems
- Reading comprehension with evidence, narrative writing
- Ecosystems, solar system, simple experiments

**G6-8 (middle) — ~24 skills** ← BASIS's "three-science" model starts here
- **Math**: Ratios & proportions, expressions & equations, statistics; Prealgebra → Algebra I + Geometry → Algebra II + Geometry (BASIS accelerated 3-year path)
- **Science (concurrent)**: Biology 6/7/8 (cells → genetics → evolution); Chemistry 6/7/8 (atoms → reactions → stoichiometry); Physics 6/7/8 (motion → forces → energy)
- **Humanities**: English 6/7/8 (literary analysis, argumentative writing, research skills); World History & Geography I+II → US History
- **World Language**: Latin (G6) or Mandarin/Spanish/French (G7+), basic proficiency → intermediate
- Key: BKT must handle 3 parallel science tracks in a single grade band — skills are not sequential across sciences but concurrent within each year

**G9-12 (high) — ~28 skills** ← BASIS Honors-floor + AP + Capstone model
- **Math**: Honors Precalculus → AP Calc AB → AP Calc BC → Capstone Math (Linear Algebra, Discrete Math, etc.)
- **Science (Honors/AP track)**: Honors Bio/Chem/Phys → AP Bio/Chem/Phys/Environmental Science → Capstone Science (Organic Chem, Modern Physics, Topics in Biology)
- **Humanities**: AP English Language & Composition, AP English Literature, AP World History, AP US History, AP US Gov, AP Micro+Macro Economics
- **World Language**: AP Chinese / Spanish / French / Latin (continued from G7)
- **Capstone**: Senior Project (independent research, daily college counseling seminar)
- Key: `high` band needs a post-AP "capstone" sub-mode where agent acts as research advisor, not drill tutor. By G12, the student is doing original work — Spark should coach methodology, not quiz facts.

### 4.3 Filtering by Grade

When a student's grade is N:
- Active skills = `allSkills` where `minGrade ≤ N ≤ maxGrade`
- `coreGrade` determines priming priority (skills near the student's grade get more prompt weight)
- `prerequisites` can cross bands (e.g., G6 algebra requires G4 fraction fluency)

---

## 5. BKT Parameter Tuning by Band

Current BKT defaults: `pInit=0.25, pLearn=0.18, pSlip=0.10, pGuess=0.20` — tuned for G4.

Per-band defaults:

| Band | pInit | pLearn | pSlip | pGuess | Rationale |
|------|-------|--------|-------|--------|-----------|
| early | 0.30 | 0.22 | 0.15 | 0.25 | Younger: higher guess (random tapping), faster learning once engaged |
| elementary | 0.25 | 0.18 | 0.10 | 0.20 | Baseline (current defaults) |
| middle | 0.20 | 0.15 | 0.08 | 0.15 | More deliberate, less guessing, slower concept change |
| high | 0.15 | 0.12 | 0.06 | 0.10 | Abstract thinkers, low guess rate, gradual mastery |

```typescript
function bktDefaultsForBand(band: GradeBand): BktParams { ... }
```

Existing per-skill BKT state is preserved — only new skills get the band defaults. Existing skills keep their learned parameters.

---

## 6. Prompt Adaptation

### 6.1 Age-Appropriate Language Style

Replace hardcoded coaching phrases with band-sensitive templates:

| Band | Confirmation | Encouragement | Stuck | Error |
|------|-------------|--------------|-------|-------|
| early | "Yes! You got it!" | "Keep going — you're doing great!" | "Let's try together" | "Almost! Want to try again?" |
| elementary | "That's correct" | "Great thinking!" | "What do you notice about..." | "That's not quite right — let's look again" |
| middle | "Correct" | "Good — keep reasoning" | "Consider the relationship between..." | "Re-examine your approach" |
| high | "That works" | "Sound logic" | "What assumptions are you making?" | "Review step 3 — there's an error" |

### 6.2 Curriculum Abstraction

Replace `BASIS_G4_CURRICULUM` + `ENVISION_G5_PROMPT_HINT` with profile-driven curriculum:

```typescript
type Curriculum = {
  label: string;          // e.g. "Common Core", "BASIS", "Singapore Math"
  grade: number;          // student's grade
  subjects: string[];     // active subjects
  textbookHints?: string;  // optional textbook references
};

function curriculumPromptLines(curriculum: Curriculum, band: GradeBand): string[] {
  // Generates context-appropriate curriculum notes
  // G3-5: "Fractions: keep denominators to 2,3,4,5,6,8,10,12,100"
  // G6-8: "Fractions extend to rational numbers, ratios, and proportional reasoning"
  // G9-12: "Rational functions, asymptotes, complex fractions"
}
```

### 6.3 Hint Ladder Sensitivity

The L0→L3 hint ladder already works for any age. Adjustments by band:
- **early**: L0 concrete ("Point to where it starts"), L3 full demonstration
- **elementary**: L0 clarifying, L3 scaffold with partial answer (current behavior)
- **middle/high**: L0 probing assumptions, L3 Socratic questioning more than scaffolding

---

## 7. Student Profile Changes

### 7.1 Updated `StudentProfile`

```typescript
type StudentProfile = {
  name: string;
  age: number;
  grade: number;           // now a number, not a string
  gradeBand: GradeBand;   // derived: "early" | "elementary" | "middle" | "high"
  school: string;
  curriculum: Curriculum | null;
  preferredChinese: "yue" | "cmn" | null;
  stronger: string[];      // existing: strengths
  focusAreas: string[];    // existing: areas needing attention
};
```

### 7.2 Default Profile

```typescript
export const DEFAULT_STUDENT_PROFILE: StudentProfile = {
  name: "",                // prompt user on first launch
  age: 9,                  // untuned fallback
  grade: 4,                // G4 baseline
  gradeBand: "elementary",
  school: "",
  curriculum: null,        // null → curriculum auto-detected from grade
  preferredChinese: null,
  stronger: [],
  focusAreas: [],
};
```

### 7.3 Ryan's Profile (preserved)

Ryan's current profile becomes a saved account, not the system default:

```typescript
export const RYAN_PROFILE: StudentProfile = {
  name: "Ryan",
  age: 9,
  grade: 4,
  gradeBand: "elementary",
  school: "BASIS International School",
  curriculum: {
    label: "BASIS G4 (Envision Math G5 accelerated)",
    grade: 4,
    subjects: ["math", "science", "humanities", "ela"],
    textbookHints: "BASIS G5 Envision Mathematics (Savvas, ISBN 978-1-4188-4685-5)",
  },
  preferredChinese: "yue",
  stronger: ["science curiosity", "trying again after a short break"],
  focusAreas: ["multi-step fraction word problems", "staying calm when stuck"],
};
```

---

## 8. Auto-Advance Mechanism

When a student consistently operates above their grade band:

```
autoAdvanceCheck(memory: LearningMemory, profile: StudentProfile): AdvanceSuggestion | null {
  const activeSkills = skillCatalog.filter(profile.gradeBand, profile.grade);
  const mastery = activeSkills.map(s => bktState(s.id));
  
  if (mastery.every(m => m.pKnown > 0.85) && profile.gradeBand !== "high") {
    return {
      suggestedBand: nextBand(profile.gradeBand),
      confidence: calculate confidence,
      skillsReady: count of ready skills,
    };
  }
  return null;
}
```

Auto-advance is **parent opt-in** — the system suggests, doesn't auto-switch. This mirrors the existing PIN-gate pattern for code changes.

---

## 9. Multi-Account Support

Currently: `loadAccounts()` always seeds `RYAN_ACCOUNT_ID` first. Every `createAccount()` copies G4 defaults.

Changes:
- `createAccount()` accepts optional `profile: Partial<StudentProfile>` — new students get bare defaults, not Ryan's
- `RYAN_ACCOUNT_ID` remains as a pre-seeded account for backward compatibility
- Account creation UI asks for name, age, grade (optional, defaults to 4)
- `ensureRyan()` → `ensureDefaultAccount()` (backward-compatible: still creates Ryan's profile if it's the only account)

---

## 10. AGENTS.md Updates

Remove hardcoded "Ryan, age 9, Grade 4 at BASIS" from the agent instructions. Replace with:

```
You are tutoring {name}, age {age}, Grade {grade} at {school}.
Adjust your language complexity to match approximately grade level:
- K-2: simple sentences, concrete examples, lots of encouragement
- 3-5: conversational, semi-abstract, food/sharing metaphors
- 6-8: analytical, abstract OK, "consider" / "examine"
- 9-12: academic, formal notation OK, Socratic questioning
Current curriculum: {curriculumText or "general grade-appropriate topics"}.
```

---

## 11. Implementation Strategy

### Principle: Ship incrementally, don't break Ryan

- **Phase A (profile + band)** — minimal: make grade functional, keep existing catalog
- **Phase B (skill catalog)** — expand to multi-band
- **Phase C (prompts)** — age-adaptive language
- **Phase D (auto-advance)** — mastery-based band suggestion
- **Phase E (multi-account)** — true multi-student

Each phase is independently shippable and tested against Ryan's existing experience (no regression).

---

## 12. Risk & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking Ryan's experience | Full regression test suite with Ryan's profile, BKT state snapshots |
| Skill catalog explosion | Start with elementary band expansion only (G3-5), add upper bands in later phases |
| Prompt quality regression | A/B compare prompt output for Ryan before/after each phase |
| BKT parameter change invalidates historical data | Keep existing parameters; new parameters only for new skills/bands |
| Performance (80+ skills) | BKT is O(1) per skill; only active band's skills are in memory |

---

## 13. References & Research Foundation

This design draws on current academic research in adaptive tutoring systems, multi-agent architectures, and knowledge tracing.

### 13.1 Industry Research

**SmartTutor AI** (Cambridge, 2025) — Demonstrates that curriculum-aligned adaptive tutoring should separate generative AI (language) from pedagogical logic (instructional decisions). Key takeaway: *instructional decisions are governed by explicit pedagogical logic and structured curriculum representations, enabling personalized learning progression while maintaining safety, reliability, and exam alignment.* Spark's hint ladder + BKT already embodies this principle; the grade band extension formalizes the curriculum representation layer.

**GraphMASAL** (arXiv:2511.11035, 2025) — A graph-based multi-agent system for adaptive learning with four core components: (i) dynamic knowledge graph for persistent learner modeling, (ii) LangGraph orchestration layer for Diagnoser/Planner/Tutor agents, (iii) neural IR for concept grounding, (iv) multi-source multi-sink planning engine. Key takeaway: *a grade-agnostic design uses structured curriculum representations (Knowledge Graphs/DAGs) rather than grade-locked content.* Spark's skill catalog + prerequisite graph already forms this knowledge graph; expanding it across bands makes grade-agnostic adaptation possible.

**ES-LLMs** (AIED 2026, arXiv:2603.23990) — An Ensemble of Specialized LLMs architecture for adaptive tutoring. Maps to the triarchic blueprint: Expert Model (domain knowledge), Learner Model (BKT mastery), Tutor Model (agent policies and orchestrator), with LLM restricted to surface realization. Key takeaway: *pedagogical policy can be externalized as explicit, testable rules.* Spark's `studentProfilePromptLines()` and `buildTutorPrompt()` already separate policy from generation; the band-adaptive language presets extend this to age-appropriate realization.

**IntelliCode** (arXiv:2512.18669, 2025) — A multi-agent LLM tutoring system with centralized learner modeling. Frames adaptive education as a Partially Observable Markov Decision Process (POMDP): learner state maintains mastery vectors, SM-2 review schedules, engagement metrics, and metacognitive memory. The StateGraph Orchestrator is the only component permitted to write to the persistent learner record. Key takeaway: *the orchestrator validates proposed state changes and commits them as atomic updates, preventing conflicting writes.* Spark's `mergeLearningMemory` already handles merge semantics; extending it to band-aware skill filtering follows the same atomic-update pattern.

### 13.2 BASIS-Specific Foundations

- **BASIS Charter School Curriculum (enrollbasis.com)** — Full K-12 grade-by-grade course map with the distinctive three-science-concurrent model (Biology, Chemistry, Physics starting G6), accelerated math pathway (Prealgebra G6 → AP Calc BC G10 → Capstone Math G12), and Honors-floor-at-G9 philosophy. See §3.2 for detailed course map.
- **BASIS Independent Schools (basisindependent.com)** — "Teach-up" pedagogy: curriculum consistently 1-2 years ahead of traditional schools. Content scope remains standard but is introduced earlier with greater depth.
- **BASIS Scottsdale & Washington DC 2025-2026 Curricular Materials** — Confirms Savvas Envision Mathematics as textbook across all grades (G5 Accelerated → G6 Envision, Algebra I → Envision A|G|A, AP Calc → Larson/Stewart). Khan Academy listed as supplementary resource.

### 13.3 Design Principles (Synthesized)

From the research above, five principles guide Spark's grade-agnostic redesign:

| # | Principle | Source | Spark Implementation |
|---|-----------|--------|---------------------|
| 1 | **Separate policy from generation** | SmartTutor AI, ES-LLMs | Hint ladder rules in `prompts.ts` are deterministic; LLM only realizes surface text |
| 2 | **Structured curriculum representation** | GraphMASAL | Skill catalog with `minGrade`/`maxGrade`/`prerequisites` forms a K-12 DAG |
| 3 | **Centralized learner model** | IntelliCode | BKT + SM-2 + engagement state in `learning-memory.ts` is the single source of truth |
| 4 | **Explicit pedagogical constraints** | ES-LLMs | `curriculumPromptLines()` enforces grade-appropriate scaffolding rules per band |
| 5 | **Atomic state updates** | IntelliCode | `mergeLearningMemory` + `lockedWriteJson` pattern prevents race conditions on multi-device sync |
