# Report-v3 Feasibility — Implementation Notes

> Source: `/root/Spark_AI_Tutor_v3_深度分析报告.md` · landed 2026-08-10

## Shipped (W1–W3)

| ID | Item | Implementation |
|----|------|----------------|
| R2 | Pedagogy closed loop | [`pedagogy-loop.ts`](../../src/lib/pedagogy-loop.ts) gates weak BKT → misconceptions → forced multi-rep into [`prompts.ts`](../../src/lib/prompts.ts) |
| R6 | Parent weekly digest | [`buildParentWeeklyDigest`](../../src/lib/parent-digest.ts) + PIN UI in [`SkillsPanel.tsx`](../../src/components/SkillsPanel.tsx) (in-app only) |
| R1 | Learning dashboard | [`/dashboard`](../../src/app/dashboard/page.tsx) + [`dashboard-stats.ts`](../../src/lib/dashboard-stats.ts) SVG radar/trend/heat |
| R3 | Step progressive | [`MarkdownMessage`](../../src/components/MarkdownMessage.tsx) sequential Next reveal; prompts reinforce `~~~step` |
| R7 | Science experiment | Expanded science flow in `thinkFirstRules` + optional `~~~experiment` fence |
| R4 | Voice auto-send | Default **off**; toggle in voice menu; dialects/yue always confirm |
| R8 | Spark moments | [`spark-moment.ts`](../../src/lib/spark-moment.ts) fence + badge in ChatThread |
| R9 | Adaptive practice | `pickPracticeTargets` prefers soft ZPD band (~0.35–0.72) |

## Deferred (backlog)

| ID | Item | Reason |
|----|------|--------|
| R5 | Peer battle / compare | Family multi-tenant isolation by design; ROI low for single-Ryan |
| R10 | Voice emotion detection | No reliable child-prosody API in Bailian/Whisper stack; use stuck-text signals instead |

Assumptions held: no email digests, no chart npm deps, no full-duplex voice.
