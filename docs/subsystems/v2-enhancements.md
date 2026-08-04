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

> **Layout revision (Aug 2026):** The first ship put a full dashboard **above** chat history, which crowded the sidebar and hid conversations. Spec now follows [ui-architecture.md](ui-architecture.md) §5.4–5.5: **chat-first**, dashboard as a **collapsed strip below** the list.

### 2.1 Current State (pre-fix)

`SkillsPanel.tsx` expands fully at the **top** of `HistorySidebar`:
- Header + ZPD card + topic pills + Stronger/Focus lists + PIN footer
- Occupies ~60% of sidebar height → only ~1 chat visible

### 2.2 Target UX

**Sidebar order:** Header → New chat → Search → **Chat list (flex-1)** → SkillsPanel strip → Footer

```
Collapsed (default, ~36px):
┌────────────────────────────────────┐
│ ▸ Learning · Try: fractions · 3 focus │
└────────────────────────────────────┘

Expanded (tap, max ~40% sidebar height, internal scroll):
┌────────────────────────────────────┐
│ ▾ Learning · BKT + SM-2            │
│                                    │
│ Today's challenge                  │
│   Try: Equivalent Fractions        │
│                                    │
│ Stronger (≤2)                      │
│   ▸ Fractions 92%                  │
│ Focus (≤2)                         │
│   ▸ Place value 45%                │
│                                    │
│ Parent PIN status                  │
└────────────────────────────────────┘
```

**What we cut from the expanded view (vs. first ship):**
- Topic overview pills
- Review-needed block (data still available via `needsReviewSkills` for agent prompts)
- Stronger/Focus capped at 2 each (was 3)
- Emoji section headers → plain text labels

### 2.3 Implementation

**`HistorySidebar.tsx`:**
- Move `<SkillsPanel />` from above New chat to **below** the conversation list, above Code Agent footer
- Ensure chat list keeps `flex-1 min-h-0 overflow-y-auto`

**`SkillsPanel.tsx`:**
- Collapsible: default closed; toggle on header row click
- Collapsed row: chevron + "Learning" + truncated ZPD label + focus count
- Expanded: ZPD challenge + Stronger≤2 + Focus≤2 + PIN status; `max-h-[40vh]` + `overflow-y-auto`
- Persist open state in `sessionStorage` (`spark.skillsPanelOpen`); default closed on new session

**`learning-memory.ts`:** (already done)
- `zpdWarmUpSkills`, `needsReviewSkills` — keep exports; review list not shown in UI by default

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
| `src/components/HistorySidebar.tsx` | Chat-first order: SkillsPanel below conversation list | Low — reorder only |
| `src/components/SkillsPanel.tsx` | Collapsible strip (default closed); trim expanded density | Low — UI only |
| `src/lib/prompts.ts` | Cross-discipline lines, confidence mismatch injection | Low — prompt-only, no logic changes |
| `src/lib/learning-memory.ts` | `detectConfidenceMismatch()`, `needsReviewSkills()` | Low — new exports only |
| `docs/subsystems/ui-architecture.md` | §5.4–5.5 chat-first + collapsible SkillsPanel | None |
| `docs/DESIGN.md` | Add `v2-enhancements.md` to document map | None |

---

## 7. Test Plan

- `npm test` — existing BKT/SM-2 tests must still pass
- TypeScript check — no new type errors
- Manual: open sidebar → chat list fills most of the height; SkillsPanel is a one-line strip at bottom
- Manual: tap SkillsPanel → expands ≤40% height; history remains scrollable
- Manual: reload → SkillsPanel starts collapsed again (sessionStorage cleared on new tab)
- Manual: verify ZPD recommendation appears after a few chat turns when expanded
- Manual: send a chat → verify no regression in tutor behavior
- Manual: check prompts.ts output → cross-discipline lines should appear
- Manual: open CodeAgentPanel → verify PIN gate still works
