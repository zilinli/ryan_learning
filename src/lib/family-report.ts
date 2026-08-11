/**
 * Family Controls report model — Khan-style parent visibility:
 * narrative summary + effort/mastery KPIs + charts + actionable mistake patterns.
 */

import {
  buildMasteryTrend30,
  buildSubjectRadar,
  radarPolygonPoints,
  SUBJECT_LABELS,
  type RadarPoint,
  type TrendPoint,
} from "./dashboard-stats";
import { getMisconception } from "./misconceptions";
import { getSkillDef } from "./skill-catalog";
import { buildParentWeeklyDigest, type ParentWeeklyDigest } from "./parent-digest";
import {
  daysSinceLastActivity,
  parentIdleNote,
} from "./idle-nudge";
import {
  normalizeMemory,
  type LearningMemory,
  type SkillMastery,
} from "./learning-memory";

export type PatternSeverity = "watch" | "recurring" | "persistent";

export type MistakePattern = {
  id: string;
  label: string;
  count: number;
  skillId?: string;
  skillLabel?: string;
  subject?: string;
  /** Plain-language tip for parents at home */
  parentTip: string;
  /** Coach hint (same as tutor promptHint) */
  coachHint: string;
  severity: PatternSeverity;
  lastSeen: number;
};

export type FamilyReport = {
  accountLabel: string;
  narrative: string;
  kpis: {
    skillsTracked: number;
    practicedThisWeek: number;
    gains: number;
    watch: number;
    reviewDue: number;
    idleDays: number | null;
  };
  radar: RadarPoint[];
  trend30: TrendPoint[];
  weekly: ParentWeeklyDigest;
  practicedBars: Array<{ id: string; label: string; mastery: number; hint: string }>;
  patterns: MistakePattern[];
  focus: SkillMastery[];
  reviewDue: SkillMastery[];
};

function severityFor(count: number): PatternSeverity {
  if (count >= 4) return "persistent";
  if (count >= 2) return "recurring";
  return "watch";
}

/** Parent-facing tip — shorter than tutor promptHint. */
export function parentTipForMisconception(id: string): string {
  const tag = getMisconception(id);
  if (!tag) return "Ask them to explain their steps out loud — listen for the sticky part.";
  // Prefer concrete home actions derived from known tags
  const tips: Record<string, string> = {
    "frac-add-denom":
      "At home: share a pizza/bar into same-size pieces before adding — never add the bottom numbers.",
    "frac-bigger-denom":
      "Compare 1/4 vs 1/8 with real pieces: more pieces of the same whole means each piece is smaller.",
    "frac-whole-vs-part":
      "Ask “what is the whole?” first, then “what part are we talking about?”",
    "place-value-tenths":
      "Line up 0.3 and 0.03 on paper; point to tenths vs hundredths columns.",
    "div-remainder-ignore":
      "After a division story, ask “how many are left over?” before they move on.",
    "word-op-choice":
      "Cover the numbers and ask what the story is asking — then uncover and choose +/−/×/÷.",
    "reading-quote-not-evidence":
      "Ask “how does that sentence prove the answer?” — quote ≠ evidence yet.",
  };
  if (tips[id]) return tips[id]!;
  // Fallback: soften tutor hint
  return tag.promptHint.replace(/^Student (may|thinks|mixes|confuses|drops|calls|reads|uses|copies|says|writes|converts)/i, "Watch for when they $1").slice(0, 160);
}

