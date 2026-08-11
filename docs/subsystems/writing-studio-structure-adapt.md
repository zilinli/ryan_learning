# Writing Studio · Structure adapt (not copy)

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **active** · 2026-08-11  
> Related: [writing-studio-pad-p0.md](writing-studio-pad-p0.md) · [entertainments.md](entertainments.md)

---

## Problem

Turning Writing Pad drafts into **music / image / video** often pasted the student’s sentences into `[Verse]`/`[Chorus]` or visual prompts. Songs and media models need **adapted language** (singable lyrics, cinematic scene prose), grounded in the student’s ideas — not a verbatim dump.

## Approach

### Music
- Extract theme, emotion, concrete images from the draft.
- **Generate** short singable lines (rhythm, refrain, imagery) that express those ideas.
- Keep student language when already lyrical; otherwise rewrite into lyric diction.
- Match draft language (EN/ZH/etc.). Use `[Verse]` / `[Chorus]` / optional `[Bridge]`.
- Caption = genre/mood for the music model — not a prose paste.

### Image / video
- Translate ideas into **visual / cinematic** prompts (subject, setting, light, camera).
- Never emit lyric section tags; never paste essay paragraphs unchanged.

### Local fallback (`structureDraftLocal`)
When the agent is unavailable, still **adapt** (theme → lyric lines / scene beats), not split-and-glue raw lines.

### Agent prompts (`structureAgentPrompt`)
Replace “Never ghostwrite — reshape THEIR words” with: **creatively adapt**; forbid verbatim paragraph paste; preserve meaning and voice.

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/studio-structure.ts` | Adaptive local structure |
| `src/app/api/writing-studio/coach/route.ts` | `structureAgentPrompt` |
| `src/lib/entertain/studio-structure.test.ts` | Unit: adapted ≠ raw copy |

## Risks

| Risk | Mitigation |
|------|------------|
| Over-ghostwriting loses student voice | Prompt: keep key nouns/images; adapt form |
| Local fallback too generic | Seed lines from draft keywords + emotion |
| Tests expecting verbatim lines | Assert structure tags + non-identity with draft |

## Test design

### Unit
- SA1 — music local has `[Verse]`/`[Chorus]` and is not equal to raw draft join
- SA2 — image/video never lyric-tagged; prompt longer than a single draft line paste
- SA3 — coach route tests still accept structured JSON shape

### Manual
- Structure essay → lyrics read as a song, not the essay with tags
- Structure → image/video prompts describe a scene, not the essay text
