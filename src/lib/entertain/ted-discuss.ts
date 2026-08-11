/**
 * TED Challenge inline discuss — Socratic Q&A without leaving Lab.
 */

import {
  buildTedChallengeKickoffMessage,
  formatSelectedChoiceSummary,
  type TedChallengeKickoff,
} from "./ted-challenge-handoff";

export type TedDiscussContext = Pick<
  TedChallengeKickoff,
  | "talkTitle"
  | "speaker"
  | "kind"
  | "prompt"
  | "choices"
  | "selected"
  | "essay"
>;

export type TedDiscussTurn = {
  role: "coach" | "you";
  text: string;
};

export function contextFromKickoff(
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
): TedDiscussContext {
  return {
    talkTitle: String(k.talkTitle || "").slice(0, 200),
    speaker: String(k.speaker || "Speaker").slice(0, 120),
    kind: String(k.kind || "critique").slice(0, 32),
    prompt: String(k.prompt || "").slice(0, 2000),
    choices: (k.choices || []).map((c) => String(c).slice(0, 300)).slice(0, 4),
    selected: [...new Set(k.selected || [])]
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4)
      .slice(0, 4),
    essay: String(k.essay || "").trim().slice(0, 4000),
  };
}

/** Full kickoff-shaped message for agent system context. */
export function buildTedDiscussSeedMessage(ctx: TedDiscussContext): string {
  return buildTedChallengeKickoffMessage({
    talkSlug: "inline",
    talkTitle: ctx.talkTitle,
    speaker: ctx.speaker,
    itemId: "inline",
    kind: ctx.kind,
    prompt: ctx.prompt,
    choices: ctx.choices,
    selected: ctx.selected,
    essay: ctx.essay,
    qi: 0,
    nextQi: 1,
  });
}

export function discussOpenAgentPrompt(ctx: TedDiscussContext): string {
  const choiceLine = formatSelectedChoiceSummary(ctx.choices, ctx.selected);
  return [
    "You are Spark — a warm AI teacher in TED Challenge Lab.",
    "The student just submitted an answer. Stay Socratic: ask ONE sharp question.",
    "Do NOT reveal which option letter is 'correct'. Do NOT jump topics.",
    "Max 80 words. Match the student's language (EN/ZH/etc.).",
    "When later their reasoning holds together, say clearly that their thinking is solid",
    "and that they are ready for the next TED Challenge question.",
    "",
    `Talk: \"${ctx.talkTitle}\" by ${ctx.speaker}`,
    `Prompt (${ctx.kind}): ${ctx.prompt}`,
    `Selection: ${choiceLine}`,
    `Essay: ${ctx.essay}`,
    "",
    "Open the discussion now (first coach turn only — no JSON).",
  ].join("\n");
}

export function discussReplyAgentPrompt(
  ctx: TedDiscussContext,
  history: TedDiscussTurn[],
  studentReply: string,
): string {
  const hist = history
    .slice(-8)
    .map((t) => `${t.role === "you" ? "Student" : "Spark"}: ${t.text}`)
    .join("\n");
  return [
    "You are Spark — continue the TED Challenge Socratic discussion on the Lab page.",
    "Ask at most ONE question. No spoilers of correct letters. Max 90 words.",
    "If claims + evidence + logic align, say their thinking holds together / is solid",
    "and suggest they are ready for the next TED Challenge question.",
    "",
    `Talk: \"${ctx.talkTitle}\" · Prompt: ${ctx.prompt}`,
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

/** Local opener when agent unavailable. */
export function buildTedDiscussOpenerLocal(ctx: TedDiscussContext): string {
  const essay = ctx.essay.trim();
  const snippet = essay.length > 80 ? `${essay.slice(0, 77).trim()}…` : essay;
  const picked = formatSelectedChoiceSummary(ctx.choices, ctx.selected);
  const hasPick = ctx.selected.length > 0;
  if (hasPick) {
    return [
      `Thanks — I can see your essay next to the prompt: “${snippet}”`,
      `You leaned on: ${picked}.`,
      "What is the strongest piece of evidence from the talk that makes that choice hold?",
    ].join("\n\n");
  }
  return [
    `Thanks — your view is on the page: “${snippet}”`,
    "You skipped the listed options. Which claim in the talk are you pushing back on most — and why?",
  ].join("\n\n");
}

/** Local follow-up when agent unavailable. */
export function buildTedDiscussReplyLocal(
  ctx: TedDiscussContext,
  studentReply: string,
): string {
  const r = studentReply.trim().toLowerCase();
  const affirming =
    /\b(yes|yeah|exactly|agreed|makes sense|holds|because|所以|对|是的|同意)\b/i.test(
      studentReply,
    ) && studentReply.trim().length > 24;
  if (affirming && /because|所以|因为|evidence|trade-?off|however|但/i.test(studentReply)) {
    return [
      "Your thinking holds together — claims, reasons, and the talk line up.",
      "You are ready for the next TED Challenge question when you want.",
      "Want one more sharpening question first, or shall we move on?",
    ].join(" ");
  }
  if (r.length < 8) {
    return "Say a bit more — what part of the talk supports that in one concrete detail?";
  }
  const promptBit =
    ctx.prompt.length > 60 ? ctx.prompt.slice(0, 60) + "..." : ctx.prompt;
  return [
    "Good — hold that thought against the prompt.",
    'If someone chose the opposite of your view on "' + promptBit + '",',
    "what would you ask them to notice in the talk?",
  ].join(" ");
}
