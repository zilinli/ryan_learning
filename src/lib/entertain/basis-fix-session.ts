/**
 * Interactive fix queue for Writing Studio.
 * Rank BASIS weaknesses by severity, locate spans in the draft,
 * and apply student replies as replacements.
 */

import type { BasisCoachReport, BasisDimensionId } from "./basis-writing";
import { BASIS_DIMENSION_META } from "./basis-writing";

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
): { question: string; placeholder: string } {
  const quoted = span.length > 40 ? `${span.slice(0, 40)}…` : span;
  if (dim === "topic") {
    return {
      question: `Your opening feels fuzzy${quoted ? ` (“${quoted}”)` : ""}. In one concrete sentence: what is this piece mainly about — who, where, what moment?`,
      placeholder: "e.g. After the fight I walked home alone in the rain…",
    };
  }
  if (dim === "detail") {
    return {
      question: tip.includes("camera")
        ? tip
        : `“${quoted || "this line"}” is vague. Replace it with one detail a camera could film (object + action).`,
      placeholder: "e.g. washing dishes at the kitchen sink",
    };
  }
  if (dim === "vocab") {
    return {
      question: `You reuse “${quoted || "this word"}”. Give a sharper word or phrase that only you would use here.`,
      placeholder: "e.g. dashed / diesel smell / cracked screen",
    };
  }
  return {
    question: `This line needs cleaner grammar or an ending${quoted ? `: “${quoted}”` : ""}. Rewrite it as one complete sentence (end with . ! or ?).`,
    placeholder: "Rewrite the full sentence…",
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
    const { question, placeholder } = coachQuestion(dimension, span.text, tip);
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

/** Apply student reply: replace the issue span (or append if span missing). */
export function applyWritingFix(
  draft: string,
  issue: WritingFixIssue,
  studentReply: string,
): string {
  const reply = studentReply.trim().replace(/\s+/g, " ");
  if (!reply) return draft;

  // Prefer exact index if still matches
  if (
    issue.start >= 0 &&
    issue.end <= draft.length &&
    draft.slice(issue.start, issue.end) === issue.span
  ) {
    return `${draft.slice(0, issue.start)}${reply}${draft.slice(issue.end)}`;
  }

  // Fallback: first occurrence of span
  if (issue.span && draft.includes(issue.span)) {
    return draft.replace(issue.span, reply);
  }

  // Last resort: append as a new line
  return draft.trimEnd() ? `${draft.trimEnd()}\n${reply}` : reply;
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
