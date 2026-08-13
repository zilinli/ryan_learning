# Learning Games — Design & Implementation

> Version 1.0 · 2026-08-13
> Scope: the three flagship **Learning Games** on `/entertain` — **Fraction Voyager** (🚀), **Eco Genesis** (🌍), **Time Vault** (📜). These replaced the original *Fraction Forge*, *Eco Tower*, and *Timeline Detective* in 2026-08.

---

## 1. Why these three games

The previous Learning Games (Fraction Forge / Eco Tower / Timeline Detective) suffered from two problems: **form-heavy UI** (input boxes, dropdowns, arrow buttons) and **content that did not teach through play**. The replacement follows three principles distilled from the [four-dimension research reports](../../evaluation/Spark_四维学习力深度调研报告_V3_2026-08-13.md) and industry practice (ST Math direct manipulation, Mathigon Polypad, Answer-Until-Correct feedback studies, Synthesis/Prodigy "mechanic-is-the-lesson"):

1. **The game mechanic IS the learning** — no input boxes or dropdowns; the operation itself is the math / reading / systems thinking (ST Math style).
2. **Wrong answers have visible world consequences** — the ship bounces back, cards snap back, a population fades away — instead of a red cross.
3. **ZPD adaptivity + cognitive data loop** — every round reads BKT `pKnown`, targets the Zone of Proximal Development, and records an attributed turn through `recordStudioLearningTurn` (same BKT path as tutor chat).

Acceptance criteria for all three: no text inputs / dropdowns, Answer-Until-Correct retry, BKT closed loop, collection/progression element, no public leaderboards.

---

## 2. Game 1 · Fraction Voyager 分数远航

Replaces *Fraction Forge*. Fly a ship along a number line to a target fraction.

| File | Purpose |
|------|---------|
| `src/lib/entertain/fraction-voyager.ts` | Pure logic: mission generation, validation, misconception detection, ZPD mapping |
| `src/lib/entertain/fraction-voyager.test.ts` | Unit tests |
| `src/components/FractionVoyagerGame.tsx` | Space-themed UI: glowing number line, animated ship, task cards |

### 2.1 Mission kinds

| Kind | Training target | Interaction |
|------|-----------------|-------------|
| `place` | Number-line partitioning (strongest evidence-backed skill) | Tap the number line to park the ship at `3/4`. Wrong → ship lands and bounces back (AUC, retry instantly). Placing at `≥1` when the target `<1` flags `frac-whole-vs-part`. |
| `compare` | Fraction magnitude | Two fuel-tank bars; tap the fuller one. Picking `1/8` over `1/4` flags `frac-bigger-denom` with a visible message. |
| `partition` | Equivalent fractions | Slice a `1/2` bar into `N` equal pieces (tap to subdivide) and fill the amount matching `2/4`. Filling the whole bar flags `frac-whole-vs-part`. |

### 2.2 Data model (pure functions)

```typescript
type VoyagerMission = {
  id: number;
  kind: "place" | "compare" | "partition";
  difficulty: number;          // 1–5
  prompt: string;
  target: [number, number];    // [numerator, denominator]
  lineMax: 1 | 2;              // 2 allows improper fractions > 1
  ticks: number;               // equal divisions on the line
  compareLeft? / compareRight? / leftIsBigger?  // compare missions
  bar? / pieceCount? / fillCount?               // partition missions
  skill: "fractions-concepts" | "equivalent-fractions" | "fraction-word-problems";
};
```

Key functions: `generateMission(kind, difficulty, id)`, `validateVoyagerAnswer(mission, answer)`, `tickForFraction(num, den, ticks, lineMax)`, `difficultyFromPKnown(pKnown)`.

### 2.3 ZPD difficulty ladder

`difficultyFromPKnown(pKnown)` maps BKT mastery to tiers 1–5 (p≈0.7 is the learning sweet spot):

| pKnown | Difficulty | Denominator pool | Extra |
|--------|-----------|------------------|-------|
| < 0.30 | 1 | 2, 3, 4 | line 0–1 only |
| < 0.50 | 2 | 2, 3, 4, 6 | line 0–1 |
| < 0.70 | 3 | 3, 4, 6, 8 | line 0–1 |
| < 0.85 | 4 | 4, 6, 8, 10 | line 0–2, partition scale ×2–3 |
| ≥ 0.85 | 5 | 4, 6, 8, 10, 12 | improper fractions on 0–2 |

### 2.4 BKT loop

Each submission calls `recordStudioLearningTurn({ source: "writing", ... })` with a skill seed like `fractions concepts number line place locate 3/4 magnitude`. Wrong answers additionally write the detected misconception (`frac-whole-vs-part`, `frac-bigger-denom`) into learning memory via `applyMisconceptionToMemory` — the same misconception book the tutor uses, so Progress surfaces it.

