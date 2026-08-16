/**
 * Spark-style Socratic mentor turns for Writing Studio.
 * Praise → one question → wait; never dump a rewrite.
 */

import type { BasisCoachReport, BasisDimensionId } from "./basis-writing";
import { BASIS_DIMENSION_META } from "./basis-writing";

export type MentorChatTurn = {
  role: "coach" | "you";
  text: string;
};

/** Optional structured edit a mentor turn can produce, anchored to a spot issue. */
export type MentorEdit = {
  spanId: string;
  replacement: string;
};

export type MentorOpener = {
  text: string;
  focusId: BasisDimensionId;
  question: string;
};

function quoteSnippet(draft: string, max = 48): string {
  const line =
    draft
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 8) || draft.trim();
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function strongestDim(report: BasisCoachReport) {
  return [...report.dimensions].sort((a, b) => b.score - a.score)[0]!;
}

function focusDim(report: BasisCoachReport): BasisDimensionId {
  return report.focusIds[0] || strongestDim(report).id;
}

/** Specific praise for ONE thing — Spark writing Think-first step 1. */
export function buildMentorPraise(
  report: BasisCoachReport,
  draft: string,
): string {
  const strong = strongestDim(report);
  const ev = (strong.evidence || "").trim();
  if (ev) {
    const q = ev.length > 56 ? `${ev.slice(0, 56)}…` : ev;
    return `I like “${q}” — that already sounds like you.`;
  }
  if (strong.score >= 4) {
    return `Your ${strong.shortLabel.toLowerCase()} is already working — keep that thread.`;
  }
  const snip = quoteSnippet(draft);
  if (snip) {
    return `Nice — you got words down (“${snip}”). Let's think one step sharper.`;
  }
  return "Nice start — you showed up on the page. Let's think one step sharper.";
}

export function buildMentorOpener(
  report: BasisCoachReport,
  draft: string,
): MentorOpener {
  const focusId = focusDim(report);
  const question =
    report.questions[0]?.trim() ||
    defaultQuestion(focusId, draft);
  const praise = buildMentorPraise(report, draft);
  // One praise + one question only — stop and wait (Spark default move)
  const text = `${praise}\n\n${question}`;
  return { text, focusId, question };
}

/** Opener when we only have free-text coach tips (image/video). */
export function buildMentorOpenerFromText(
  coachText: string,
  draft: string,
): MentorOpener {
  const snip = quoteSnippet(draft);
  const praise = snip
    ? `Nice — you've sketched something (“${snip}”).`
    : "Nice — you've started a scene.";
  const lines = coachText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const questionLine =
    lines.find((l) => /\?/.test(l)) ||
    lines[0] ||
    "What is the one moment a camera should catch first?";
  const question = questionLine.replace(/^[-•]\s*/, "").slice(0, 280);
  return {
    text: `${praise}\n\n${question}`,
    focusId: "detail",
    question,
  };
}

function defaultQuestion(focusId: BasisDimensionId, draft: string): string {
  const snip = quoteSnippet(draft, 36);
  if (focusId === "topic") {
    return snip
      ? `In one concrete sentence: what is “${snip}” actually about — who, where, what moment?`
      : "In one concrete sentence: who, where, and what moment is this piece about?";
  }
  if (focusId === "detail") {
    return "If a camera could film only one object from your draft, what would it be — and what is it doing?";
  }
  if (focusId === "vocab") {
    return "If you cut every 'thing' / 'stuff' / 'nice', what word is left that only you would use?";
  }
  return "Which line can end with a question the next line could answer?";
}