export function buildMistakePatterns(
  mem: LearningMemory,
  max = 10,
): MistakePattern[] {
  const map = new Map<string, MistakePattern>();
  for (const s of mem.skills) {
    for (const h of s.misconceptionHits || []) {
      const tag = getMisconception(h.id);
      const def = getSkillDef(s.id);
      const prev = map.get(h.id);
      if (!prev || h.count > prev.count || h.lastSeen > prev.lastSeen) {
        map.set(h.id, {
          id: h.id,
          label: tag?.label || h.id,
          count: h.count,
          skillId: s.id,
          skillLabel: s.label,
          subject: def?.subject
            ? SUBJECT_LABELS[def.subject as keyof typeof SUBJECT_LABELS] ||
              def.subject
            : undefined,
          parentTip: parentTipForMisconception(h.id),
          coachHint: tag?.promptHint || "",
          severity: severityFor(h.count),
          lastSeen: h.lastSeen,
        });
      }
    }
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastSeen - a.lastSeen ||
        a.label.localeCompare(b.label),
    )
    .slice(0, max);
}

function buildNarrative(
  mem: LearningMemory,
  weekly: ParentWeeklyDigest,
  patterns: MistakePattern[],
  now: number,
): string {
  const nameBits: string[] = [];
  const idle = daysSinceLastActivity(mem, now);
  const idleNote = parentIdleNote(idle);
  if (idleNote) nameBits.push(idleNote);

  if (!weekly.practiced.length && !idleNote) {
    return "No skill activity logged this week yet. A short warm-up on the tutor home screen is a gentle start.";
  }

  if (weekly.practiced.length) {
    const top = weekly.practiced
      .slice(0, 3)
      .map((p) => p.label)
      .join(", ");
    nameBits.push(`This week touched: ${top}.`);
  }
  if (weekly.masteryUp.length) {
    nameBits.push(
      `Gains showing in ${weekly.masteryUp.map((s) => s.label).join(", ")}.`,
    );
  }
  if (weekly.masteryDown.length) {
    nameBits.push(
      `Worth a calm look: ${weekly.masteryDown.map((s) => s.label).join(", ")}.`,
    );
  }
  if (patterns[0]) {
    nameBits.push(
      `Top sticky pattern: “${patterns[0].label}” (×${patterns[0].count}) — ${patterns[0].parentTip}`,
    );
  }
  if (weekly.nextWeekFocus.length) {
    nameBits.push(
      `Suggested focus next: ${weekly.nextWeekFocus.map((s) => s.label).join(", ")}.`,
    );
  }
  return nameBits.join(" ");
}

export function buildFamilyReport(
  mem: LearningMemory | null | undefined,
  opts: { accountLabel?: string; now?: number } = {},
): FamilyReport {
  const now = opts.now ?? Date.now();
  const accountLabel = opts.accountLabel || "Student";
  if (!mem?.skills?.length) {
    const weekly = buildParentWeeklyDigest(null, now);
    return {
      accountLabel,
      narrative:
        "No learning data yet. After a few tutor chats, this page fills with progress, charts, and mistake patterns.",
      kpis: {
        skillsTracked: 0,
        practicedThisWeek: 0,
        gains: 0,
        watch: 0,
        reviewDue: 0,
        idleDays: null,
      },
      radar: [],
      trend30: [],
      weekly,
      practicedBars: [],
      patterns: [],
      focus: [],
      reviewDue: [],
    };
  }
  const m = normalizeMemory(mem);
  const weekly = buildParentWeeklyDigest(m, now);
  const patterns = buildMistakePatterns(m);
  const radar = buildSubjectRadar(m);
  const trend30 = buildMasteryTrend30(m, now);

  return {
    accountLabel,
    narrative: buildNarrative(m, weekly, patterns, now),
    kpis: {
      skillsTracked: m.skills.length,
      practicedThisWeek: weekly.practiced.length,
      gains: weekly.masteryUp.length,
      watch: weekly.masteryDown.length,
      reviewDue: weekly.reviewDue.length,
      idleDays: weekly.idleDays,
    },
    radar,
    trend30,
    weekly,
    practicedBars: weekly.practiced.map((p) => ({
      id: p.id,
      label: p.label,
      mastery: p.mastery,
      hint: p.deltaHint,
    })),
    patterns,
    focus: weekly.nextWeekFocus,
    reviewDue: weekly.reviewDue,
  };
}

export { radarPolygonPoints, SUBJECT_LABELS };
