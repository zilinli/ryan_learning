# Word Echo — study then spell

> Version 1.1 · 2026-08-16  
> Scope: Learning Game on `/entertain` — **Word Echo** (`word-echo`). Memorize a short random word list, then **spell each word from memory** (not tap-recognition).

---

## 1. Problem

v1.0 used **study → tap among distractors** (recognition). That trains working memory + sight ID, but **spelling production** is the higher-value literacy skill for G4. Research (listen-and-spell / generation effect): producing graphemes from memory beats selecting a printed word.

## 2. Approach

Classic **study → hide → spell (type)** loop:

1. **Mechanic = lesson** — the action is spelling the echo, not multiple-choice taps.
2. **Answer-Until-Correct** — wrong spelling keeps the prompt; adjust and retry (no instant full reveal).
3. **ZPD** — difficulty from BKT `pKnown` on ELA skills (`letter-sounds` / `reading-evidence`).
4. **Scaffolding** — easy levels show letter blanks; mid shows length only; hard has no length hint.
5. **Private progress** — echo nodes (1–5) light up; no leaderboard.
6. **Offline word bank** — curated G4-friendly English words.

### 2.1 Core loop

1. **Study** — show `targetCount` random words for `studyMs`.
2. **Spell** — one target at a time (study order). Learner types the word; Check validates.
3. **Advance** — on correct, next target; after last target, record BKT turn and clear node.
4. **Next round** — bump difficulty via streak / pKnown.

### 2.2 Difficulty ladder

| pKnown | Diff | Targets | Study ms | Hint |
|--------|------|---------|----------|------|
| < 0.30 | 1 | 2 | 6000 | blanks (`_ _ _ _`) |
| < 0.50 | 2 | 3 | 5500 | blanks |
| < 0.70 | 3 | 3 | 5000 | length only (`5 letters`) |
| < 0.85 | 4 | 4 | 4500 | none |
| ≥ 0.85 | 5 | 5 | 4000 | none |

### 2.3 Data model (pure)

```ts
type HintMode = "blanks" | "length" | "none";

type WordEchoRound = {
  id: number;
  difficulty: number;
  targets: string[];
  studyMs: number;
  hintMode: HintMode;
  skill: "letter-sounds" | "reading-evidence";
};

function normalizeSpelling(raw: string): string; // trim + lower + letters only
function validateSpelling(expected: string, typed: string): {
  correct: boolean;
  outcome: "correct" | "incorrect";
  message: string;
};
function spellingHint(word: string, mode: HintMode): string;
function difficultyFromPKnown(pKnown: number): number;
function pickRound(difficulty: number, rng?): WordEchoRound;
```

Recognition helpers (`pool`, `validateEcho`, `requireOrder`) are removed in v1.1.

### 2.4 BKT

`recordStudioLearningTurn({ source: "game", skillSeed: "… spelling …", outcome })` once per completed round (all targets spelled). Per-word incorrect checks may also record `incorrect` lightly, or only final round outcome — **implementation: record on each Check** (matches v1.0 AUC feedback to memory).

## 3. Key files

| Path | Role |
|------|------|
| `src/lib/entertain/word-echo.ts` | Pure logic + word bank + spelling validate |
| `src/lib/entertain/word-echo.test.ts` | Unit tests |
| `src/components/WordEchoGame.tsx` | UI (study timer + spell input) |
| `src/components/EntertainPage.tsx` | Hub card copy |
| `src/lib/entertain/types.ts` | `GameId` includes `word-echo` |
| `src/components/learning-games/tokens.ts` / `icons.tsx` | Accent + SVG mark |

Visual: deep ink base `#0e1218` + cyan accent `#38bdf8`.

## 4. Risks

| Risk | Mitigation |
|------|------------|
| Typing harder than tapping on mobile | Large input, `inputMode="text"`, autoFocus, Enter to check |
| Hint leaks too much | blanks only L1–2; L4–5 none |
| Word bank too hard | Keep G4 mix; length mostly 4–8 |
| Edit budget | Replace recall path; drop distractor pool |

## 5. Test design

### Unit (`word-echo.test.ts`)

- `difficultyFromPKnown` band boundaries
- `pickRound` target counts, hintMode by difficulty, unique targets
- `normalizeSpelling` / `validateSpelling` exact match, case/space tolerant, wrong letter
- `spellingHint` blanks / length / none
- Word bank: all lowercase letters, length ≥ 3, no duplicates

### Integration / manual

- Hub copy mentions spell; `?game=word-echo` opens spell flow
- Study → auto-hide → type → Check → next word → Next echo; mobile 375px usable

```bash
npm test -- src/lib/entertain/word-echo.test.ts
```
