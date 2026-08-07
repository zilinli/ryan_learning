# Grade-Agnostic Adaptive Tutoring Design

> Version 0.1 · August 2026  
> Status: Design — transitioning from G4-only to K-12 adaptive

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

**G6-8 (middle) — ~24 skills**
- Ratios & proportions, expressions & equations, statistics
- Geometry (angles, volume), negative numbers, pre-algebra
- Argumentative writing, text analysis, research skills
- Physical science, earth science, scientific method

**G9-12 (high) — ~28 skills**
- Algebra I/II, geometry proofs, trigonometry, pre-calculus, calculus
- Statistics & probability, functions & modeling
- Literary analysis, persuasive writing, research papers
- Biology, chemistry, physics, environmental science

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
