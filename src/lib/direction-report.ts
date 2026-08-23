/**
 * P2-3 — quarterly "direction report": a dynamic self-description card
 * ("Ryan · space explorer · becoming a filmmaker") generated from the
 * student's interest profile + creation portfolio, and editable by them.
 * Pure logic kept here so it is unit-testable; persistence is per-account
 * localStorage via browser-kv.
 */

import { kvGet, kvSet } from "./browser-kv";
import type { InterestRecord } from "./interest-store";
import type { CreationItem } from "./entertain/creations-store";

export type SelfDescription = {
  /** "Name · nickname · becoming …" — shown as the card headline. */
  line: string;
  nickname: string;
  becoming: string;
  /** One warm sentence grounding the description in real activity. */
  blurb: string;
};

const TYPE_BECOMING: Record<string, string> = {
  song: "a songwriter",
  image: "an artist",
  video: "a filmmaker",
  essay: "a writer",
  journal: "a writer",
  ted: "a storyteller",
  natgeo: "a nature explorer",
  bbc: "a documentary fan",
  rsa: "an ideas shaper",
  podcast: "a podcast listener",
  painting: "an artist",
  comic: "a comic maker",
};

export function buildSelfDescription(
  name: string,
  interests: InterestRecord[] = [],
  creations: CreationItem[] = [],
): SelfDescription {
  const top = [...interests].sort(
    (a, b) => b.count - a.count || b.exploredAt - a.exploredAt,
  )[0];
  const nickname = top ? `${top.label} explorer` : "curious mind";
  const latest = [...creations].sort((a, b) => b.createdAt - a.createdAt)[0];
  const becoming = latest
    ? TYPE_BECOMING[latest.type] || "a creator"
    : top
      ? `a ${top.label} explorer`
      : "a builder of ideas";
  const line = `${name} · ${nickname} · becoming ${becoming}`;
  let blurb = top
    ? `You keep coming back to ${top.label} — ${top.count} time${
        top.count === 1 ? "" : "s"
      } this season.`
    : "Every explorer starts somewhere — pick a topic you love today.";
  if (latest) blurb += ` Your latest piece: “${latest.title}”.`;
  return { line, nickname, becoming, blurb };
}

const KEY_PREFIX = "spark.selfDescription.";

export function selfDescriptionKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId || "default"}`;
}

/** Custom headline the student typed themselves, if any. */
export function loadCustomDescription(accountId: string): string | null {
  const raw = kvGet(selfDescriptionKey(accountId));
  if (!raw) return null;
  try {
    const text = JSON.parse(raw);
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

export function saveCustomDescription(accountId: string, text: string): void {
  kvSet(selfDescriptionKey(accountId), JSON.stringify(text.trim().slice(0, 120)));
}

export function clearCustomDescription(accountId: string): void {
  saveCustomDescription(accountId, "");
}
