/**
 * TED Challenge → homepage tutor handoff (sessionStorage one-shots).
 * Submit & discuss stashes kickoff + resume; TutorShell auto-sends; Next restores Lab.
 */

import type { ChallengeItem, ChoiceMode, TedChallenge } from "./ted-challenge";
import { choiceLetter } from "./ted-challenge";

export const TED_CHALLENGE_KICKOFF_KEY = "spark.tedChallengeKickoff.v1";
export const TED_CHALLENGE_RESUME_KEY = "spark.tedChallengeResume.v1";

export type TedChallengeKickoff = {
  talkSlug: string;
  talkTitle: string;
  speaker: string;
  itemId: string;
  kind: string;
  prompt: string;
  choices: string[];
  selected: number[];
  essay: string;
  /** Question index just submitted (0-based). */
  qi: number;
  /** Next question index to resume at (qi + 1). */
  nextQi: number;
  accountId?: string;
};

export type TedChallengeResume = {
  talkSlug: string;
  talkTitle: string;
  speaker: string;
  challenge: TedChallenge;
  /** Index to show when Lab opens. */
  qi: number;
  answers?: Record<string, { selected: number[]; essay: string }>;
  accountId?: string;
};

const kickoffMemory = new Map<string, string>();
const resumeMemory = new Map<string, string>();

function writeKey(
  key: string,
  raw: string,
  memory: Map<string, string>,
): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, raw);
      return;
    }
  } catch {
    /* fall through */
  }
  memory.set(key, raw);
}

function readKey(key: string, memory: Map<string, string>): string | null {
  try {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(key);
    }
  } catch {
    /* fall through */
  }
  return memory.get(key) ?? null;
}

function clearKey(key: string, memory: Map<string, string>): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

/** Essay required; selection optional. */
export function canSubmitHybrid(
  essay: string,
  _selected: number[] = [],
): { ok: boolean; reason?: string } {
  if (essay.trim().length < 3) {
    return { ok: false, reason: "Write a short essay (at least a few characters) before discussing." };
  }
  return { ok: true };
}

export function formatSelectedChoiceSummary(
  choices: string[],
  selected: number[],
): string {
  const picked = [
    ...new Set(
      selected.filter(
        (i) => Number.isInteger(i) && i >= 0 && i < choices.length,
      ),
    ),
  ].sort((a, b) => a - b);
  if (picked.length === 0) {
    return "None of the listed options (student's own view — explain in essay)";
  }
  return picked
    .map((i) => `${choiceLetter(i)}. ${choices[i]}`)
    .join("; ");
}

/** User turn that starts Socratic Q&A on the homepage. */
export function buildTedChallengeKickoffMessage(k: TedChallengeKickoff): string {
  const choiceLine = formatSelectedChoiceSummary(k.choices, k.selected);
  return [
    `TED Challenge discussion — talk: "${k.talkTitle}" by ${k.speaker}.`,
    `Prompt (${k.kind}): ${k.prompt}`,
    `My selection: ${choiceLine}`,
    `My essay / 论述: ${k.essay.trim()}`,
    "",
    "Please be my AI teacher in Socratic Q&A mode: guide my thinking with questions, do not spoil the 'correct' letter(s), and help me check whether my logic is self-consistent.",
    "When my reasoning holds together (claims + evidence + logic align), say clearly that my thinking is solid and suggest I am ready for the next TED Challenge question. I may keep chatting with you or go back for the next question.",
  ].join("\n");
}

const COHERENCE_RE =
  /\b(thinking (holds together|is solid|is self-consistent|checks out)|logic (holds|is solid|is self-consistent|checks out)|ready for the next (TED )?Challenge|ready for the next (TED )?question|reasoning (holds|is solid|is coherent))\b/i;

/** Detect tutor completion cue suggesting next TED question. */
export function detectTedCoherenceSignal(assistantText: string): boolean {
  const t = String(assistantText || "").trim();
  if (!t) return false;
  return COHERENCE_RE.test(t);
}

export function stashTedChallengeKickoff(k: TedChallengeKickoff): void {
  const payload: TedChallengeKickoff = {
    talkSlug: String(k.talkSlug || "").slice(0, 160),
    talkTitle: String(k.talkTitle || "").slice(0, 200),
    speaker: String(k.speaker || "").slice(0, 120),
    itemId: String(k.itemId || "").slice(0, 48),
    kind: String(k.kind || "").slice(0, 32),
    prompt: String(k.prompt || "").slice(0, 2000),
    choices: (k.choices || []).map((c) => String(c).slice(0, 300)).slice(0, 4),
    selected: [...new Set(k.selected || [])]
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4)
      .slice(0, 4),
    essay: String(k.essay || "").trim().slice(0, 4000),
    qi: Math.max(0, Math.floor(Number(k.qi) || 0)),
    nextQi: Math.max(0, Math.floor(Number(k.nextQi) || 0)),
    accountId: k.accountId ? String(k.accountId).slice(0, 64) : undefined,
  };
  writeKey(TED_CHALLENGE_KICKOFF_KEY, JSON.stringify(payload), kickoffMemory);
}

