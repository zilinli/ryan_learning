/**
 * Interactive fix queue for Writing Studio.
 * Rank BASIS weaknesses by severity, locate spans in the draft,
 * and apply student replies as replacements.
 */

import type { BasisCoachReport, BasisDimensionId } from "./basis-writing";
import { BASIS_DIMENSION_META } from "./basis-writing";

export type RevisionType = "word" | "phrase" | "sentence" | "append";

export type WritingFixIssue = {
  id: string;
  dimension: BasisDimensionId;
  /** Lower = more urgent (derived from BASIS score) */
  severity: number;
  /** Exact substring to replace when possible */
  span: string;
  start: number;
  end: number;
  question: string;
  tip: string;
  placeholder: string;
  /** How to merge the student's answer back into the draft */
  revisionType: RevisionType;
  status: "open" | "fixed" | "skipped";
};

const VAGUE_EN =
  /\b(thing|things|stuff|something|everything|nice|good|bad|amazing|life)\b/gi;
const VAGUE_ZH = /(事情|东西|样子|发生|到处|感觉|很好|不好|生活)/g;

function findAll(draft: string, re: RegExp): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(draft)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) r.lastIndex += 1;
  }
  return out;
}

function firstLineSpan(draft: string): { text: string; start: number; end: number } | null {
  const m = /^(.*)$/m.exec(draft.trimStart());
  if (!m) return null;
  const text = m[1]!.trim();
  if (!text) return null;
  const start = draft.indexOf(text);
  if (start < 0) return null;
  return { text, start, end: start + text.length };
}

