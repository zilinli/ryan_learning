/**
 * AUD.4 — Build a portable JSON snapshot of one account's learning memory
 * for parent PIN export. No secrets; no other tenants.
 */

import {
  buildParentDailyDigest,
  buildParentWeeklyDigest,
} from "./parent-digest";
import type { LearningMemory, SkillMastery } from "./learning-memory";

export const ACCOUNT_EXPORT_VERSION = 1 as const;

export type AccountLearningExport = {
  version: typeof ACCOUNT_EXPORT_VERSION;
  exportedAt: string;
  accountId: string;
  skillCount: number;
  skills: Array<{
    id: string;
    label: string;
    topicId: string;
    mastery: number;
    pKnown: number;
    attempts: number;
    correct: number;
    incorrect: number;
    lastSeen: number;
    misconceptionHits?: Array<{ id: string; count: number; lastSeen: number }>;
  }>;
  recentWins: string[];
  recentStruggles: string[];
  dailyDigest: string;
  weeklyDigest: string;
};

function slimSkill(s: SkillMastery): AccountLearningExport["skills"][number] {
  return {
    id: s.id,
    label: s.label,
    topicId: s.topicId,
    mastery: s.mastery,
    pKnown: s.pKnown,
    attempts: s.attempts,
    correct: s.correct,
    incorrect: s.incorrect,
    lastSeen: s.lastSeen,
    ...(s.misconceptionHits?.length
      ? { misconceptionHits: s.misconceptionHits.map((h) => ({ ...h })) }
      : {}),
  };
}

/**
 * Sanitize accountId and build export. Returns null if accountId empty.
 */
export function buildAccountLearningExport(
  accountId: string,
  mem: LearningMemory | null | undefined,
  now = Date.now(),
): AccountLearningExport | null {
  const id = String(accountId || "")
    .trim()
    .slice(0, 64);
  if (!id) return null;

  const skills = [...(mem?.skills || [])]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map(slimSkill);

  return {
    version: ACCOUNT_EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    accountId: id,
    skillCount: skills.length,
    skills,
    recentWins: (mem?.recentWins || []).slice(0, 20),
    recentStruggles: (mem?.recentStruggles || []).slice(0, 20),
    dailyDigest: buildParentDailyDigest(mem),
    weeklyDigest: buildParentWeeklyDigest(mem, now).text,
  };
}

export function accountExportFilename(
  accountId: string,
  now = Date.now(),
): string {
  const safe = String(accountId || "account")
    .replace(/^acct_/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 32) || "account";
  const day = new Date(now).toISOString().slice(0, 10);
  return `spark-learning-${safe}-${day}.json`;
}

/** Browser helper — triggers a JSON download. */
export function downloadAccountLearningExport(
  payload: AccountLearningExport,
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = accountExportFilename(payload.accountId, Date.parse(payload.exportedAt) || Date.now());
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