### 2.5 Collection

Each solved planet mission lights up a star on the star map (light progress, no leaderboard).

---

## 3. Game 2 · Eco Genesis 生态创世

Replaces *Eco Tower*. Build a food web in a habitat, predict what happens, then watch a real multi-step population simulation run.

| File | Purpose |
|------|---------|
| `src/lib/entertain/eco-genesis.ts` | Pure simulation engine: `stepEcosystem`, `runGenesis`, `predictSurvival`, disaster events, arrow validation, species catalog |
| `src/lib/entertain/eco-genesis.test.ts` | Unit tests |
| `src/components/EcoGenesisGame.tsx` | Habitat scene UI with animated population bars |

### 3.1 Core loop

1. **Build** — tap organisms from the card pool into the habitat (no dropdowns). Tap eater then prey to draw "who eats whom" energy arrows.
2. **Predict (ICAP active-engagement)** — before running, answer "will this ecosystem survive `GENESIS_STEPS` seasons?" Predicting is itself the learning moment.
3. **Simulate** — step through 6 discrete time steps. Producer populations grow logistically (`growth = pop × birthRate × (1 − pop / carryingCapacity)`); consumers grow on prey surplus and starve fast when food supply hits zero:
   - balanced web → habitat lights up "ecosystem light", +30
   - collapsed → extinct species **fade away** (visible causal consequence)
4. **Disaster events** — drought slashes producers, heatwave shrinks everyone, bumper season boosts producers. The student predicts the effect and re-runs.

### 3.2 Simulation engine (pure, testable)

```typescript
type GenesisSpecies = {
  id: string; name: string; emoji: string;
  trophic: "producer" | "primary" | "secondary" | "tertiary" | "apex";
  biome: string;
  population: number;
  birthRate: number;        // producer logistic growth per step
  deathRate: number;        // natural death fraction per step
  carryingCapacity: number;
  conversion: number;       // food units each prey individual provides
  maintenance: number;      // food units needed per step
  blurb: string;
};
type GenesisArrow = [eaterId, preyId];

function stepEcosystem(species, arrows): GenesisSpecies[];  // one discrete step
function runGenesis(species, arrows, steps = 6): GenesisRun; // full run + survive verdict
function predictSurvival(species, arrows): boolean;           // used to check the prediction
function applyGenesisEvent(species, event): GenesisSpecies[]; // disaster application
function validateGenesisArrows(species, arrows): ArrowCheck;  // quick feedback while building
```

`GenesisRun` returns `{ snapshots, survived, extinct, atRisk }`. "Survived" means every initial species is still above zero after 6 steps — so a food web with a missing arrow visibly collapses (the classic "no food for the snake" moment).

### 3.3 Biomes & species

Four biomes (`grassland`, `forest`, `ocean`, `desert`) × 4–5 species each (producer → apex, e.g. Grass → Grasshopper → Frog → Snake → Hawk). Invasive-species event adds a Raccoon.

### 3.4 BKT loop

`recordStudioLearningTurn({ source: "natgeo", ... })` with seed `ecosystem habitat grassland food chain predator prey producer consumer energy flow population dynamics`. Predictions are recorded with outcome correct/incorrect — wrong predictions are the richest signal.

---

## 4. Game 3 · Time Vault 时空档案局

Replaces *Timeline Detective*. You are an archive agent; each round opens a scrambled historical dossier that the AI can generate **unbounded** (with a rich static fallback bank).

| File | Purpose |
|------|---------|
| `src/lib/entertain/time-vault.ts` | Case model, static fallback bank, validation, ZPD spec, AI system prompt, JSON parser |
| `src/lib/entertain/time-vault.test.ts` | Unit tests |
| `src/app/api/time-vault/case/route.ts` | AI case generation endpoint (with hard timeout) |
| `src/components/TimeVaultGame.tsx` | Dossier/case-file aesthetic: timeline rail + evidence linking |

### 4.1 Core loop

1. **Dossier** — narrative title + a grade-appropriate passage (sentences numbered).
2. **Timeline** — drag / tap event cards onto a horizontal timeline rail (mobile: tap backlog → tap empty rail slot). Answer-Until-Correct — misplaced cards bounce back.
3. **Evidence binding** — tap an event on the rail → the passage highlights the sentence that proves its date (`evidenceMap`), confirm the link.
4. **Close** — all correct → earn an artifact shard; collect shards to light up the civilization gallery.

### 4.2 Case model

```typescript
type TimeVaultEvent = { id: string; label: string; year: number; emoji: string }; // year < 0 = BCE
type TimeVaultCase = {
  id: string;
  title: string;
  civilization: string;          // collection theme
  intro: string;                 // narrative hook on the dossier cover
  passage: string;               // sentences split & numbered in UI
  events: TimeVaultEvent[];
  correctOrder: string[];        // earliest → latest
  evidenceMap: Record<string, number>; // eventId → sentence index proving its date
  difficulty: number;            // 1–5
};
```

