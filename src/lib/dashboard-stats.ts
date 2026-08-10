/**
 * Report-v3 R1 — dashboard aggregates from LearningMemory (no chart libs).
 */

import { getMisconception } from "./misconceptions";
import { getSkillDef } from "./skill-catalog";
import {
  needsReviewSkills,
  normalizeMemory,
  skillWeaknesses,
  zpdWarmUpSkills,
  type LearningMemory,
  type SkillMastery,
} from "./learning-memory";

export type SubjectKey = "math" | "science" | "ela" | "humanities" | "language" | "general";

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  math: "Math",
  science: "Science",
  ela: "ELA",
  humanities: "Humanities",
  language: "Language",
  general: "General",
};

export type RadarPoint = {
  subject: SubjectKey;
  label: string;
  /** 0–100 average mastery */
  value: number;
  skillCount: number;
};

export type TrendPoint = {
  day: string;
  /** Average mastery of skills touched that calendar day (from lastSeen). */
  avgMastery: number;
  touches: number;
};

export type HeatCell = {
  id: string;
  label: string;
  count: number;
  skillLabel?: string;
};

export type DashboardModel = {
  radar: RadarPoint[];
  reviewDue: SkillMastery[];
  zpd: SkillMastery[];
  weak: SkillMastery[];
  trend30: TrendPoint[];
  misconceptionHeat: HeatCell[];
  skillCount: number;
};

function subjectOf(skill: SkillMastery): SubjectKey {
  const def = getSkillDef(skill.id);
  return (def?.subject as SubjectKey) || "general";
}

export function buildSubjectRadar(mem: LearningMemory): RadarPoint[] {
  const buckets = new Map<SubjectKey, { sum: number; n: number }>();
  for (const s of mem.skills) {
    const sub = subjectOf(s);
    const b = buckets.get(sub) || { sum: 0, n: 0 };
    b.sum += s.mastery;
    b.n += 1;
    buckets.set(sub, b);
  }
  const keys: SubjectKey[] = ["math", "science", "ela", "humanities", "language", "general"];
  return keys
    .map((subject) => {
      const b = buckets.get(subject);
      return {
        subject,
        label: SUBJECT_LABELS[subject],
        value: b && b.n ? Math.round(b.sum / b.n) : 0,
        skillCount: b?.n || 0,
      };
    })
    .filter((p) => p.skillCount > 0 || p.subject === "math" || p.subject === "ela");
}

/** Approximate 30-day trend by binning skills' lastSeen day (proxy when no daily history series). */
export function buildMasteryTrend30(
  mem: LearningMemory,
  now = Date.now(),
): TrendPoint[] {
  const dayMs = 86_400_000;
  const points: TrendPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const t = now - i * dayMs;
    const day = new Date(t).toISOString().slice(0, 10);
    const dayStart = Date.UTC(
      new Date(t).getUTCFullYear(),
      new Date(t).getUTCMonth(),
      new Date(t).getUTCDate(),
    );
    const dayEnd = dayStart + dayMs;
    const touched = mem.skills.filter(
      (s) => s.lastSeen >= dayStart && s.lastSeen < dayEnd,
    );
    // Cumulative: skills seen on or before this day (smoother chart)
    const known = mem.skills.filter((s) => s.lastSeen > 0 && s.lastSeen <= dayEnd);
    const avgMastery = known.length
      ? Math.round(known.reduce((a, s) => a + s.mastery, 0) / known.length)
      : 0;
    points.push({
      day,
      avgMastery,
      touches: touched.length,
    });
  }
  return points;
}

export function buildMisconceptionHeat(mem: LearningMemory, max = 8): HeatCell[] {
  const map = new Map<string, HeatCell>();
  for (const s of mem.skills) {
    for (const h of s.misconceptionHits || []) {
      const tag = getMisconception(h.id);
      const prev = map.get(h.id);
      if (!prev || h.count > prev.count) {
        map.set(h.id, {
          id: h.id,
          label: tag?.label || h.id,
          count: h.count,
          skillLabel: s.label,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, max);
}

export function buildDashboardModel(
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): DashboardModel {
  if (!mem?.skills?.length) {
    return {
      radar: [],
      reviewDue: [],
      zpd: [],
      weak: [],
      trend30: [],
      misconceptionHeat: [],
      skillCount: 0,
    };
  }
  const m = normalizeMemory(mem);
  return {
    radar: buildSubjectRadar(m),
    reviewDue: needsReviewSkills(m, 6),
    zpd: zpdWarmUpSkills(m, 5),
    weak: skillWeaknesses(m, 5),
    trend30: buildMasteryTrend30(m, now),
    misconceptionHeat: buildMisconceptionHeat(m),
    skillCount: m.skills.length,
  };
}

/** SVG polygon points for radar (cx,cy,r, values 0–100). */
export function radarPolygonPoints(
  values: number[],
  cx: number,
  cy: number,
  r: number,
): string {
  const n = values.length || 1;
  return values
    .map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
      return `${cx + Math.cos(angle) * rr},${cy + Math.sin(angle) * rr}`;
    })
    .join(" ");
}
