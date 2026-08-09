# CA-P1 System Design — Scratch · Misconceptions · Multi-rep · Dynamic board

> **Subsystem document** — part of [Spark Design Docs](../DESIGN.md)  
> Status: **designed / implementation deferred** · August 2026  
> Depends on: [ca-p0-system-design.md](ca-p0-system-design.md)  
> Research: [competitive-feature-analysis.md](competitive-feature-analysis.md)

---

## 1. Scope

P1 deepens teaching quality after P0 loops exist.

| ID | Feature | Primary modules |
|----|---------|-----------------|
| **CA-5** | Scratch-work vision | prompts + optional `scratch-diagnosis.ts` schema |
| **CA-6** | Misconception JIT tags | `misconceptions.ts` seed + memory field |
| **CA-7** | Multi-representation switch | prompts + `LearningMemory.preferredReps` |
| **CA-8** | Dynamic board / step animation | geometry SVG versioning in chat |

---

## 2. CA-5 Scratch-work vision

**Flow:** Student photos notebook steps → multimodal message → agent returns structured diagnosis fence (not shown to child):

````
~~~scratch-diagnosis
{"badStep":2,"totalSteps":4,"hint":"Check place value when adding tenths"}
~~~
````

Client strips fence; prompt uses diagnosis to drive L2.5. Canvas editor later.

**Tests (when implementing):** SD1 parse/strip; SD2 prompt includes scratch coaching when image present.

---

## 3. CA-6 Misconception library

**Seed (~25 G4 tags):** fractions (unlike denominators add), place value, multi-digit multiply carry, bar-model part-whole swap, etc.

```ts
type MisconceptionTag = {
  id: string;
  skillIds: string[];
  label: string;
  promptHint: string;
};
```

On wrong turn, agent may emit `~~~misconception\n{"id":"frac-add-denom"}\n~~~`; client merges into `SkillMastery.misconceptionHits[]` (new optional field) for next prompts.

**Tests:** MC1 seed uniqueness; MC2 skill mapping; MC3 prompt injection.

---

## 4. CA-7 Multi-representation

Extend analogy switch: ordered enum `bar_model | number_line | story | money | blocks`. After ≥2 "still don't get it" on same skill, force next unused rep; store `preferredRepBySkill[skillId]`.

**Tests:** MR1 cycle order; MR2 persist preference; MR3 prompt lines.

---

## 5. CA-8 Dynamic board

`draw_geometry` responses carry `diagramId` + `revision`. Client replaces prior SVG with same id in thread (or append "updated figure"). Step highlight via CSS class on path ids `step-1`…

**Tests:** DB1 merge by diagramId; DB2 no flicker when streaming (reuse streaming-render-fix patterns).

---

## 6. Implementation order (downstream)

CA-7 (prompt-only) → CA-6 (seed+schema) → CA-5 (fence) → CA-8 (SVG lifecycle).  
Each phase: design checkbox in TODO → unit tests → wire → manual smoke.
