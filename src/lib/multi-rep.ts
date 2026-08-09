/**
 * CA-7 — Multi-representation cycle after repeated "still don't get it".
 */

export const REPRESENTATIONS = [
  "bar_model",
  "number_line",
  "story",
  "money",
  "blocks",
] as const;

export type Representation = (typeof REPRESENTATIONS)[number];

export const REP_LABELS: Record<Representation, string> = {
  bar_model: "bar model / Singapore bars",
  number_line: "number line",
  story: "concrete story / real-life scene",
  money: "money / coins",
  blocks: "base-ten blocks / manipulatives",
};

/** True when the student signals they still don't understand. */
export function looksLikeStillStuck(userText: string): boolean {
  const t = userText || "";
  if (
    /\b(i still don'?t (get|understand) it|still (confused|stuck)|still don'?t get)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // CJK — word boundaries don't apply
  return /还是不懂|还是不会|還是不懂|還是不會|仲係唔明|仲唔明|仍然不懂/.test(t);
}

export function isRepresentation(v: unknown): v is Representation {
  return typeof v === "string" && (REPRESENTATIONS as readonly string[]).includes(v);
}

/** Next unused rep in cycle order; wraps after all tried. */
export function nextRepresentation(
  lastUsed?: Representation | null,
  tried: Representation[] = [],
): Representation {
  const used = new Set(tried.filter(isRepresentation));
  if (lastUsed && isRepresentation(lastUsed)) used.add(lastUsed);
  for (const r of REPRESENTATIONS) {
    if (!used.has(r)) return r;
  }
  // All tried — advance from lastUsed
  if (lastUsed && isRepresentation(lastUsed)) {
    const i = REPRESENTATIONS.indexOf(lastUsed);
    return REPRESENTATIONS[(i + 1) % REPRESENTATIONS.length]!;
  }
  return REPRESENTATIONS[0];
}

/**
 * After ≥2 stuck signals on a skill, force the next unused representation.
 * Returns null if streak &lt; 2.
 */
export function pickForcedRepresentation(
  skillId: string,
  stuckStreak: number,
  preferredRepBySkill: Record<string, Representation> | undefined,
): Representation | null {
  if (!skillId || stuckStreak < 2) return null;
  const last = preferredRepBySkill?.[skillId];
  const tried = last ? [last] : [];
  return nextRepresentation(last, tried);
}

export function multiRepPromptLines(
  preferredRepBySkill?: Record<string, Representation> | null,
  forced?: { skillId: string; rep: Representation } | null,
): string[] {
  const lines = [
    "",
    "[Multi-representation — CA-7]",
    "Ordered reps: bar_model → number_line → story → money → blocks.",
    "If the student says they still don’t get it MORE THAN ONCE on the SAME skill, switch to the NEXT unused representation BEFORE L3 — do not repeat the same analogy.",
  ];
  if (preferredRepBySkill && Object.keys(preferredRepBySkill).length) {
    const bits = Object.entries(preferredRepBySkill)
      .slice(0, 6)
      .map(([id, rep]) => `${id}: ${REP_LABELS[rep] || rep}`);
    lines.push(`Last representation used per skill: ${bits.join("; ")}.`);
  }
  if (forced) {
    lines.push(
      `FORCE this turn: teach ${forced.skillId} using ${REP_LABELS[forced.rep]} (${forced.rep}) — different from prior tries.`,
    );
  }
  return lines;
}
