/**
 * Report-v3 R2 — serial gate: weak BKT → misconception hints → forced multi-rep.
 * Pure helpers so prompts + tests share one orchestration path.
 */

import {
  getMisconception,
  MISCONCEPTION_SEED,
  type MisconceptionHit,
} from "./misconceptions";
import {
  isRepresentation,
  pickForcedRepresentation,
  type Representation,
} from "./multi-rep";
import type { LearningMemory, SkillMastery } from "./learning-memory";

/** Skills at or below this P(L) are "weak" for closed-loop priority. */
export const WEAK_PKNOWN_THRESHOLD = 0.4;

export type PedagogyLoopPlan = {
  weakSkills: SkillMastery[];
  /** Misconception hits prioritized for weak skills (max 4). */
  misconceptionHits: MisconceptionHit[];
  /** Primary weak skill driving the loop, if any. */
  focusSkillId: string | null;
  forced: { skillId: string; rep: Representation } | null;
  /** True when weak skill + tagged misconception + forced rep all fire. */
  closedLoopActive: boolean;
};

function hitOnWeakSkill(
  hit: MisconceptionHit & { skillId: string },
  weakIds: Set<string>,
): boolean {
  if (weakIds.has(hit.skillId)) return true;
  const tag = getMisconception(hit.id);
  if (!tag) return false;
  return tag.skillIds.some((id) => weakIds.has(id));
}

/**
 * Prefer misconception hits tied to weak (pKnown &lt; 0.4) skills;
 * fall back to recent global hits so the library still teaches.
 */
export function prioritizeMisconceptionHits(
  mem: LearningMemory | null | undefined,
  max = 4,
): {
  hits: MisconceptionHit[];
  weakSkills: SkillMastery[];
  focusSkillId: string | null;
} {
  if (!mem?.skills?.length) {
    return { hits: [], weakSkills: [], focusSkillId: null };
  }
  const weakSkills = mem.skills
    .filter((s) => s.pKnown < WEAK_PKNOWN_THRESHOLD)
    .sort((a, b) => a.pKnown - b.pKnown || b.lastSeen - a.lastSeen);
  const weakIds = new Set(weakSkills.map((s) => s.id));
  const focusSkillId = weakSkills[0]?.id ?? null;

  const annotated = mem.skills.flatMap((s) =>
    (s.misconceptionHits || []).map((h) => ({ ...h, skillId: s.id })),
  );

  const weakHits = annotated
    .filter((h) => hitOnWeakSkill(h, weakIds))
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen);

  const otherHits = annotated
    .filter((h) => !hitOnWeakSkill(h, weakIds))
    .sort((a, b) => b.lastSeen - a.lastSeen);

  const seen = new Set<string>();
  const hits: MisconceptionHit[] = [];
  for (const h of [...weakHits, ...otherHits]) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    hits.push({ id: h.id, count: h.count, lastSeen: h.lastSeen });
    if (hits.length >= max) break;
  }

  // If weak skill has no stored hits, still surface seed tags for that skill
  // so the model probes known G4 patterns (count 0 = suggested, not observed).
  if (focusSkillId && hits.length < max) {
    for (const tag of MISCONCEPTION_SEED) {
      if (!tag.skillIds.includes(focusSkillId)) continue;
      if (seen.has(tag.id)) continue;
      seen.add(tag.id);
      hits.push({ id: tag.id, count: 0, lastSeen: 0 });
      if (hits.length >= max) break;
    }
  }

  return { hits, weakSkills, focusSkillId };
}

export function pickForcedFromMemory(
  mem: LearningMemory | null | undefined,
): { skillId: string; rep: Representation } | null {
  if (!mem) return null;
  const preferredRaw = mem.preferredRepBySkill || {};
  const preferred: Record<string, Representation> = {};
  for (const [k, v] of Object.entries(preferredRaw)) {
    if (isRepresentation(v)) preferred[k] = v;
  }
  const stuck = mem.stuckStreakBySkill || {};

  // Prefer forcing on the weakest skill that is stuck ≥2
  const weakFirst = [...(mem.skills || [])]
    .filter((s) => (stuck[s.id] || 0) >= 2)
    .sort((a, b) => a.pKnown - b.pKnown);
  for (const s of weakFirst) {
    const rep = pickForcedRepresentation(s.id, stuck[s.id] || 0, preferred);
    if (rep) return { skillId: s.id, rep };
  }
  for (const [skillId, streak] of Object.entries(stuck)) {
    const rep = pickForcedRepresentation(skillId, Number(streak) || 0, preferred);
    if (rep) return { skillId, rep };
  }
  return null;
}

/** Full closed-loop plan for one tutor turn. */
export function planPedagogyLoop(
  mem: LearningMemory | null | undefined,
): PedagogyLoopPlan {
  const { hits, weakSkills, focusSkillId } = prioritizeMisconceptionHits(mem);
  const forced = pickForcedFromMemory(mem);
  const weakHasMc =
    weakSkills.length > 0 &&
    hits.some((h) => {
      if (h.count <= 0 && h.lastSeen === 0) {
        // suggested seed for focus skill
        const tag = getMisconception(h.id);
        return !!focusSkillId && !!tag?.skillIds.includes(focusSkillId);
      }
      return weakSkills.some((s) =>
        (s.misconceptionHits || []).some((x) => x.id === h.id),
      );
    });
  const closedLoopActive =
    weakSkills.length > 0 && weakHasMc && forced != null;

  return {
    weakSkills,
    misconceptionHits: hits,
    focusSkillId,
    forced,
    closedLoopActive,
  };
}

/** Extra prompt lines when the serial gate is active. */
export function pedagogyLoopPromptLines(plan: PedagogyLoopPlan): string[] {
  if (!plan.weakSkills.length && !plan.forced) return [];
  const lines = [
    "",
    "[Pedagogy closed loop — Report-v3 R2]",
    "Order of operations for THIS turn (serial, not parallel):",
  ];
  if (plan.focusSkillId) {
    const weak = plan.weakSkills[0];
    lines.push(
      `1) Weak skill focus: ${weak?.label || plan.focusSkillId} (P(L)≈${Math.round((weak?.pKnown ?? 0) * 100)}% < ${Math.round(WEAK_PKNOWN_THRESHOLD * 100)}%). Stay on this skill unless the student changes topic.`,
    );
  } else {
    lines.push("1) No skill currently below the weak threshold — use recent misconceptions lightly.");
  }
  if (plan.misconceptionHits.length) {
    lines.push(
      "2) Probe with misconception hints before stronger scaffolds (see Misconceptions block).",
    );
  } else {
    lines.push("2) No tagged misconceptions yet — watch for a clear wrong pattern and emit ~~~misconception.");
  }
  if (plan.forced) {
    lines.push(
      `3) Forced multi-rep: use ${plan.forced.rep} for ${plan.forced.skillId} (stuck ≥2). Do not reuse the previous analogy.`,
    );
  } else {
    lines.push(
      "3) Multi-rep: only force a new representation after ≥2 “still don’t get it” on the same skill.",
    );
  }
  if (plan.closedLoopActive) {
    lines.push(
      "Closed loop ACTIVE: weak BKT + misconception + forced rep — after this attempt, the outcome must update BKT (correct/incorrect/practice) so P(L) can move.",
    );
  }
  return lines;
}