function repeatedWordSpans(
  draft: string,
): Array<{ text: string; start: number; end: number; count: number }> {
  const tokens = [...draft.matchAll(/[A-Za-z\u4e00-\u9fff]{2,}/g)];
  const counts = new Map<string, number>();
  for (const t of tokens) {
    const key = t[0]!.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const heavy = [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const spans: Array<{ text: string; start: number; end: number; count: number }> =
    [];
  for (const [word, count] of heavy) {
    const re = new RegExp(
      word.length === 1 || /[\u4e00-\u9fff]/.test(word)
        ? word
        : `\\b${word}\\b`,
      "i",
    );
    const m = re.exec(draft);
    if (m) {
      spans.push({
        text: m[0],
        start: m.index,
        end: m.index + m[0].length,
        count,
      });
    }
  }
  return spans;
}

function dimSeverity(report: BasisCoachReport, id: BasisDimensionId): number {
  const d = report.dimensions.find((x) => x.id === id);
  return d ? d.score : 3;
}

function coachQuestion(
  dim: BasisDimensionId,
  span: string,
  tip: string,
): { question: string; placeholder: string; revisionType: RevisionType } {
  const quoted = span.length > 40 ? `${span.slice(0, 40)}…` : span;
  if (dim === "topic") {
    return {
      question: `Your opening feels fuzzy${quoted ? ` (“${quoted}”)` : ""}. In one concrete sentence: what is this piece mainly about — who, where, what moment?`,
      placeholder: "e.g. After the fight I walked home alone in the rain…",
      revisionType: "sentence",
    };
  }
  if (dim === "detail") {
    return {
      question: tip.includes("camera")
        ? tip
        : `“${quoted || "this line"}” is vague. Replace it with one detail a camera could film (object + action).`,
      placeholder: "e.g. washing dishes at the kitchen sink",
      revisionType: "phrase",
    };
  }
  if (dim === "vocab") {
    return {
      question: `You reuse “${quoted || "this word"}”. Give a sharper word or phrase that only you would use here.`,
      placeholder: "e.g. dashed / diesel smell / cracked screen",
      revisionType: "word",
    };
  }
  return {
    question: `This line needs cleaner grammar or an ending${quoted ? `: “${quoted}”` : ""}. Rewrite it as one complete sentence (end with . ! or ?).`,
    placeholder: "Rewrite the full sentence…",
    revisionType: "sentence",
  };
}

/**
 * Build a severity-ranked fix queue from draft + BASIS report.
 * Cap at 8 issues so the dialogue stays bite-sized.
 */
export function buildWritingFixIssues(
  draft: string,
  report: BasisCoachReport,
  limit = 8,
): WritingFixIssue[] {
  const issues: WritingFixIssue[] = [];
  let seq = 0;
  const push = (
    dimension: BasisDimensionId,
    span: { text: string; start: number; end: number },
    tip: string,
  ) => {
    const severity = dimSeverity(report, dimension);
    if (severity >= 5) return;
    const { question, placeholder, revisionType } = coachQuestion(
      dimension,
      span.text,
      tip,
    );
    issues.push({
      id: `fix_${dimension}_${seq++}_${span.start}`,
      dimension,
      severity,
      span: span.text,
      start: span.start,
      end: span.end,
      question,
      tip,
      placeholder,
      revisionType,
      status: "open",
    });
  };

  const topic = report.dimensions.find((d) => d.id === "topic");
  if (topic && topic.score <= 3) {
    const line = firstLineSpan(draft);
    if (line) push("topic", line, topic.tip);
  }

  const detail = report.dimensions.find((d) => d.id === "detail");
  if (detail && detail.score <= 3) {
    const vague = [
      ...findAll(draft, VAGUE_EN),
      ...findAll(draft, VAGUE_ZH),
    ];
    for (const v of vague.slice(0, 3)) {
      push("detail", v, detail.tip);
    }
    if (vague.length === 0) {
      // Fall back to weakest line without sensory words
      const lines = draft.split(/\n/).filter((l) => l.trim());
      const weak = lines.find(
        (l) =>
          !/\b(smell|rain|light|bus|phone|hear|sound|glass|desk)\b/i.test(l) &&
          !/(雨|光|声|窗|桌)/.test(l),
      );
      if (weak) {
        const start = draft.indexOf(weak);
        if (start >= 0) {
          push(
            "detail",
            { text: weak.trim(), start, end: start + weak.trim().length },
            detail.tip,
          );
        }
      }
    }
  }

  const vocab = report.dimensions.find((d) => d.id === "vocab");
  if (vocab && vocab.score <= 3) {
    for (const r of repeatedWordSpans(draft).slice(0, 2)) {
      push(
        "vocab",
        r,
        `“${r.text}” appears ${r.count}× — swap one for a precise word.`,
      );
    }
  }

  const grammar = report.dimensions.find((d) => d.id === "grammar");
  if (grammar && grammar.score <= 3) {
    if (!/[.!?。！？]/.test(draft)) {
      const line = firstLineSpan(draft);
      if (line) push("grammar", line, grammar.tip);
    } else {
      const starts = draft
        .split(/[.!?\n。！？]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (starts.length >= 2) {
        const firstWord = starts[0]!.split(/\s+/)[0] || starts[0]!.slice(0, 2);
        const same = starts.filter((s) =>
          s.toLowerCase().startsWith(firstWord.toLowerCase()),
        );
        if (same.length >= 2) {
          const t = same[1]!;
          const start = draft.indexOf(t);
          if (start >= 0) {
            push(
              "grammar",
              { text: t, start, end: start + t.length },
              grammar.tip,
            );
          }
        }
      }
    }
  }

  // Deduplicate overlapping spans (keep lower severity / earlier)
  issues.sort((a, b) => a.severity - b.severity || a.start - b.start);
  const kept: WritingFixIssue[] = [];
  for (const issue of issues) {
    const overlap = kept.some(
      (k) => !(issue.end <= k.start || issue.start >= k.end),
    );
    if (!overlap) kept.push(issue);
    if (kept.length >= limit) break;
  }

  // Re-label with friendly dimension names in tip
  return kept.map((issue, i) => ({
    ...issue,
    tip: `${BASIS_DIMENSION_META[issue.dimension].shortLabel}: ${issue.tip}`,
    id: `fix_${i}_${issue.dimension}_${issue.start}`,
  }));
}

const isWordChar = (c: string): boolean => /[\w\u00c0-\u024f\u4e00-\u9fff]/.test(c);

/** Max context characters shown around a change in revision previews. */
export const REVISION_PREVIEW_CTX = 56;

/**
 * Split two strings into a common head, changed middles, and common tail —
 * the three parts a Before/After revision preview renders.
 */
export function revisionDiff(
  before: string,
  after: string,
): { head: string; beforeMid: string; afterMid: string; tail: string } {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) i++;
  let j = 0;
  while (
    j < before.length - i &&
    j < after.length - i &&
    before[before.length - 1 - j] === after[after.length - 1 - j]
  ) {
    j++;
  }
  return {
    head: before.slice(0, i),
    beforeMid: before.slice(i, before.length - j),
    afterMid: after.slice(i, after.length - j),
    tail: before.slice(before.length - j),
  };
}

/** Trim a context fragment to a readable length with an ellipsis. */
export function clipRevisionContext(s: string): string {
  if (s.length <= REVISION_PREVIEW_CTX) return s;
  const half = Math.floor(REVISION_PREVIEW_CTX / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

function locateSpan(
  draft: string,
  issue: WritingFixIssue,
): { start: number; end: number } | null {
  if (
    issue.start >= 0 &&
    issue.end <= draft.length &&
    draft.slice(issue.start, issue.end) === issue.span
  ) {
    return { start: issue.start, end: issue.end };
  }
  if (issue.span && draft.includes(issue.span)) {
    const start = draft.indexOf(issue.span);
    return { start, end: start + issue.span.length };
  }
  return null;
}

function appendLine(draft: string, reply: string): string {
  return draft.trimEnd() ? `${draft.trimEnd()}\n${reply}` : reply;
}

function dropDuplicatePunctuation(reply: string, after: string): { after: string } {
  const last = reply[reply.length - 1];
  if (last && /[.,!?;。！？；]/.test(last) && after[0] === last) {
    return { after: after.slice(1) };
  }
  return { after };
}

function spliceInline(
  draft: string,
  start: number,
  end: number,
  reply: string,
): string {
  const before = draft.slice(0, start);
  const after = draft.slice(end);
  const beforeChar = before[before.length - 1] ?? "";
  const afterChar = after[0] ?? "";
  // Keep a single space when we are joining two word characters, so a
  // multi-word answer inserted mid-sentence reads naturally.
  let left = "";
  if (isWordChar(beforeChar)) left = " ";
  let right = "";
  if (isWordChar(afterChar)) right = " ";
  const { after: afterFixed } = dropDuplicatePunctuation(reply, after);
  return `${before}${left}${reply}${right}${afterFixed}`;
}

function spliceSentence(
  draft: string,
  start: number,
  end: number,
  reply: string,
): string {
  const before = draft.slice(0, start);
  const after = draft.slice(end);
  let text = reply;
  if (!/[.!?。！？]$/.test(text)) text = `${text}.`;
  let right = "";
  const afterChar = after[0] ?? "";
  if (afterChar && afterChar !== "\n" && isWordChar(afterChar)) right = " ";
  const { after: afterFixed } = dropDuplicatePunctuation(text, after);
  return `${before}${text}${right}${afterFixed}`;
}

/**
 * Merge the student's answer into the draft according to the issue's
 * revisionType. Returns the full resulting draft so the UI can preview it
 * before applying. When the span cannot be located the answer is appended
 * as a new line instead of being lost.
 */
export function mergeRevision(
  draft: string,
  issue: WritingFixIssue,
  answer: string,
): string {
  const reply = answer.trim().replace(/\s+/g, " ");
  if (!reply) return draft;

  if (issue.revisionType === "append") {
    return appendLine(draft, reply);
  }
  const loc = locateSpan(draft, issue);
  if (!loc) return appendLine(draft, reply);

  if (issue.revisionType === "sentence") {
    return spliceSentence(draft, loc.start, loc.end, reply);
  }
  // word / phrase
  return spliceInline(draft, loc.start, loc.end, reply);
}

/** Apply student reply: replace the issue span (or append if span missing). */
export function applyWritingFix(
  draft: string,
  issue: WritingFixIssue,
  studentReply: string,
): string {
  return mergeRevision(draft, issue, studentReply);
}

export function remainingFixCount(issues: WritingFixIssue[]): number {
  return issues.filter((i) => i.status === "open").length;
}

export function nextOpenFix(
  issues: WritingFixIssue[],
): WritingFixIssue | null {
  return issues.find((i) => i.status === "open") || null;
}

/** Build highlight ranges for open issues (for pad markup). */
export function openFixRanges(
  issues: WritingFixIssue[],
): Array<{ start: number; end: number; id: string; dimension: BasisDimensionId }> {
  return issues
    .filter((i) => i.status === "open" && i.end > i.start)
    .map((i) => ({
      start: i.start,
      end: i.end,
      id: i.id,
      dimension: i.dimension,
    }))
    .sort((a, b) => a.start - b.start);
}
