# Claude deep-analysis report — feasibility (2026-08-11)

> Source: uploaded `Spark_AI_Tutor_深度调研分析报告.md`  
> Related: [audit-2026-08-product-acceptance.md](audit-2026-08-product-acceptance.md) · [report-v3-feasibility.md](report-v3-feasibility.md) · [parent-gate.md](parent-gate.md) · [security-sanitization.md](security-sanitization.md)

## Problem

External audit highlights: public duckdns deploy + no login, missing crawl blockers, sparse `/api/*` rate limits, parent/teacher visibility gap, and lack of Socratic anti-bypass regression. Much of the parent/export surface already shipped (R1/R6, `/family`, AUD.4 export, `/privacy`).

## Approach

Ship a **small public-hardening + integrity** slice. Reuse existing parent/BKT/SM-2 surfaces; do not rebuild 错题本, full auth, or Agent→PR in this pass.

### Feasibility matrix

| Report # | Recommendation | Decision | Notes |
|----------|----------------|----------|-------|
| §5.3.1 | Nginx Basic Auth / VPN | **Ops defer** | Document in security notes; not app code this slice |
| §5.3.2 | `/api/*` rate limit | **Accept** | Shared in-process limiter on costly routes |
| §5.3.3 | PIN for viewing data | **Partial shipped** | `/family` + export already PIN; device unlock page deferred |
| §5.3.4 | `robots.txt` + noindex | **Accept** | `app/robots.ts` Disallow all + metadata robots |
| §5.3.5 | Code Agent → PR not push | **Defer** | Large product change; keep PIN + harness |
| §5.3.6 | Tailscale-only | **Ops defer** | Host decision |
| §9.1.1–4 | Parent dash / digest / export / teacher | **Mostly shipped** · teacher **defer** | `/family`, digests, JSON export done |
| §9.2.5 | Socratic integrity verify | **Accept (static)** | Prompt-ladder unit tests; no live LLM red-team yet |
| §9.2.6 | 错题本 / spaced queue | **Reject product** · SM-2 **shipped** | BKT + SM-2 in learning-memory; no `/mistakes` |
| §9.2.7 | Multi-subject prompt templates | **Partial shipped** | `subjectCoachingLines` already splits math/reading/science/writing |
| §9.2.8 | Pronunciation scoring | **Defer** | Needs dialect ASR quality first |
| Meta leak | GitHub URL in `description` | **Accept fix** | Remove from public metadata |

## Implementation slice (RPT2)

| ID | Work |
|----|------|
| **RPT2.1** | `src/app/robots.ts` Disallow `/`; layout `robots: { index:false, follow:false }`; scrub GitHub from meta description |
| **RPT2.2** | `src/lib/api-rate-limit.ts` + wire chat / console / faq-ai / entertain-ai / models / tts / transcribe / dict-translate |
| **RPT2.3** | Unit: rate-limit windows; `buildTutorPrompt` keeps anti-spoiler + ladder under jailbreak-ish user text (checkMode off) |
| **RPT2.4** | Update security-sanitization + DESIGN pointer |

### Non-goals

Full login, Nginx auth in-repo, Agent PR workflow, teacher classroom page, live `verify:socratic-integrity` against Cursor API.

## Key files

| Area | Files |
|------|--------|
| Crawl / meta | `src/app/robots.ts`, `src/app/layout.tsx` |
| Rate limit | `src/lib/api-rate-limit.ts`, API routes listed above |
| Integrity | `src/lib/prompts.ts`, `src/lib/socratic-integrity.test.ts` |
| Docs | this file, `security-sanitization.md`, `TODO.md` |

## Risks

| Risk | Mitigation |
|------|------------|
| Shared Map resets on multi-instance | Single Node `npm start` today; document if scaled |
| Family false 429 | Generous buckets (chat 30/min, TTS 60/min); localhost-friendly IP extraction |
| Prompt tests ≠ model obedience | Static contract only; live red-team stays backlog |

## Test design

### Unit
- `api-rate-limit`: under limit → allow; over limit → block; window expiry clears.
- `socratic-integrity`: prompt with spoiler-bait user text still contains Hint ladder + Anti-spoiler; `checkMode:true` suspends ladder.

### Integration / manual
- `curl /robots.txt` → Disallow `/`.
- View-source / metadata: no GitHub URL; robots noindex.
- Burst POST `/api/models` or `/api/chat` → 429 after bucket.

### Manual ops (deferred)
- Consider Nginx Basic Auth or Tailscale for duckdns host.