`validateTimeVault(case, { order, evidence })` returns order/evidence correctness plus the exact `misplaced` and `badEvidence` ids — the UI uses them for the bounce-back and highlight.

### 4.3 ZPD case spec

`difficultyFromPKnown(pKnown)` → `caseSpecForDifficulty(difficulty)`:

| pKnown | Difficulty | Passage | Events | Cross-civilization | Explicit evidence hint |
|--------|-----------|---------|--------|--------------------|------------------------|
| < 0.30 | 1 | ~80 words | 3 | — | yes |
| < 0.50 | 2 | ~120 | 4 | — | yes |
| < 0.70 | 3 | ~160 | 4 | — | no |
| < 0.85 | 4 | ~200 | 5 | yes (compare two civs) | no |
| ≥ 0.85 | 5 | ~240 | 5 | yes | no |

### 4.4 AI case generation + resilience

`POST /api/time-vault/case` asks the Cursor agent to produce a `TimeVaultCase` JSON from `timeVaultSystemPrompt(spec, learner)`. Resilience is layered:

1. **Static fallback first** — the client enters the game instantly with a case from `FALLBACK_CASES` (8 curated cases across Egypt / Mesopotamia / World History).
2. **Hot-swap in background** — while the player reads the dossier, the client requests an AI case (client-side 25s `AbortController` timeout). If it arrives while still in the dossier phase (before timeline placement starts), the case hot-swaps in and shows "AI generated". If the player has already started, the fallback case stays — never disrupting play.
3. **Server hard timeout** — the route races agent generation against a 20s `Promise.race` timeout; on timeout or parse failure it returns the fallback case with difficulty. Never blocks, never hangs.

This makes opening the game instant (the original bug where a 100s generation blocked the loading screen), while still getting fresh AI content whenever the backend can deliver it.

---

## 5. Engineering & registration

### 5.1 GameId registry

`src/lib/entertain/types.ts` — `GameId` includes `fraction-voyager`, `eco-genesis`, `time-vault`. The old `fraction-forge` / `timeline-detective` / `eco-tower` ids and their files (`FractionForgeGame.tsx`, `TimelineDetectiveGame.tsx`, `EcoTowerGame.tsx`, `fraction-forge.ts`, `timeline-cases.ts`, `eco-tower.ts`, `eco-cards.ts` + tests) were **deleted**, not kept behind a flag.

### 5.2 Registration

`src/components/EntertainPage.tsx`:
- `GAMES` list — the three Learning Games are the **first, most prominent section** ("Learning Games — Practice with purpose"), rendered by the accent-bordered `LearningGameCard` component (teal, hover lift).
- Board games / arcade / logic puzzles render below under "Logic & Fun".
- `TITLES` map and the game switch render each component (`activeGame === "fraction-voyager" && <FractionVoyagerGame />`, etc.).

### 5.3 Shared infrastructure

- **BKT** — all three call `recordStudioLearningTurn` (`source: "writing" | "natgeo"`) → per-account learning memory → visible on `/dashboard` Progress.
- **Focus guardrail** — the Games hub shows the non-blocking homework nudge banner; it never locks the games.
- **No leaderboards** — the only progression is private collection (stars / biomes / artifacts).

---

## 6. Test plan (Vitest, node env)

```bash
npm test -- src/lib/entertain/fraction-voyager.test.ts
npm test -- src/lib/entertain/eco-genesis.test.ts
npm test -- src/lib/entertain/time-vault.test.ts
```

| Suite | Coverage highlights |
|-------|---------------------|
| `fraction-voyager.test.ts` | `tickForFraction` exact tick, difficulty band boundaries, place/compare/partition correct + each misconception path |
| `eco-genesis.test.ts` | producer logistic growth, consumer starvation at zero food, correct vs broken food web survival, disaster effects, arrow validation |
| `time-vault.test.ts` | difficulty bands, fallback bank integrity (evidenceMap in range), validation order/evidence, JSON parse fallbacks |

Self-verify gate: `npm test` (full suite) and `npx tsc --noEmit` before deploy.

---

## 7. Related docs

- [entertainments.md](./entertainments.md) — the games engine hub (`/entertain`) and Studio (`/studio`)
- [spark-research-roadmap.md](./spark-research-roadmap.md) — four-dimension learning loop P0–P3
- [memory-bkt.md](./memory-bkt.md) — Bayesian Knowledge Tracing engine
- [studio-learning.ts](../../src/lib/entertain/studio-learning.ts) — BKT attribution source
- Four-dimension research: [V3 report](../../evaluation/Spark_四维学习力深度调研报告_V3_2026-08-13.md)
