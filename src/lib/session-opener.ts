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
import { pickChallengeSkills } from "./challenge-mode";
import { kvGet, kvSet } from "./browser-kv";
import {
  daysSinceLastActivity,
  isSoftIdle,
  softReturnOpenerLine,
} from "./idle-nudge";
import { pickPracticeTargets, type PracticeTarget } from "./session-practice";
import type { LearningSource } from "./learning-memory";

export type SessionOpener = {
  skillId: string;
  label: string;
  kind: "review" | "zpd" | "recurring" | "return" | "practice" | "challenge";
  line: string;
  /** Up to 2 extra related skills for the short-practice card */
  practiceTargets?: PracticeTarget[];
  /** P0 — optional advanced hint offered above the daily ZPD/review target */
  challengeLine?: string;
  /** P1 — custom kickoff message used instead of the default opener line */
  kickoffOverride?: string;
  /** V2 attribution — learning mechanism this opener drives (default "opener"). */
  source?: LearningSource;
  /** P0-2 — most tracked skills are already mastered; the UI switches its
   * default supply from warm-up to challenge / adjacent exploration. */
  highMasteryMode?: boolean;
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

/** P0-2 — share of tracked skills already at/above the mastery threshold. */
export function highMasteryShare(
  mem: LearningMemory | null | undefined,
  threshold = 0.8,
): number {
  const tracked = (mem?.skills || []).filter((s) => s.attempts > 0);
  if (!tracked.length) return 0;
  return tracked.filter((s) => s.pKnown >= threshold).length / tracked.length;
}

/**
 * P0-2 — high-mastery ("hunger loop") mode: when most tracked skills are
 * mastered, the ZPD/review supply lines run dry, so the default opener must
 * switch from "warm up what you don't know" to "stretch what you do know".
 */
export function isHighMasteryMode(
  mem: LearningMemory | null | undefined,
  shareThreshold = 0.6,
): boolean {
  return highMasteryShare(mem) >= shareThreshold;
}

export function buildSessionOpener(
  mem: LearningMemory | null | undefined,
  accountId: string,
  now = new Date(),
): SessionOpener | null {
  if (wasOpenerShownToday(accountId, now)) return null;
  if (!mem?.skills?.length) return null;

  const highMastery = isHighMasteryMode(mem);

  // A3 — prefer skills weak across ≥2 days (with decay/expiry in gapHistory)
  const recurring = pickRecurringGapSkill(mem.gapHistory, mem);
  // AUDIT8 — FSRS-inspired daily queue outranks plain SM-2 overdue when present
  const queueTop = buildDailyReviewQueue(mem, {
    now: now.getTime(),
    limit: 1,
  })[0]?.skill;
  const review = queueTop ?? needsReviewSkills(mem, 1)[0];
  // P0-2 — with no real gap or due review, a saturated learner gets a
  // challenge target instead of a generic warm-up on an already-mastered skill.
  const challenge = highMastery ? pickChallengeSkills(mem, 1)[0] : undefined;
  const zpd = zpdWarmUpSkills(mem, 1)[0];
  const skill = recurring ?? review ?? challenge ?? zpd;
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
      highMasteryMode: highMastery,
    };
  }

  // P0-2 — the "hunger loop" opener: everything's learned, so offer a real
  // stretch on a mastered skill (challenge kickoff built by the caller).
  if (challenge && !recurring && !review) {
    return {
      skillId: challenge.id,
      label: challenge.label,
      kind: "challenge",
      line: `You've got a lot down already — how about a tougher spin on ${challenge.label}?`,
      source: "challenge",
      highMasteryMode: true,
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
    challengeLine: buildChallengeLine(mem, skill.id),
    highMasteryMode: highMastery,
  };
}

/** P0 — an optional high-end hint: name a mastered skill worth stretching. */
function buildChallengeLine(
  mem: LearningMemory,
  excludeSkillId: string,
): string | undefined {
  const mastered = [...(mem.skills || [])]
    .filter((s) => s.id !== excludeSkillId && s.pKnown >= 0.8)
    .sort((a, b) => b.pKnown - a.pKnown)[0];
  if (!mastered) return undefined;
  return `You've got ${mastered.label} down — ask me for a tougher spin on it.`;
}

/**
 * P0 — "再给我一题": rotate to the next practice target as the main opener.
 * Returns null when there is nothing to rotate to.
 */
export function rotateSessionOpener(
  opener: SessionOpener,
): SessionOpener | null {
  const targets = opener.practiceTargets;
  if (!targets || targets.length === 0) return null;
  const [next, ...rest] = targets;
  return {
    skillId: next.skillId,
    label: next.label,
    kind: opener.kind,
    line: `Today fits ${next.label} — or snap homework first?`,
    practiceTargets: [
      ...rest,
      { skillId: opener.skillId, label: opener.label },
    ],
    challengeLine: opener.challengeLine,
    source: opener.source,
    highMasteryMode: opener.highMasteryMode,
  };
}

export function buildOpenerKickoffMessage(opener: SessionOpener): string {
  if (opener.kickoffOverride?.trim()) return opener.kickoffOverride.trim();
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
