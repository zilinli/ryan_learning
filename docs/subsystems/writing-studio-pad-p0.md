# Writing Studio Pad P0 — Grammar + Feedback/Stage layout

> 2026-08-12 · Source: AI English writing competitive research + Writing Studio improvement brief

## Problem

Writing Studio already has the right pedagogy (BASIS dimensions, Socratic mentor, Stage song/image/video) but lacks competitor-grade **correction muscle** and a layout that prioritizes feedback while writing:

1. Grammar scoring is heuristic-only (sentence endings / opener variety) — not real ESL grammar.
2. Coach results sit under the pad (easy to miss); Stage occupies half the screen while drafting.
3. Genre selector is music-oriented (Indie / Ballad), confusing for essays.

## Approach (P0 only)

### 1. Grammar check pipeline

```
draft → debounce ~800ms → POST /api/writing-studio/grammar-check
         ├─ LanguageTool HTTP API if LANGUAGETOOL_API_URL set
         └─ local heuristic ESL checks (always available)
         → GrammarMatch[] → WritingPadHighlights underlines + apply replacement
```

- Env: `LANGUAGETOOL_API_URL` (e.g. `http://127.0.0.1:8010/v2/check`), optional `LANGUAGETOOL_API_KEY`.
- Do **not** default to the public `api.languagetool.org` (disallows automated traffic).
- `scoreGrammar()` accepts optional match count to nudge BASIS grammar score.

### 2. Layout: Feedback first, Stage preserved but collapsed

| Breakpoint | Layout |
|------------|--------|
| `< md` (phone) | Bottom tabs: **Write** / **Feedback** / **Stage** |
| `≥ md` | Left: Writing pad; Right: Feedback (top) + collapsible Stage (bottom bar → expand) |

- Stage song/image/video features stay complete — never removed.
- `Structure` / user tap opens Stage; preference remembered in `localStorage` (`spark.ws.stageExpanded`).
- Coach completion on mobile switches to Feedback tab and blurs the textarea (keyboard dismiss).

### 3. Writing type

- Selector: Narrative / Persuasive / Descriptive / Expository / Poetry / Lyrics / Free write.
- Mood/genre (Indie…) only when type is Lyrics or Poetry.
- Structure CTA label adapts (`Structure essay` / `Turn into lyrics` / …).
- Coach prompt receives `writingType` for rubric emphasis.

### 4. Small UX (same slice)

- Live word · sentence count under the pad.
- Desktop shows the same error line as mobile.
- Coach panel auto-opens weakest dimension tips on first report.

## Key files

| File | Role |
|------|------|
| `src/lib/entertain/languagetool.ts` | Match types, local heuristics, remote check |
| `src/app/api/writing-studio/grammar-check/route.ts` | Rate-limited grammar API |
| `src/lib/entertain/basis-writing.ts` | Writing types + grammar score from matches |
| `src/components/WritingPadHighlights.tsx` | Underlines for grammar + spots |
| `src/components/WritingStudio.tsx` | Tabs / Feedback+Stage / type selector |
| `src/components/WritingCoachPanel.tsx` | Auto-expand weak dims |

## Risks

| Risk | Mitigation |
|------|------------|
| Public LT rate limits / ToS | Opt-in URL only; local fallback always |
| Overlay highlights vs editable textarea | Grammar marks in overlay mode; click apply mutates draft |
| Layout regression on Stage generate | Stage panel unchanged internally; only chrome collapse |
| Edit budget / large WritingStudio | Prefer concentrated UI patch; keep Stage JSX intact |

## Test design

### Unit
- `languagetool.test.ts` — parse LT JSON; local heuristics catch `a apple`, repeated words; empty draft → [].
- `basis-writing.test.ts` — writing-type labels; grammar score drops when many matches.

### Integration
- `grammar-check` route returns `{ ok, matches, source }` with local source when env unset.

### Manual
- Phone: Write → Coach → lands on Feedback with score; Stage tab still generates song.
- Desktop: Stage starts collapsed; Structure expands it; Feedback stays visible.
- With `LANGUAGETOOL_API_URL`: underlines + one-click replace.

## Out of scope (P1+)

Outline mode, readability/Flesch, draft history, rewrite-on-select, prompt library, export, parent writing dashboard.
