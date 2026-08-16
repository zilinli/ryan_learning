# Spell Words (Word Echo) — hear & spell one word at a time

> Version 1.3 · 2026-08-16  
> Scope: Learning Game on `/entertain` — display name **Spell Words** (internal id `word-echo`).  
> **v1.3 shift:** drop batch list-memory; align with dictation / spelling-bee practice (one word identity via peek + audio + gloss).

---

## 1. Problem

v1.2 used **study a list → hide → spell word N of M from memory**. Learners reported:

- Too many words at once (working-memory overload).
- Even when they know spellings, they cannot tell **which** word is expected — blanks/length alone do not identify the lemma.

Industry practice (Scripps-style bee, EZSpell Dictation Coach, Duolingo Listen & Type):

1. **One word at a time** — never quiz order recall of a hidden list.
2. **Identity cue** — pronounce the word (TTS); optional definition / sentence.
3. **Production** — type the graphemes (answer-until-correct).
4. **Replay** — hear again on demand.

---

## 2. Approach (v1.3)

### 2.1 Core loop (per target)

1. **Peek** — show **only the current word** for `peekMs` (learner may skip early).
2. **Spell** — hide letters; auto-play English TTS; show **gloss** (meaning cue) + scaffolding hint + **Hear again**.
3. **Check** — answer-until-correct; on correct, advance to next target’s peek (or clear round).

Round still batches 1–3 words for progress dots, but **never** requires remembering the whole set at once.

### 2.2 Difficulty ladder

| pKnown | Diff | Targets | Peek ms | Hint |
|--------|------|---------|---------|------|
| < 0.30 | 1 | 1 | 3500 | blanks |
| < 0.50 | 2 | 2 | 3000 | blanks |
| < 0.70 | 3 | 2 | 2500 | length |
| < 0.85 | 4 | 3 | 2000 | length |
| ≥ 0.85 | 5 | 3 | 1500 | none |

Gloss + Hear are always available (identity ≠ letter leak).

### 2.3 Data model (pure)

```ts
type HintMode = "blanks" | "length" | "none";

type WordEchoRound = {
  id: number;
  difficulty: number;
  targets: string[];
  peekMs: number; // was studyMs (list study)
  hintMode: HintMode;
  skill: "letter-sounds" | "reading-evidence";
};

function wordGloss(word: string): string; // short EN meaning cue
function spellingHint(word: string, mode: HintMode): string;
function validateSpelling(expected: string, typed: string): WordEchoSpellResult;
```

### 2.4 Audio

UI calls `getSharedSpeechEngine()` with English voice (`voiceId` suitable for EN, e.g. `alvaro` / auto EN). Unlock on Start / Hear. Stop on unmount.

### 2.5 BKT

Unchanged: `recordStudioLearningTurn` on each Check.

---

## 3. Key files

| Path | Role |
|------|------|
| `src/lib/entertain/word-echo.ts` | Bank, gloss, pickRound, validate |
| `src/lib/entertain/word-echo.test.ts` | Unit tests |
| `src/components/WordEchoGame.tsx` | Peek → Hear → Spell UI |
| `src/components/EntertainPage.tsx` | Hub card copy |

---

## 4. Risks

| Risk | Mitigation |
|------|------------|
| TTS latency / fail | Hear button retry; gloss still identifies word |
| Gloss leaks spelling | Keep gloss semantic ("a red fruit"), never the word letters |
| Peek still too hard | Skip button; L1 = 1 word |
| Source ≠ live | `deploy_live` after UI changes |

---

## 5. Test design

### Unit

- `specForDifficulty` / `pickRound`: new counts + `peekMs` + hintMode
- `wordGloss`: every bank word has non-empty gloss that does not equal the word
- Existing normalize / validate / spellingHint

### Manual

- Start → peek one word → spell with Hear + gloss → next word (no list quiz)
- Hub desc mentions hear / spell, not "memorize a list"
- Mobile 375px: large input + Hear button usable

```bash
npm test -- src/lib/entertain/word-echo.test.ts
```
