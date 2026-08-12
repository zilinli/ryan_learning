/**
 * CA-3 — Once/day ZPD or due-review opener for empty new chats.
 */

import {
  needsReviewSkills,
  zpdWarmUpSkills,
  type LearningMemory,
} from "./learning-memory";
import { buildDailyReviewQueue } from "./review-queue";
import { pickRecurringGapSkill } from "./knowledge-gaps";
import { kvGet, kvSet } from "./browser-kv";
import {
  daysSinceLastActivity,
  isSoftIdle,
  softReturnOpenerLine,
} from "./idle-nudge";
import { pickPracticeTargets, type PracticeTarget } from "./session-practice";

export type SessionOpener = {
  skillId: string;
  label: string;
  kind: "review" | "zpd" | "recurring" | "return" | "practice";
  line: string;
  /** Up to 2 extra related skills for the short-practice card */
  practiceTargets?: PracticeTarget[];
};

const DATE_KEY_PREFIX = "spark.opener.date.";

export function openerDateStorageKey(accountId: string): string {
  return `${DATE_KEY_PREFIX}${accountId || "default"}`;
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function wasOpenerShownToday(
  accountId: string,
  now = new Date(),
): boolean {
  const v = kvGet(openerDateStorageKey(accountId));
  return v === localDateKey(now);
}

export function markOpenerShown(accountId: string, now = new Date()): void {
  kvSet(openerDateStorageKey(accountId), localDateKey(now));
}

export function buildSessionOpener(
  mem: LearningMemory | null | undefined,
  accountId: string,
  now = new Date(),
): SessionOpener | null {
  if (wasOpenerShownToday(accountId, now)) return null;
  if (!mem?.skills?.length) return null;

  // A3 — prefer skills weak across ≥2 days (with decay/expiry in gapHistory)
  const recurring = pickRecurringGapSkill(mem.gapHistory, mem);
  // AUDIT8 — FSRS-inspired daily queue outranks plain SM-2 overdue when present
  const queueTop = buildDailyReviewQueue(mem, {
    now: now.getTime(),
    limit: 1,
  })[0]?.skill;
  const review = queueTop ?? needsReviewSkills(mem, 1)[0];
  const zpd = zpdWarmUpSkills(mem, 1)[0];
  const skill = recurring ?? review ?? zpd;
  if (!skill) return null;

  const idleDays = daysSinceLastActivity(mem, now.getTime());
  const softIdle = isSoftIdle(mem, now.getTime());

  // AUD.6a — idle soft return overrides copy (still once/day; no streak UI)
  if (softIdle && idleDays != null) {
    return {
      skillId: skill.id,
      label: skill.label,
      kind: "return",
      line: softReturnOpenerLine(skill.label, idleDays),
    };
  }

  const kind: SessionOpener["kind"] = recurring
    ? "recurring"
    : review
      ? "review"
      : "zpd";
  const line =
    kind === "recurring"
      ? `${skill.label} has been tricky the last few days — warm up, or snap homework first?`
      : `Today fits ${skill.label} — or snap homework first?`;

  // Build additional practice targets for the clickable card
  const targets: PracticeTarget[] = [];
  if (kind === "review" || kind === "zpd") {
    // Select 2 extra warm-up skills (different from the main skill)
    const extras = pickPracticeTargets(mem, 4).filter(
      (t) => t.skillId !== skill.id,
    );
    targets.push(...extras.slice(0, 2));
  }

  return {
    skillId: skill.id,
    label: skill.label,
    kind,
    line,
    practiceTargets: targets.length > 0 ? targets : undefined,
  };
}

export function buildOpenerKickoffMessage(opener: SessionOpener): string {
  return `Let's warm up with ${opener.label}. One short question at a time — guide me, don't spoil.`;
}

/** B1.h — homework / photo intent should suppress opener interrupt. */
export function looksLikeHomeworkIntent(text: string): boolean {
  return /\b(homework|worksheet|assignment|snap|photo|camera|作业|功課|功课|習題|习题)\b/i.test(
    text || "",
  );
}

/**
 * B1.h — if student states homework intent, treat opener as shown (yield).
 * Returns null when yielded.
 */
export function yieldOpenerForHomework(
  accountId: string,
  userText: string,
  now = new Date(),
): boolean {
  if (!looksLikeHomeworkIntent(userText)) return false;
  markOpenerShown(accountId, now);
  return true;
}