export function consumeTedChallengeKickoff(): TedChallengeKickoff | null {
  const raw = readKey(TED_CHALLENGE_KICKOFF_KEY, kickoffMemory);
  clearKey(TED_CHALLENGE_KICKOFF_KEY, kickoffMemory);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<TedChallengeKickoff>;
    const talkSlug = String(p.talkSlug || "").trim();
    const prompt = String(p.prompt || "").trim();
    const essay = String(p.essay || "").trim();
    if (!talkSlug || !prompt || essay.length < 3) return null;
    return {
      talkSlug,
      talkTitle: String(p.talkTitle || talkSlug).slice(0, 200),
      speaker: String(p.speaker || "Speaker").slice(0, 120),
      itemId: String(p.itemId || "q").slice(0, 48),
      kind: String(p.kind || "critique").slice(0, 32),
      prompt: prompt.slice(0, 2000),
      choices: Array.isArray(p.choices)
        ? p.choices.map((c) => String(c).slice(0, 300)).slice(0, 4)
        : [],
      selected: Array.isArray(p.selected)
        ? [...new Set(p.selected)]
            .filter((n) => Number.isInteger(n) && n >= 0 && n < 4)
            .slice(0, 4)
        : [],
      essay: essay.slice(0, 4000),
      qi: Math.max(0, Math.floor(Number(p.qi) || 0)),
      nextQi: Math.max(0, Math.floor(Number(p.nextQi) || 0)),
      accountId: p.accountId ? String(p.accountId).slice(0, 64) : undefined,
    };
  } catch {
    return null;
  }
}

/** Peek without clearing — for return banner after consume already ran via TutorShell state. */
export function peekTedChallengeResume(): TedChallengeResume | null {
  const raw = readKey(TED_CHALLENGE_RESUME_KEY, resumeMemory);
  if (!raw) return null;
  return parseResume(raw);
}

export function stashTedChallengeResume(r: TedChallengeResume): void {
  const payload: TedChallengeResume = {
    talkSlug: String(r.talkSlug || "").slice(0, 160),
    talkTitle: String(r.talkTitle || "").slice(0, 200),
    speaker: String(r.speaker || "").slice(0, 120),
    challenge: r.challenge,
    qi: Math.max(0, Math.floor(Number(r.qi) || 0)),
    answers: r.answers,
    accountId: r.accountId ? String(r.accountId).slice(0, 64) : undefined,
  };
  writeKey(TED_CHALLENGE_RESUME_KEY, JSON.stringify(payload), resumeMemory);
}

function parseResume(raw: string): TedChallengeResume | null {
  try {
    const p = JSON.parse(raw) as Partial<TedChallengeResume>;
    const talkSlug = String(p.talkSlug || "").trim();
    const challenge = p.challenge as TedChallenge | undefined;
    if (!talkSlug || !challenge?.items?.length) return null;
    return {
      talkSlug,
      talkTitle: String(p.talkTitle || talkSlug).slice(0, 200),
      speaker: String(p.speaker || "Speaker").slice(0, 120),
      challenge,
      qi: Math.max(0, Math.floor(Number(p.qi) || 0)),
      answers: p.answers,
      accountId: p.accountId ? String(p.accountId).slice(0, 64) : undefined,
    };
  } catch {
    return null;
  }
}

export function consumeTedChallengeResume(): TedChallengeResume | null {
  const raw = readKey(TED_CHALLENGE_RESUME_KEY, resumeMemory);
  clearKey(TED_CHALLENGE_RESUME_KEY, resumeMemory);
  if (!raw) return null;
  return parseResume(raw);
}

export function clearTedChallengeResume(): void {
  clearKey(TED_CHALLENGE_RESUME_KEY, resumeMemory);
}

export function tedLabResumeHref(): string {
  return "/studio?game=ted-lab";
}

/** Build kickoff + resume payloads after a successful submit. */
export function prepareTedChallengeHandoff(args: {
  talkSlug: string;
  talkTitle: string;
  speaker: string;
  item: ChallengeItem;
  selected: number[];
  essay: string;
  qi: number;
  challenge: TedChallenge;
  answers: Record<string, { selected: number[]; essay: string }>;
  accountId?: string;
}): { kickoff: TedChallengeKickoff; resume: TedChallengeResume } {
  const nextQi = args.qi + 1;
  const kickoff: TedChallengeKickoff = {
    talkSlug: args.talkSlug,
    talkTitle: args.talkTitle,
    speaker: args.speaker,
    itemId: args.item.id,
    kind: args.item.kind,
    prompt: args.item.prompt,
    choices: args.item.choices,
    selected: args.selected,
    essay: args.essay,
    qi: args.qi,
    nextQi,
    accountId: args.accountId,
  };
  const resume: TedChallengeResume = {
    talkSlug: args.talkSlug,
    talkTitle: args.talkTitle,
    speaker: args.speaker,
    challenge: args.challenge,
    qi: nextQi,
    answers: args.answers,
    accountId: args.accountId,
  };
  return { kickoff, resume };
}

/** Soft helper — re-export ChoiceMode for tests that touch hybrid submit. */
export type { ChoiceMode };
