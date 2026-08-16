/**
 * Generic Lab (BBC / NatGeo / RSA) challenge → homepage tutor handoff.
 * Mirrors ted-challenge-handoff so MediaLabChallengeView can offer the same
 * "continue in main chat" round trip without coupling to TED internals.
 */

import type { LabDiscussId } from "./lab-discuss";
import { LAB_GAME_PARAM } from "../cross-lab";

export const LAB_CHALLENGE_KICKOFF_KEY = "spark.labChallengeKickoff.v1";

export type LabChallengeKickoff = {
  lab: LabDiscussId;
  title: string;
  speaker: string;
  kind: string;
  prompt: string;
  choices: string[];
  selected: number[];
  essay: string;
  accountId?: string;
};

const kickoffMemory = new Map<string, string>();

function writeKey(key: string, raw: string, memory: Map<string, string>): void {
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

export function labChallengeLabel(lab: LabDiscussId): string {
  if (lab === "bbc") return "BBC Doc Lab";
  if (lab === "rsa") return "RSA Lab";
  return "NatGeo Lab";
}

/** User turn that starts Socratic Q&A on the homepage. */
export function buildLabChallengeKickoffMessage(k: LabChallengeKickoff): string {
  const choiceLine =
    k.selected.length > 0
      ? k.selected
          .filter((i) => Number.isInteger(i) && i >= 0 && i < k.choices.length)
          .map((i) => `${String.fromCharCode(65 + i)}. ${k.choices[i]}`)
          .join("; ")
      : "(none — own view)";
  return [
    `${labChallengeLabel(k.lab)} challenge discussion — "${k.title}" by ${k.speaker}.`,
    `Prompt (${k.kind}): ${k.prompt}`,
    `My selection: ${choiceLine}`,
    `My essay / 论述: ${k.essay.trim()}`,
    "",
    "Please be my AI teacher in Socratic Q&A mode: guide my thinking with questions, do not spoil the 'correct' letter(s), and help me check whether my logic is self-consistent.",
    "When my reasoning holds together (claims + evidence + logic align), say clearly that my thinking is solid and suggest I am ready for the next challenge question. I may keep chatting with you or go back to the lab for the next question.",
  ].join("\n");
}

const COHERENCE_RE =
  /\b(thinking (holds together|is solid|is self-consistent|checks out)|logic (holds|is solid|is self-consistent|checks out)|ready for the next (challenge|question)|reasoning (holds|is solid|is coherent))\b/i;

/** Detect tutor completion cue suggesting the next lab question. */
export function detectLabCoherenceSignal(assistantText: string): boolean {
  const t = String(assistantText || "").trim();
  if (!t) return false;
  return COHERENCE_RE.test(t);
}

export function stashLabChallengeKickoff(k: LabChallengeKickoff): void {
  const payload: LabChallengeKickoff = {
    lab: k.lab,
    title: String(k.title || "").slice(0, 200),
    speaker: String(k.speaker || "Source").slice(0, 120),
    kind: String(k.kind || "critique").slice(0, 32),
    prompt: String(k.prompt || "").slice(0, 2000),
    choices: (k.choices || []).map((c) => String(c).slice(0, 300)).slice(0, 4),
    selected: [...new Set(k.selected || [])]
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4)
      .slice(0, 4),
    essay: String(k.essay || "").trim().slice(0, 4000),
    accountId: k.accountId ? String(k.accountId).slice(0, 64) : undefined,
  };
  writeKey(LAB_CHALLENGE_KICKOFF_KEY, JSON.stringify(payload), kickoffMemory);
}

export function consumeLabChallengeKickoff(): LabChallengeKickoff | null {
  const raw = readKey(LAB_CHALLENGE_KICKOFF_KEY, kickoffMemory);
  clearKey(LAB_CHALLENGE_KICKOFF_KEY, kickoffMemory);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<LabChallengeKickoff>;
    const lab = p.lab;
    if (lab !== "bbc" && lab !== "rsa" && lab !== "natgeo") return null;
    const prompt = String(p.prompt || "").trim();
    const essay = String(p.essay || "").trim();
    if (!prompt || essay.length < 3) return null;
    return {
      lab,
      title: String(p.title || labChallengeLabel(lab)).slice(0, 200),
      speaker: String(p.speaker || "Source").slice(0, 120),
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
      accountId: p.accountId ? String(p.accountId).slice(0, 64) : undefined,
    };
  } catch {
    return null;
  }
}

/** Back to the lab where the challenge started. */
export function labResumeHref(lab: LabDiscussId): string {
  return `/studio?game=${LAB_GAME_PARAM[lab]}`;
}
