/**
 * CA-3 — Once/day ZPD or due-review opener for empty new chats.
 */

import {
  needsReviewSkills,
  zpdWarmUpSkills,
  type LearningMemory,
} from "./learning-memory";
import { kvGet, kvSet } from "./browser-kv";

export type SessionOpener = {
  skillId: string;
  label: string;
  kind: "review" | "zpd";
  line: string;
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

  const review = needsReviewSkills(mem, 1)[0];
  const zpd = zpdWarmUpSkills(mem, 1)[0];
  const skill = review ?? zpd;
  if (!skill) return null;

  const kind: SessionOpener["kind"] = review ? "review" : "zpd";
  const line = `Today fits ${skill.label} — or snap homework first?`;
  return { skillId: skill.id, label: skill.label, kind, line };
}

export function buildOpenerKickoffMessage(opener: SessionOpener): string {
  return `Let's warm up with ${opener.label}. One short question at a time — guide me, don't spoil.`;
}
