/**
 * Shared Socratic discuss for BBC / RSA / NatGeo Labs (TED parity).
 */

import {
  formatSelectedChoiceSummary,
  type TedChallengeKickoff,
} from "./ted-challenge-handoff";

export type LabDiscussId = "bbc" | "rsa" | "natgeo";

export type LabDiscussContext = Pick<
  TedChallengeKickoff,
  | "talkTitle"
  | "speaker"
  | "kind"
  | "prompt"
  | "choices"
  | "selected"
  | "essay"
>;

export type LabDiscussTurn = {
  role: "coach" | "you";
  text: string;
};

const LAB_LABEL: Record<LabDiscussId, string> = {
  bbc: "BBC Doc Lab",
  rsa: "RSA Lab",
  natgeo: "NatGeo Lab",
};

const LAB_NEXT: Record<LabDiscussId, string> = {
  bbc: "BBC challenge question",
  rsa: "RSA challenge question",
  natgeo: "NatGeo challenge question",
};

export function labDiscussLabel(lab: LabDiscussId): string {
  return LAB_LABEL[lab];
}

export function labDiscussNextNoun(lab: LabDiscussId): string {
  return LAB_NEXT[lab];
}

export function parseLabDiscussId(raw: unknown): LabDiscussId | null {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "bbc" || s === "rsa" || s === "natgeo") return s;
  return null;
}

export function contextFromLabKickoff(
  k: Pick<
    TedChallengeKickoff,
    | "talkTitle"
    | "speaker"
    | "kind"
    | "prompt"
    | "choices"
    | "selected"
    | "essay"
  >,
): LabDiscussContext {
  return {
    talkTitle: String(k.talkTitle || "").slice(0, 200),
    speaker: String(k.speaker || "Source").slice(0, 120),
    kind: String(k.kind || "critique").slice(0, 32),
    prompt: String(k.prompt || "").slice(0, 2000),
    choices: (k.choices || []).map((c) => String(c).slice(0, 300)).slice(0, 4),
    selected: [...new Set(k.selected || [])]
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4)
      .slice(0, 4),
    essay: String(k.essay || "").trim().slice(0, 4000),
  };
}

export function discussOpenAgentPrompt(
  lab: LabDiscussId,
  ctx: LabDiscussContext,
): string {
  const choiceLine = formatSelectedChoiceSummary(ctx.choices, ctx.selected);
  const label = LAB_LABEL[lab];
  const next = LAB_NEXT[lab];
  return [
    `You are Spark — a warm AI teacher in ${label}.`,
    "The student just submitted an answer. Stay Socratic: ask ONE sharp question.",
    "Do NOT reveal which option letter is 'correct'. Do NOT jump topics.",
    "Max 80 words. Match the student's language (EN/ZH/etc.).",
    "When later their reasoning holds together, say clearly that their thinking is solid",
    `and that they are ready for the next ${next}.`,
    "",
    `Title: \"${ctx.talkTitle}\" · ${ctx.speaker}`,
    `Prompt (${ctx.kind}): ${ctx.prompt}`,
    `Selection: ${choiceLine}`,
    `Essay: ${ctx.essay}`,
    "",
    "Open the discussion now (first coach turn only — no JSON).",
  ].join("\n");
}

export function discussReplyAgentPrompt(
  lab: LabDiscussId,
  ctx: LabDiscussContext,
  history: LabDiscussTurn[],
  studentReply: string,
): string {
  const hist = history
    .slice(-8)
    .map((t) => `${t.role === "you" ? "Student" : "Spark"}: ${t.text}`)
    .join("\n");
  const next = LAB_NEXT[lab];
  return [
    `You are Spark — continue the ${LAB_LABEL[lab]} Socratic discussion on the Lab page.`,
    "Ask at most ONE question. No spoilers of correct letters. Max 90 words.",
    "If claims + evidence + logic align, say their thinking holds together / is solid",
    `and suggest they are ready for the next ${next}.`,
    "",
    `Title: \"${ctx.talkTitle}\" · Prompt: ${ctx.prompt}`,
    `Selection: ${formatSelectedChoiceSummary(ctx.choices, ctx.selected)}`,
    `Essay: ${ctx.essay}`,
    "",
    "Recent turns:",
    hist || "(none)",
    "",
    `Student just said: ${studentReply}`,
    "",
    "Reply as Spark only (plain text).",
  ].join("\n");
}

export function buildLabDiscussOpenerLocal(
  lab: LabDiscussId,
  ctx: LabDiscussContext,
): string {
  const essay = ctx.essay.trim();
  const snippet = essay.length > 80 ? `${essay.slice(0, 77).trim()}…` : essay;
  const picked = formatSelectedChoiceSummary(ctx.choices, ctx.selected);
  const hasPick = ctx.selected.length > 0;
  const label = LAB_LABEL[lab];
  if (hasPick) {
    return [
      `Thanks — I can see your ${label} essay next to the prompt: “${snippet}”`,
      `You leaned on: ${picked}.`,
      "What is the strongest piece of evidence from what you watched or read that makes that choice hold?",
    ].join("\n\n");
  }
  return [
    `Thanks — your ${label} view is on the page: “${snippet}”`,
    "You skipped the listed options. Which claim are you pushing back on most — and why?",
  ].join("\n\n");
}

export function buildLabDiscussReplyLocal(
  lab: LabDiscussId,
  ctx: LabDiscussContext,
  studentReply: string,
): string {
  const r = studentReply.trim().toLowerCase();
  const next = LAB_NEXT[lab];
  const affirming =
    /\b(yes|yeah|exactly|agreed|makes sense|holds|because|所以|对|是的|同意)\b/i.test(
      studentReply,
    ) && studentReply.trim().length > 24;
  if (
    affirming &&
    /because|所以|因为|evidence|trade-?off|however|但/i.test(studentReply)
  ) {
    return [
      "Your thinking holds together — claims, reasons, and the source line up.",
      `You are ready for the next ${next} when you want.`,
      "Want one more sharpening question first, or shall we move on?",
    ].join(" ");
  }
  if (r.length < 8) {
    return "Say a bit more — what detail from the video or text supports that?";
  }
  const promptBit =
    ctx.prompt.length > 60 ? ctx.prompt.slice(0, 60) + "..." : ctx.prompt;
  return [
    "Good — hold that thought against the prompt.",
    'If someone chose the opposite of your view on "' + promptBit + '",',
    "what would you ask them to notice in the source?",
  ].join(" ");
}
