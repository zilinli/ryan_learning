# Parent gate — usability + child protection

Industry references: YouTube Kids adult gate, Google Building for Kids, Apple Screen Time / Family Link, Khan Academy Parent Dashboard.

## Surfaces

| Surface | Audience | URL |
|---------|----------|-----|
| **Family controls** | Parents (PIN-gated) | `/family` — narrative summary, KPIs, radar, trend, mistake coaching, check mode |
| **Learning dashboard** | Student | `/dashboard` — progress + practice CTAs (no parent digests) |
| Tutor sidebar | Both | Link **Family controls** |

## Product rules

| Principle | Spark behavior |
|-----------|----------------|
| Don’t bury parent tools | Sidebar → `/family` |
| Adult-only gate | 4-digit PIN; auto-advance; tab session unlock |
| Kids can’t one-tap reset | Adult math/year challenge before PIN reset |
| Actionable mistakes | Severity + “try at home” tips on `/family` |
| Hand device back | Lock clears session + check mode |

## Files

- `src/lib/family-report.ts` — parent report model
- `src/components/FamilyControlsPage.tsx`
- `src/lib/parent-pin.ts` / `src/lib/adult-gate.ts`
- `src/components/PinGate.tsx`
