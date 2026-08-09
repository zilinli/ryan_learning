/**
 * D2 — Parent daily one-liner (PIN-gated UI). Pure string builder from BKT memory.
 */

import {
  needsReviewSkills,
  skillWeaknesses,
  zpdWarmUpSkills,
  type LearningMemory,
} from "./learning-memory";

export function buildParentDailyDigest(
  mem: LearningMemory | null | undefined,
): string {
  if (!mem?.skills?.length) {
    return "Today: no skill activity logged yet.";
  }
  const weak = skillWeaknesses(mem, 2);
  const review = needsReviewSkills(mem, 1);
  const zpd = zpdWarmUpSkills(mem, 1);
  const focus = weak[0] ?? review[0] ?? zpd[0];
  const parts: string[] = [];
  if (focus) {
    parts.push(`Today: ${focus.label}`);
    if (focus.mastery <= 50) {
      parts.push(`still building (~${focus.mastery}%)`);
    } else if (review[0]?.id === focus.id) {
      parts.push("due for review");
    } else {
      parts.push("in the practice zone");
    }
  }
  if (weak.length > 1) {
    parts.push(`also watch ${weak[1]!.label}`);
  }
  const recent = [...mem.skills].sort((a, b) => b.lastSeen - a.lastSeen)[0];
  if (recent && (!focus || recent.id !== focus.id)) {
    parts.push(`last chat touched ${recent.label}`);
  }
  return parts.join(" · ").slice(0, 280);
}
