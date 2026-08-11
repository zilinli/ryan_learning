# Spark v4 deep-analysis report — feasibility (2026-08-11)

> Source: uploaded `Spark_AI_Tutor_v4_深度分析报告.md` (attachment truncated before §改善建议)  
> Related: [report-v3-feasibility.md](report-v3-feasibility.md) · [audit-2026-08-product-acceptance.md](audit-2026-08-product-acceptance.md) · [ux-competitor-report-2026-08-feasibility.md](ux-competitor-report-2026-08-feasibility.md) · [parent-gate.md](parent-gate.md)

## Problem

The v4 audit documents a large jump (Studio / Family / Dashboard / UX-RPT / pedagogy loop / public harden) and notes that **all five v3 priority recommendations landed in ~24h**. The uploaded file cut off mid feature-matrix, so explicit “next” bullets were incomplete. Remaining product gaps that still match north-star + prior deferrals:

1. **Studio → Learning Memory** exists (`studio-learning.ts`) but TED soft-feedback rarely moves BKT beyond generic `practice` (no explicit `TurnOutcome`).
2. **AUD.6b Learning Portfolio** still deferred — parents have JSON export + `/family` charts, not a printable year/period narrative.
3. Heavy items (multi-model, token admin UI, peer battle, emotion ASR, Ello dual-agent, `/mistakes`) stay reject/defer.

## Approach

Ship a **small closed-loop + portfolio** slice (RPT4). Reuse `FamilyReport` / digests; no new nav apps; no PDF npm dep (print HTML).

### Feasibility matrix (v4 themes → Spark)

| Theme in v4 report | Decision | Notes |
|--------------------|----------|-------|
| Studio TED / Lyric / Writing | **Shipped** · harden bridge | Outcome-aware BKT updates |
| Family PIN + radar + tips | **Shipped** | Keep narrative hub |
| Dashboard BKT/SM-2/Elo | **Shipped** | — |
| UX-RPT.1–10 | **Shipped** | Manual UX-RPT.6/11 remain |
| Pedagogy loop closedLoopActive | **Shipped** | — |
| Studio→Learning “same memory as chat” | **Partial → Accept harden** | Explicit outcome from soft feedback |
| Learning Portfolio (audit §6.2 / AUD.6b) | **Accept (print HTML)** | Cover + narrative + subjects + samples-from-skills; no cloud PDF |
| Usage / token admin | **Defer** | Effort = Σ skill attempts KPI only |
| Multi-model fallback | **Defer** | Cursor SDK spine |
| Peer battle / streaks / mascot | **Reject** | North-star |
| `/mistakes` app | **Reject** | Chat + `/family` patterns |
| Nginx Basic Auth / Tailscale | **Ops defer** | Outside app code |

## Implementation slice (RPT4)

| ID | Work |
|----|------|
| **RPT4.1** | `recordLearningTurnMemory({ outcome? })` + `studioOutcomeFromSoftFeedback` + TED Lab passes outcome |
| **RPT4.2** | `learning-portfolio.ts` printable HTML from `FamilyReport`; Family Tools → Print / save portfolio |
| **RPT4.3** | Family KPI **Effort** = total skill attempts (light usage signal; not token meters) |
| **RPT4.4** | Unit tests + DESIGN / TODO pointers |

### Non-goals

PDF library, attendance calendars, WeChat parent network, dual-agent latency, child ASR fine-tune, usage admin page.

## Key files

| Area | Files |
|------|--------|
| Studio bridge | `src/lib/entertain/studio-learning.ts`, `TedLab.tsx`, `learning-memory.ts` |
| Portfolio | `src/lib/learning-portfolio.ts`, `FamilyControlsPage.tsx` |
| Report model | `src/lib/family-report.ts` |
| Docs | this file, `TODO.md`, `DESIGN.md` |

## Risks

| Risk | Mitigation |
|------|------------|
| Soft feedback → false “correct” | Map only clear solid/short phrases; default `practice` |
| Print HTML looks sparse | Reuse narrative + radar % + top patterns already in FamilyReport |
| Child opens portfolio | Keep behind parent PIN on `/family` |

## Test design

### Unit
- `studioOutcomeFromSoftFeedback`: short → incorrect; solid → correct; nudge → practice
- `recordLearningTurnMemory` with `outcome: "correct"` bumps `correct` / pKnown even when assistant text is neutral
- `buildLearningPortfolioHtml`: includes account label, narrative, at least one subject or empty-state line; no secrets

### Integration / manual
- TED Lab: Check thinking on a short answer → Dashboard skill attempts move with struggle signal
- `/family` PIN unlock → Print portfolio → browser print dialog; JSON export still works

### Manual ops
- None beyond deploy_live after src changes

## Release status (2026-08-11)

| ID | Status |
|----|--------|
| RPT4.1–RPT4.4 | Shipped on `develop` (`03c8071`) |
| RPT4.5 | `publish_develop` + `deploy_live` (this session) |
| RPT4.6 | Manual parent/TED acceptance — still open |

---

*Selective landing from v4 audit themes + AUD.6b — not a mandate to implement the full external wishlist.*
