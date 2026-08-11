# Third-party product audit — acceptance matrix (2026-08)

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Source: uploaded analysis `Spark AI Tutor — 产品深度分析与改善建议` (2026-08-10)  
> Filter: [competitive-product-plan-v2.md](competitive-product-plan-v2.md) north-star + private ≤6-account deploy  
> Related: [report-v3-feasibility.md](report-v3-feasibility.md) (prior audit already shipped R1–R9)

---

## Problem

An external audit recommends closing the “teaching loop” (mistake book, parent dashboard, reminders), packaging dialects, and hardening ops (backup, export, multi-model, usage caps). Spark already shipped much of the pedagogy/parent surface via Report-v3 and CA-P0/P1; several audit asks **conflict** with confirmed non-goals (error-book app, exposed knowledge map, streaks).

## Approach

Accept the **intent** (remember → track → show progress) when it maps to existing BKT / gaps / digests / dashboard. Reject product shapes that turn chat-first tutoring into a course or 错题本 app. Ops items that protect a home deploy (export, privacy note, backup) are accepted at small scope.

### North-star filter (unchanged)

1. Socratic first  
2. Zero child dashboard / chat-first (parent PIN views OK)  
3. Physical-tutor metaphor  
4. No leaderboards / streaks; no exposed knowledge-map UI

---

## Acceptance matrix

| Audit # | Recommendation | Decision | Rationale / mapping |
|--------|----------------|----------|---------------------|
| §5.1 | 错题本 + 薄弱点 + 同类题 | **Reject as product** · **Accept spirit** | Separate `/mistakes` error-book = non-goal. Already: misconception hits, dashboard “Mistake patterns”, `knowledge-gaps` A3, A2 ZPD drills, BKT weaknesses. Deepen via **C2** + practice loop, not a new nav app. |
| §5.2 | `/parent` Dashboard | **Partial — already shipped** | `/dashboard` + PIN weekly digest (`parent-digest`) = R1/R6. Prefer **D2 one-liner** over new mega `/parent`. No email digests. |
| §5.3 | Active reminders + streak | **Reject streak** · **Defer soft nudge** | Streaks are explicit anti-pattern (v2). Optional once/day in-app opener already (B1); push/cron reminders → P3 if parents ask. |
| §5.4 | Dialect productization | **Accept (light)** | Tech is strong; packaging weak. Ship metadata/empty-state copy + FAQ; no 30s marketing video / blog required for private deploy. Jyutping stays in **dict**, not forced tutoring overlay. |
| §5.5 | Code Agent for parents | **Defer** | Keep PIN. Optional NL templates later; do not lower friction or move Agent into child chrome. |
| §5.6 | `/writing` closed loop | **Defer** | Use `narrative-writing` skill + Socratic prompts; no new primary nav page unless demand. |
| §5.7 | Backup + `/api/export` | **Accept** | Client PIN export of learning (+ optional history summary); host `scripts/backup-data.sh` for `data/`. No cloud COS required for N≤6. |
| §5.8 | Multi-model fallback | **Defer** | Cursor SDK is the product spine; dual-provider = ops/cost complexity without clear home-ROI. |
| §5.9 | Usage / token admin | **Defer (backlog)** | Useful; not blocking. Log-based estimate later; no child-facing meters. |
| §5.10 | Content safety / retention | **Partial** | Sanitization + history retention budgets already exist. 90-day archive policy → document only unless pain. |
| §6.1 | School syllabus / exam mode | **Defer** | Aligns with “family OS” idea; needs BASIS calendar input — backlog idea, not build now. |
| §6.2 | Annual Learning Portfolio PDF | **Defer** | Nice; export JSON first enables it later. |
| §6.3 | Parent collaboration network | **Out of product** | WeChat/group ops, not code. |
| §6.4 | Privacy / disclaimer for other families | **Accept** | Static `/privacy` data-use + disclaimer page; link from Help. |
| §3 / strengths | Dialect, Socratic, multi-tenant, Agent, self-host | **Acknowledge** | Keep investing in dialect quality (Phase G/TEO) and CA teaching depth — not new moats. |

### Already covered (do not rebuild)

| Audit pain | Existing Spark surface |
|------------|------------------------|
| 学情太浅 | BKT + SM-2 + Elo + SkillsPanel + `/dashboard` radar/trend |
| 家长看不到进步 | PIN weekly digest + daily one-liner builders |
| 薄弱点 | `skillWeaknesses`, gap history, practice offers |
| 隐私自托管 | Local STT + JSON under `data/` + account isolation |
| 方言 | yue default + teo/hak/sha paths |

---

## Implementation slice (this acceptance)

| ID | Work | Priority |
|----|------|----------|
| **AUD.1** | This matrix + TODO section + DESIGN pointer | P0 docs |
| **AUD.2** | Metadata + Help/FAQ dialect visibility | P0 copy |
| **AUD.3** | `/privacy` static page (EN, short) | P0 |
| **AUD.4** | PIN-gated account learning export (JSON download on `/dashboard`) | P0 |
| **AUD.5** | `scripts/backup-data.sh` (local tar of `data/`, exclude secrets) | P1 ops |
| **AUD.6** | Soft in-app reminder / portfolio PDF / usage admin / multi-model | Backlog only |

---

## Key files

| Area | Files |
|------|--------|
| Design | this doc, `competitive-product-plan-v2.md`, `report-v3-feasibility.md` |
| Parent / mastery | `src/lib/parent-digest.ts`, `src/lib/dashboard-stats.ts`, `src/components/LearningDashboard.tsx` |
| Gaps / misconceptions | `src/lib/knowledge-gaps.ts`, `src/lib/misconceptions.ts` |
| Export | `src/lib/account-export.ts` (new), dashboard UI |
| Privacy | `src/app/privacy/page.tsx` (new) |
| Backup | `scripts/backup-data.sh` (new) |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Rebuilding 错题本 under a new name | Stick to misconception + BKT; refuse `/mistakes` route |
| Child UI clutter from “parent value” charts | Keep charts on `/dashboard`; chat stays empty-first |
| Export leaking other tenants | Scope strictly to active `accountId`; PIN for parent download |
| Backup including `.env` / keys | Script allowlists `data/` JSON + media only |

---

## Test design

### Unit

- `account-export.ts`: stable JSON shape; strips unrelated accounts; includes skills + digest text snapshot; omits secrets.
- Existing `parent-digest` / `dashboard-stats` regressions stay green.

### Integration

- Manual: unlock PIN on `/dashboard` → Export → file opens with expected `accountId` and `skills[]`.
- Manual: `/privacy` loads on mobile width; link from Help if present.

### Manual / ops

- Run `scripts/backup-data.sh` once on host; confirm tarball size and no `.env` inside.

---

*Analysis + selective landing — not a mandate to implement the full external roadmap.*
