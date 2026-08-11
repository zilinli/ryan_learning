# Product audit 2026-08 — roadmap (constraints locked)

> Source: Spark AI Tutor 产品深度分析与改善建议 (2026-08)  
> Status: active · Constraints from product owner

## Constraints (do not violate)

| Keep | Rule |
|------|------|
| **All languages / dialects** | 粤语默认 + 英/普 + 西/法/马/闽南/客家/上海 — do **not** remove. Lazy-load is OK; feature flags for experimental dialects OK. |
| **Code Agent** | Keep full pipeline (Intake→Deploy), diff+PIN, multimodal. Child-friendly UX / safety whitelist only — never gut the agent. |

## Problem

Audit says Spark’s pedagogy/BKT/multi-tenant are strong, but: (1) Socratic ladder is prompt-only and fragile under “I don’t know” loops; (2) home chrome shows developer metrics; (3) BKT lacks an explicit daily review queue UI; (4) full-page photos waste tokens; (5) parent trust needs one-glance observability.

## Already in repo (do not duplicate)

| Audit ask | Existing |
|-----------|----------|
| Parent panel | `/family` + `family-report.ts` + `parent-digest.ts` + PIN |
| Spaced decay | SM-2 in `bkt.ts` / `learning-memory.ts` + `needsReviewSkills` |
| Pedagogy loop | `pedagogy-loop.ts` (weak BKT → misconception → multi-rep) |
| Socratic integrity tests | `socratic-integrity.test.ts` (prompt contract) |
| Student dashboard | `/dashboard` |

## Approach (release slices)

### Slice A — Coach State Machine (P0)

- New pure module `src/lib/coach-state.ts`: track `round`, `frustration` (0–3), `consecutiveIDontKnow`, `strategy`, optional `bktMastery`.
- Derive from chat history + latest student text (no LLM structured output required for v1).
- Inject hard constraints into `buildTutorPrompt` so high frustration **cannot** unlock full answers until after scaffold / partial first-step rules.
- UI (light): optional frustration cue in chat chrome later; v1 is prompt-enforced.

### Slice B — Parent observability (P0 enhance)

- Add `/parent` → `/family` alias (audit URL).
- Keep digests; optional TTS “今日小结” on Family page (reuse Edge/Bailian TTS + `buildParentDailyDigest`).
- Do **not** replace `/family` with a second dashboard.

### Slice C — Review queue (P1)

- `review-queue.ts`: FSRS-**inspired** retrievability `R = exp(ln(0.9) * t / S)` mapped from SM-2 interval/stability + BKT `pKnown` → Difficulty.
- Daily cap 5; prefer `R < 0.85`; one skill per day min spacing.
- Wire into session opener / practice hooks (reuse `needsReviewSkills` + new ranking).
- Full `ts-fsrs` npm swap deferred (avoid storage migration in this slice).

### Slice D — Photo crop (P1)

- `cropImageDataUrl` in `image-process.ts` + `PhotoCropModal` after camera/gallery before attach.
- “Use full page” escape hatch remains.

### Slice E — Student-facing copy (P1)

- Rewrite `engagementSummary` + `learningMemorySummary` to kid language (streak / stars / “需要加油：…”).
- Keep English UI chrome principle where applicable; Chinese short labels OK for G4 bilingual home.

### Slice F — Code Agent child-friendly (P1, keep agent)

- Safe-intent suggestions + PIN for destructive paths only.
- No removal of console / auto-git.
- **Shipped 2026-08-11:** `console-safe-intent.ts` + `CodeAgentPanel` PIN gate — [ca-child-safe-and-voice-lazy.md](ca-child-safe-and-voice-lazy.md)

### Slice G — Languages lazy-load (P2)

- Preload yue/en/zh; load es/fr/ms/dialects on first use. **Zero language deletions.**
- **Shipped 2026-08-11 (menu groups):** Core vs More in `VoiceControls` — same doc. Network TTS lazy remains on-demand per `/api/tts`.

### Slice H — Ops (P2, optional)

- Docker Compose / backup — only if systemd pain returns; not blocking teaching work.

## Key files

| Area | Files |
|------|-------|
| Coach SM | `src/lib/coach-state.ts`, `prompts.ts`, chat history |
| Parent | `src/app/parent/page.tsx`, `FamilyControlsPage.tsx`, `parent-digest.ts` |
| Review | `src/lib/review-queue.ts`, `session-opener.ts`, `session-practice.ts` |
| Crop | `image-process.ts`, `PhotoCropModal.tsx`, `Composer.tsx` / `CameraCapture.tsx` |
| Copy | `engagement.ts`, `learning-memory.ts` |
| Code Agent | `CodeAgentPanel.tsx`, `console-harness.ts` (guardrails only) |

## Risks

| Risk | Mitigation |
|------|------------|
| Coach SM over-constrains recall facts | Keep recall / medium-computation / checkMode exemptions |
| FSRS vs SM-2 dual truth | Rank with R; persist still SM-2 until migration |
| Crop friction on mobile | One-tap “整页” + default full-frame selection |
| Edit budget 25/session | Ship Slice A+B+C+E first; D/F next session |

## Test design

### Unit

- `coach-state.test.ts` — IDK streaks raise frustration; strategies escalate; checkMode bypass; mastery modulates.
- `review-queue.test.ts` — R formula, daily cap, no same-skill same-day duplicate.
- `engagement.test.ts` / `student-profile.test.ts` — new kid-facing summary strings.
- `image-process` crop bounds + “full page” noop.
- Existing `socratic-integrity` still green; add coach-block asserts.

### Integration

- `buildTutorPrompt` with fabricated history of 3× “我不知道” → must contain scaffold / forbid full reveal.
- `/parent` returns redirect to `/family`.

### Manual

- PIN → Family digest + Listen 小结 (if TTS wired).
- Camera → crop → send smaller image; “整页” still works.
- Code Agent still opens; languages picker still lists all 9.

## Out of scope this doc

- Removing any TTS/STT language.
- Replacing Code Agent with a toy settings panel only.
