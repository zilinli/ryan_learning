# V2 Enhancements — v2 分析报告落地设计

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **implementing** · August 2026  
> Source: [Spark_AI_Tutor_v2_分析报告.md](../../../Spark_AI_Tutor_v2_分析报告.md) §六

---

## 1. Scope

Implement the 4 actionable recommendations from the v2 analysis report:

| ID | Priority | Item | Files |
|----|----------|------|-------|
| 6.1 | 🔴 High | Learning Dashboard: ZPD recommendations + topic summary | `SkillsPanel.tsx`, `learning-memory.ts` |
| 6.3 | 🟡 Medium | Cross-discipline coaching lines in prompts | `prompts.ts` |
| 6.4 | 🟡 Medium | BKT+confidence mismatch feedback loop | `learning-memory.ts`, `prompts.ts` |
| 6.2 | 🟡 Medium | Parent PIN visibility in sidebar | `HistorySidebar.tsx`, `SkillsPanel.tsx` |

Items 6.5 (G5 hint) and 6.6 (dynamic geometry) are deferred as lower priority.

---

## 2. Design: 6.1 Learning Dashboard

### 2.1 Current State

`SkillsPanel.tsx` shows:
- "Ryan · skill map" header
- Weakest skill badge (🔍 Focus)
- Stronger list (up to 3)
- Focus/weak list (up to 3)
- All from BKT/SM-2 data

**Missing:** ZPD recommendations, topic grouping, "today's challenge", review alerts.

### 2.2 Target UX

```
┌──────────────────────────────────┐
│ Ryan · learning dashboard         │
│ BKT + SM-2 · updates each chat   │
│                                  │
│ 📊 You're getting stronger at…  │
│   ▸ Fractions 🟢 92% (peer!)    │
│   ▸ Multiplication 🟢 88%       │
│                                  │
│ 📝 Keep practicing               │
│   ▸ Decimals 🟡 68%             │
│   ▸ Division 🟡 61%             │
│                                  │
│ 🎯 Today's challenge             │
│   Try: Equivalent Fractions      │
│   (you're in the zone — ZPD!)   │
│                                  │
│ 🔔 Review needed                 │
│   ▸ Geometry angles (12d)       │
│   ▸ Place value (8d)            │
└──────────────────────────────────┘
```

### 2.3 Implementation

**`SkillsPanel.tsx` changes:**
- Rename header to "Ryan · learning dashboard"
- Add ZPD recommendation section using `zpdWarmUpSkills(mem, 3)`
- Add SM-2 review alerts: skills with high mastery but decayed below threshold
- Add `zpdSkill` as the single best ZPD recommendation
- Group skills by topic using `skill-catalog.ts` topic labels
- Use colored bars instead of just percentages for visual clarity

**`learning-memory.ts` additions:**
- Export `zpdWarmUpSkills` (already exists) — ensure it works well
- Add `needsReviewSkills(mem, limit)` helper: finds skills where SM-2 decay has dropped pKnown significantly

---

## 3. Design: 6.3 Cross-Discipline Connections

### 3.1 Current State

`prompts.ts` has `subjectCoachingLines()` with 4 independent blocks (Math, Reading, Science, Writing). The MIXED/UNKNOWN block just says "ask which subject then switch."

### 3.2 Target

Add natural cross-discipline hints inside `subjectCoachingLines()`:

```
► CROSS-DISCIPLINE:
- When a topic bridges subjects, connect naturally:
  • Ancient Egypt → fractions of a pyramid (math + humanities)
  • Reading science texts → evidence skills apply across subjects
  • Writing about ecosystems → combine science facts + narrative structure
  • Word problems about animals → reading comprehension meets math
- If the student shows interest in a cross-subject link, lean into it.
```

### 3.3 Implementation

**`src/lib/prompts.ts`:**
- Add `crossDisciplineLines()` function returning the hint block above
- Insert it between subject-specific blocks and MIXED/UNKNOWN

---

## 4. Design: 6.4 BKT + Confidence Feedback Loop

### 4.1 Current State

- BKT tracks `pKnown` (AI-side estimate of mastery)
- Self-assessment extracts `confidence` (1-3 from student)
- Both are stored in `SkillMastery` but never compared

### 4.2 Target

Detect mismatch between BKT and student confidence, inject coaching hint into next prompt.

### 4.3 Implementation

**`src/lib/learning-memory.ts`:**
- Add `detectConfidenceMismatch(mem): MismatchInfo | null`
  - `BKT high (pKnown > 0.75) + confidence low (≤1)` → "underconfident" — encourage
  - `BKT low (pKnown < 0.40) + confidence high (≥3)` → "overconfident" — gentle nudge
  - Returns `null` if no significant mismatch or no confidence data

**`src/lib/prompts.ts`:**
- Inside `buildTutorPrompt()`, call `detectConfidenceMismatch(learningMemory)`
- If mismatch found, inject a brief coaching line:
  - Underconfident: "Ryan recently rated confidence=1 on a skill he knows at ~85%. Encourage him — he knows more than he thinks."
  - Overconfident: "Ryan rated confidence=3 on a skill tracked at ~35%. If this topic comes up, gently check his reasoning without dampening his enthusiasm."

---

## 5. Design: 6.2 Parent PIN Visibility

### 5.1 Current State

`PinGate.tsx` is fully functional (4-digit PIN with hash, 3-try lockout, shake animation). However, it's only accessible from within `CodeAgentPanel.tsx` when the user clicks "Apply" on a diff.

Many parents may not discover this feature. The report recommends making parents aware it exists.

### 5.2 Target

Add a small "Parent PIN" indicator at the bottom of `SkillsPanel` (sidebar area):
- If PIN is set: "🔒 Parent PIN active" (clickable to change)
- If PIN is NOT set: "🔓 Set parent PIN" (clickable to set)
- Clicking opens a mini `PinGate` modal from the sidebar

### 5.3 Implementation

**`SkillsPanel.tsx`:**
- Import `hasParentPin` from `PinGate.tsx`
- Add a compact footer section showing PIN status
- Click opens a minimal `PinGate` (reuse existing component, just smaller)

**Note:** `PinGate` is fully implemented and robust. This change just adds discovery.

---

## 6. File Change Summary

| File | Change | Risk |
|------|--------|------|
| `src/components/SkillsPanel.tsx` | ZPD section, review alerts, topic grouping, PIN indicator | Low — additive changes |
| `src/lib/prompts.ts` | Cross-discipline lines, confidence mismatch injection | Low — prompt-only, no logic changes |
| `src/lib/learning-memory.ts` | `detectConfidenceMismatch()`, `needsReviewSkills()` | Low — new exports only |
| `docs/DESIGN.md` | Add `v2-enhancements.md` to document map | None |

---

## 7. Test Plan

- `npm test` — existing BKT/SM-2 tests must still pass
- TypeScript check — no new type errors
- Manual: open sidebar → verify ZPD recommendation appears after a few chat turns
- Manual: send a chat → verify no regression in tutor behavior
- Manual: check prompts.ts output → cross-discipline lines should appear
- Manual: open CodeAgentPanel → verify PIN gate still works