/** Offline / LLM-fallback reply: acknowledge → one next ask. */
export function localMentorReply(
  studentText: string,
  report: BasisCoachReport | null,
  draft: string,
): string {
  const reply = studentText.trim();
  const focusId = report ? focusDim(report) : ("detail" as BasisDimensionId);
  const label = BASIS_DIMENSION_META[focusId].shortLabel.toLowerCase();
  const their =
    reply.length > 60 ? `${reply.slice(0, 60)}…` : reply || "that";

  const followUps: Record<BasisDimensionId, string> = {
    topic: `Good — hold onto “${their}”. Now: what feeling belongs to that moment, in one word?`,
    detail: `I can almost see “${their}”. What sound or smell sits next to it?`,
    vocab: `“${their}” is sharper. Can you swap one more filler word nearby for something only you'd say?`,
    grammar: `Clearer. Read that line aloud once — where do you want to pause or end it?`,
  };

  if (reply.length < 3) {
    return `No rush — try a short guess about ${label}. Even half a sentence helps.`;
  }
  if (/^(i don't know|idk|不知道|不会|没想法)/i.test(reply)) {
    return `That's ok. Shrink it: pick A or B — is this more about before the moment, or after? Then tell me which.`;
  }
  return followUps[focusId];
}

export function mentorTurnAgentPrompt(params: {
  draft: string;
  genre: string;
  target: string;
  focusIds: BasisDimensionId[];
  history: MentorChatTurn[];
  studentReply: string;
  craftTip?: string;
  openIssues?: Array<{ id: string; span: string; dimension: string }>;
  askedFocusIds?: string[];
}): string {
  const focus =
    params.focusIds.map((id) => BASIS_DIMENSION_META[id].label).join(", ") ||
    "detail support";
  const hist = params.history
    .slice(-8)
    .map((t) => `${t.role === "coach" ? "Coach" : "Student"}: ${t.text}`)
    .join("\n");
  const asked = params.askedFocusIds?.length
    ? params.askedFocusIds.join(", ")
    : "none yet";
  const issuesLine = params.openIssues?.length
    ? [
        "",
        "Open spot issues (spanId → span):",
        ...params.openIssues.map(
          (i) => `- ${i.id}: “${i.span}” (${i.dimension})`,
        ),
      ].join("\n")
    : "";
  const editSchema = JSON.stringify({
    reply: "2–4 sentences, ends with a short closing line",
    edit: {
      spanId: "issue id from the list",
      replacement: "the student's words, lightly tidied — never invent content",
    },
  });
  const askSchema = JSON.stringify({
    reply: "2–4 sentences ending with exactly one clear question",
  });

  return [
    "You are Spark — a calm, patient writing tutor for an international-school student.",
    "Mirror homepage Think-first coaching for writing drafts:",
    "1) Specific praise for ONE thing in THEIR reply first (use their words);",
    "2) ONE clarifying question about feelings, detail, or clarity;",
    "3) At most ONE tiny craft nudge using THEIR words — never rewrite their sentence for them.",
    "Converge every turn into ONE of two shapes:",
    "  A) another sharp question — ONLY if the student has NOT yet produced a concrete revision;",
    "  B) a concrete edit action built from THEIR words — when their reply already says what to write.",
    "Never repeat a question the student already answered.",
    `Already discussed focus areas: ${asked}. Do NOT re-ask those.`,
    "When you return an edit (shape B), output ONLY JSON (no markdown fences):",
    editSchema,
    "Otherwise output ONLY JSON (no markdown fences):",
    askSchema,
    "The edit.replacement must use the student's own words — light tidying only.",
    issuesLine,
    `Stage target: ${params.target}. Genre vibe: ${params.genre}.`,
    `Current focus: ${focus}.`,
    params.craftTip
      ? `Optional craft nudge in pocket (use lightly): ${params.craftTip}`
      : "",
    "",
    "Current draft:",
    params.draft.slice(0, 3500),
    "",
    "Conversation so far:",
    hist || "(opening)",
    "",
    "Student just said:",
    params.studentReply.slice(0, 1200),
    "",
    "Reply as Coach only (JSON, no markdown).",
  ]
    .filter(Boolean)
    .join("\n");
}
