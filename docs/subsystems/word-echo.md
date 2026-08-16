# Word Echo — random word memory game

> Version 1.0 · 2026-08-16  
> Scope: new Learning Game on `/entertain` — **Word Echo** (`word-echo`). Memorize a short random word list, then tap the same words among distractors.

---

## 1. Problem

Ryan needs a light, repeatable **working-memory + vocabulary** drill that fits Games (not Studio labs). Existing Learning Games cover fractions / physics / eco / history; there is no word-recall mechanic.

## 2. Approach

Classic **study → hide → identify among distractors** (Train-the-Brain / Focusfloo pattern), adapted to Spark Learning Games rules:

1. **Mechanic = lesson** — the action is recalling the set (tap chips), no typing boxes.
2. **Answer-Until-Correct** — wrong check flags extras (does not reveal missing targets); adjust and retry.
3. **ZPD** — difficulty from BKT `pKnown` on ELA skills (`letter-sounds` / `reading-evidence`).
4. **Private progress** — echo nodes (1–5) light up; no leaderboard.
5. **Offline word bank** — curated G4-friendly English words (no live dict API required).

### 2.1 Core loop

1. **Study** — show `targetCount` random words for `studyMs`.
2. **Recall** — shuffled pool = targets + distractors; tap to toggle selection.
3. **Check** — set equality (difficulty ≤ 3) or **ordered** recall (difficulty ≥ 4).
4. **Next** — on correct, record BKT turn and advance; bump difficulty via streak / pKnown.

### 2.2 Difficulty ladder

| pKnown | Diff | Targets | Distractors | Study ms | Order |
|--------|------|---------|-------------|----------|-------|
| < 0.30 | 1 | 3 | 3 | 5000 | set |
| < 0.50 | 2 | 4 | 4 | 4500 | set |
| < 0.70 | 3 | 5 | 5 | 4000 | set |
| < 0.85 | 4 | 6 | 6 | 3500 | ordered |
| ≥ 0.85 | 5 | 7 | 7 | 3000 | ordered |

### 2.3 Data model (pure)

```ts
type WordEchoRound = {
  id: number;
  difficulty: number;
  targets: string[];
  pool: string[];       // shuffled targets + distractors
  studyMs: number;
  requireOrder: boolean;
  skill: "letter-sounds" | "reading-evidence";
};

function difficultyFromPKnown(pKnown: number): number;
function pickRound(difficulty: number, rng?): WordEchoRound;
function validateEcho(round, selected: string[]): {
  correct: boolean;
  outcome: "correct" | "incorrect";
  missing: string[];
  extra: string[];
  message: string;
};
```

### 2.4 BKT

`recordStudioLearningTurn({ source: "game", skillSeed: "sight word vocabulary …", outcome })`.

## 3. Key files

| Path | Role |
|------|------|
| `src/lib/entertain/word-echo.ts` | Pure logic + word bank |
| `src/lib/entertain/word-echo.test.ts` | Unit tests |
| `src/components/WordEchoGame.tsx` | UI (study timer + tap chips) |
| `src/lib/entertain/types.ts` | `GameId` += `word-echo` |
| `src/components/EntertainPage.tsx` | Hub card + mount |
| `src/components/learning-games/tokens.ts` / `icons.tsx` | Accent + SVG mark |

Visual: deep ink base `#0e1218` + cyan accent `#38bdf8` (fits v2 dark single-accent language).

## 4. Risks

| Risk | Mitigation |
|------|------------|
| Word bank too hard / too baby | G4 school + nature + action mix; no slang |
| Study timer unfair on slow devices | Pause study when tab hidden; min study floor |
| Ordered mode confusing | Diff ≥ 4 only; numbered slots |
| Edit budget | Pure logic + one component + registry patches |

## 5. Test design

### Unit (`word-echo.test.ts`)

- `difficultyFromPKnown` band boundaries
- `pickRound` target/distractor counts, pool uniqueness, targets ⊆ pool
- `validateEcho` correct set / wrong missing / wrong extra
- Ordered mode: correct order vs wrong permutation
- Word bank: all lowercase letters, length ≥ 3, no duplicates

### Integration / manual

- Hub shows Word Echo under Learning Games; `?game=word-echo` opens it
- Study → auto-hide → tap → Check → Next; mobile 375px usable
- Correct turn updates learning memory (optional smoke)

```bash
npm test -- src/lib/entertain/word-echo.test.ts
```
