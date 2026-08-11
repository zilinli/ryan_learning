# TED Challenge · Hybrid MCQ + Essay → Tutor Q&A

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **active** · 2026-08-11 (v3 — optional MCQ + required essay → **inline** Lab discuss)  
> Related: [ted-challenge-inline-discuss.md](ted-challenge-inline-discuss.md) · [entertainments.md](entertainments.md) §6.2 · [ted-challenge-adaptive-difficulty.md](ted-challenge-adaptive-difficulty.md)

---

## Problem

TED Challenge must train **selection + reasoning together**, then deepen thinking in the **main tutor chat** — not trap students behind two independent soft-checks before “Next”.

Product rules (parent clarified 2026-08-11):

1. **MCQ + 论述 on one prompt** — student argues from their choice(s).
2. **Selection optional** — if the viewpoint is not in A–D, skip selection and explain in the essay.
3. **Multi-select OK** — when several options fit, select them and spell out the logic in the essay.
4. **After Submit** → stay on TED Lab; open an **inline discuss panel below** the frozen prompt/options/essay (do **not** jump to homepage).
5. Student may **continue chatting** or take the **next TED question** in Lab.
6. When the student’s logic is **self-consistent**, surface a **completion signal** suggesting the next question.

See [ted-challenge-inline-discuss.md](ted-challenge-inline-discuss.md). Homepage TutorShell kickoff is **legacy** only.

## Approach

### Data model (unchanged fields)

```ts
type ChallengeItem = {
  id: string;
  kind: ChallengeKind;
  prompt: string;
  rubricHint: string;
  choices: string[];          // target 4
  choiceMode: ChoiceMode;     // soft-score preference (UI allows multi always)
  correctChoices: number[];   // soft check only — never a hard gate
};
```

### Challenge UI (TedLab)

```mermaid
flowchart TD
  Prompt[Prompt + Listen] --> MCQ[Optional A–D multi-select]
  Prompt --> Essay[Required essay / speak]
  MCQ --> None[None of these — explain in essay]
  None --> Essay
  Essay --> Submit[Submit & discuss]
  Submit --> Freeze[Keep prompt + choices + essay visible]
  Freeze --> Panel[Inline TedDiscussDialogue]
  Panel --> Stay[Keep chatting]
  Panel --> Next[Next TED question in Lab]
  Panel --> DoneSignal[Coherence signal → suggest Next]
```

1. Options always **multi-capable**; copy: “Select any that apply (optional)”.
2. **None of these** clears selection — student must still write the essay.
3. Selection taps update **`selected[]` only** — never wipe the essay.
4. **Submit & discuss** requires essay ≥3 chars; selection **not** required.
5. Soft local feedback is optional/brief; **primary feedback is tutor dialogue**.
6. On submit: record learning turn → open inline discuss (no homepage navigation).

### Inline discuss (primary)

Context payload (same fields as former kickoff) seeds `TedDiscussDialogue` + `POST /api/ted/discuss`.

- Guide thinking; no spoilers / no “correct is B”.
- When reasoning is **self-consistent**, say clearly that thinking holds together and suggest the next TED question.
- “Next question” advances `qi` in Lab; discuss panel resets.

### Legacy handoff (sessionStorage)

Helpers remain for older TutorShell paths; Lab no longer redirects on submit.

| Key | Role |
|-----|------|
| `spark.tedChallengeKickoff.v1` | Legacy one-shot for TutorShell |
| `spark.tedChallengeResume.v1` | Optional resume if a banner still navigates back |

### Soft score adjustments

- `scoreChoiceSelection` empty remains a score label, but **empty + essay is valid submit**.
- `buildChoiceSoftFeedback` empty copy becomes advisory (“No option selected — your essay should carry your view.”), not a lock-out.

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/ted-challenge.ts` | Types, enrich, soft feedback, fallbacks |
| `src/lib/entertain/ted-challenge-handoff.ts` | Kickoff message + coherence; legacy stash/consume |
| `src/lib/entertain/ted-discuss.ts` | Inline discuss prompts + local fallback |
| `src/components/TedDiscussDialogue.tsx` | Inline Socratic chat under the item |
| `src/components/TedLab.tsx` | Optional MCQ + required essay + inline discuss |
| `src/app/api/ted/discuss/route.ts` | Discuss agent API |
| `src/components/TutorShell.tsx` | Legacy kickoff consume (if any) |
| `src/lib/entertain/ted-challenge-handoff.test.ts` | Unit TH1–TH6 |

## Risks

| Risk | Mitigation |
|------|------------|
| Auto-send races before store ready | One-shot ref; only after `ready && sessionId` |
| Losing challenge after navigate | Resume stash holds serialized challenge + qi |
| AI never emits coherence cue | Banner always offers Next; cue only strengthens copy |
| Spoiling answers in tutor | Kickoff forbids revealing correct letters |
| Essay skipped with empty selection | Submit disabled until essay ≥3 |

## Test design

### Unit

| ID | Case |
|----|------|
| TH1 | `canSubmitHybrid` — essay required; empty selection OK |
| TH2 | `buildTedChallengeKickoffMessage` includes prompt, choices/none, essay, Socratic + coherence instruction |
| TH3 | stash/consume kickoff is one-shot |
| TH4 | stash/consume resume round-trips talkSlug + qi + items |
| TH5 | `detectTedCoherenceSignal` true on cue phrases; false on generic praise |
| TH6 | `buildChoiceSoftFeedback` empty is advisory (no “pick before locking”) |
| TMH* | Existing hybrid enrich/score/format tests still pass |

### Integration / manual

| ID | Case |
|----|------|
| TM-H6 | Skip selection + essay → Submit stays on Lab; discuss panel opens below |
| TM-H7 | Multi-select + essay → discuss context lists letters; tutor responds Socratically |
| TM-H8 | “Next TED question” in panel advances Lab to `qi+1` |
| TM-H9 | When tutor signals coherence, panel CTA suggests Next |

```bash
npm test -- src/lib/entertain/ted-challenge.test.ts src/lib/entertain/ted-challenge-handoff.test.ts
```
