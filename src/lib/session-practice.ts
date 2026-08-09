/**
 * CA-2 — Post-session knowledge gaps → 3 targeted drills offer.
 */

import {
  needsReviewSkills,
  skillWeaknesses,
  zpdWarmUpSkills,
  type LearningMemory,
  type SkillMastery,
} from "./learning-memory";
import { kvGet, kvRemove, kvSet } from "./browser-kv";

export type PracticeTarget = {
  skillId: string;
  label: string;
};

export type PendingPracticeOffer = {
  accountId: string;
  targets: PracticeTarget[];
  createdAt: number;
  /** Local YYYY-MM-DD — hide until this day if set via Tomorrow */
  deferredUntil?: string;
};

const KEY_PREFIX = "spark.practiceOffer.";

export function practiceOfferStorageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId || "default"}`;
}

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tomorrowKey(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  return localDateKey(d);
}

function dedupeSkills(skills: SkillMastery[], limit: number): PracticeTarget[] {
  const seen = new Set<string>();
  const out: PracticeTarget[] = [];
  for (const s of skills) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ skillId: s.id, label: s.label });
    if (out.length >= limit) break;
  }
  return out;
}

/** Prefer weaknesses, then review-due, then ZPD warm-ups. */
export function pickPracticeTargets(
  mem: LearningMemory | null | undefined,
  limit = 3,
): PracticeTarget[] {
  if (!mem?.skills?.length) return [];
  const weak = skillWeaknesses(mem, limit);
  const review = needsReviewSkills(mem, limit);
  const zpd = zpdWarmUpSkills(mem, limit);
  return dedupeSkills([...weak, ...review, ...zpd], limit);
}

export function buildPracticeKickoffMessage(targets: PracticeTarget[]): string {
  const labels = targets.map((t) => t.label).join(", ");
  return `Let's practice: ${labels}. Give me 3 short questions one at a time — Socratic hints only, no spoilers.`;
}

export function savePracticeOffer(offer: PendingPracticeOffer): void {
  kvSet(practiceOfferStorageKey(offer.accountId), JSON.stringify(offer));
}

export function clearPracticeOffer(accountId: string): void {
  kvRemove(practiceOfferStorageKey(accountId));
}

export function loadPracticeOffer(
  accountId: string,
  now = new Date(),
): PendingPracticeOffer | null {
  const raw = kvGet(practiceOfferStorageKey(accountId));
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as PendingPracticeOffer;
    if (!o?.targets?.length) return null;
    if (o.deferredUntil && o.deferredUntil > localDateKey(now)) return null;
    return { ...o, accountId: o.accountId || accountId };
  } catch {
    return null;
  }
}

export function createPracticeOffer(
  accountId: string,
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): PendingPracticeOffer | null {
  const targets = pickPracticeTargets(mem, 3);
  if (!targets.length) return null;
  return { accountId, targets, createdAt: now };
}

/** Tomorrow — hide until next local calendar day. */
export function deferPracticeOffer(
  offer: PendingPracticeOffer,
  from = new Date(),
): PendingPracticeOffer {
  return { ...offer, deferredUntil: tomorrowKey(from) };
}
