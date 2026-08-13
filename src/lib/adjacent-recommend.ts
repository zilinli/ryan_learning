/**
 * P2 — cross-domain auto-recommendation (report §9.4.3).
 * When a skill reaches high BKT mastery (pKnown ≥ 0.8), nudge the student
 * toward a *neighboring* skill (SkillDef.adjacent) that is still fresh —
 * breadth grows out of depth (astronomy → gravity; fractions → ratios).
 */

import { getSkillDef } from "./skill-catalog";
import type { LearningMemory, SkillMastery } from "./learning-memory";
import type { SessionOpener } from "./session-opener";

export type AdjacentRecommend = {
  /** The mastered skill we're building from */
  fromSkillId: string;
  fromLabel: string;
  /** The adjacent skill being recommended */
  skillId: string;
  label: string;
  line: string;
};

const MASTERED = 0.8;

function masteryById(mem: LearningMemory): Map<string, SkillMastery> {
  const m = new Map<string, SkillMastery>();
  for (const s of mem?.skills || []) {
    if (s && s.id) m.set(s.id, s);
  }
  return m;
}

function isFresh(s: SkillMastery | undefined): boolean {
  return !s || s.pKnown < MASTERED;
}

/**
 * Find the single best "neighbor" recommendation:
 * 1. highest-pKnown mastered skill with an `adjacent` list;
 * 2. prefer adjacent skills the student has never touched;
 * 3. prefer cross-subject jumps (real breadth) over within-subject steps.
 * Returns null when nothing is worth recommending.
 */
export function recommendAdjacent(
  mem: LearningMemory | null | undefined,
): AdjacentRecommend | null {
  if (!mem?.skills?.length) return null;
  const byId = masteryById(mem);

  const mastered = [...mem.skills]
    .filter((s) => s.pKnown >= MASTERED && s.attempts > 0)
    .sort((a, b) => b.pKnown - a.pKnown || b.attempts - a.attempts);

  for (const from of mastered) {
    const def = getSkillDef(from.id);
    if (!def?.adjacent?.length) continue;
    const candidates = def.adjacent
      .map((id) => getSkillDef(id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .filter((d) => isFresh(byId.get(d.id)))
      .map((d) => {
        const touched = byId.get(d.id);
        return {
          def: d,
          touched: !!touched && touched.attempts > 0,
          crossSubject: d.subject !== def.subject,
        };
      });
    if (!candidates.length) continue;
    // untouched first, then cross-subject jumps
    candidates.sort(
      (a, b) =>
        Number(a.touched) - Number(b.touched) ||
        Number(b.crossSubject) - Number(a.crossSubject),
    );
    const best = candidates[0];
    return {
      fromSkillId: from.id,
      fromLabel: from.label,
      skillId: best.def.id,
      label: best.def.label,
      line: `You've got ${from.label} down — want to peek at its neighbor, ${best.def.label}?`,
    };
  }
  return null;
}

/** Kickoff handed to the LLM: frame a ZPD entry question for the neighbor. */
export function buildAdjacentKickoffMessage(
  rec: AdjacentRecommend,
  mem: LearningMemory | null | undefined,
): string {
  const known = [...(mem?.skills || [])]
    .filter((s) => s.id === rec.fromSkillId)
    .map((s) => s.label)[0];
  return [
    `You've already got ${known || rec.fromLabel} down.`,
    `Let's take one peek at its neighbor: ${rec.label}.`,
    "Give me ONE gentle introduction question for it — at the very edge of what I know.",
    "Socratic hints only, no spoilers. If I nail it fast, make the next one slightly harder; if I'm stuck, nudge me.",
    "Keep it short and curiosity-first.",
  ].join("\n");
}

/** Wrap the recommendation as an extra SessionOpener card (kind "zpd"). */
export function buildAdjacentOpener(
  mem: LearningMemory | null | undefined,
): SessionOpener | null {
  const rec = recommendAdjacent(mem);
  if (!rec) return null;
  return {
    skillId: rec.skillId,
    label: rec.label,
    kind: "zpd",
    line: rec.line,
    kickoffOverride: buildAdjacentKickoffMessage(rec, mem),
    source: "connection",
  };
}
