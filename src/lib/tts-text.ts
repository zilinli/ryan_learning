/** Prepare tutor replies for natural neural TTS playback. */

const CJK_CHAR = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CJK_OR_PUNCT = /[\u4e00-\u9fff\u3400-\u4dbf。！？，、；：""''（）【】]/;

function isMostlyCjk(text: string): boolean {
  const han = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  return han >= 4 && han >= letters;
}

/** Join speech fragments without inserting awkward gaps between Chinese chars. */
export function joinSpeechParts(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  if (!left) return right;
  if (!right) return left;
  const leftEnd = left[left.length - 1]!;
  const rightStart = right[0]!;
  // No space between CJK / CJK punctuation
  if (CJK_OR_PUNCT.test(leftEnd) && CJK_OR_PUNCT.test(rightStart)) {
    return left + right;
  }
  // Already has whitespace at the boundary
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right;
  return `${left} ${right}`;
}

/** True if a chunk is mostly URI / SVG encoding soup (never speak). */
function isEncodedJunk(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const pct = (t.match(/%[0-9A-Fa-f]{2}/g) || []).length;
  if (pct >= 6) return true;
  if (/data:image\/svg\+xml/i.test(t)) return true;
  if (/%3C\s*\/?\s*svg/i.test(t)) return true;
  if (/xmlns%3D|viewBox%3D|stroke-width%3D|font-family%3D/i.test(t)) return true;
  return false;
}

export function cleanTutorSpeechText(text: string): string {
  let t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return "";

  // Never speak diagrams / SVG / mermaid payloads
  t = t.replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/gi, " ");
  t = t.replace(/!\[[^\]]*\]\(data:image\/[\s\S]*$/gi, " ");
  t = t.replace(/```(?:svg|mermaid|xml)?\s*[\s\S]*?```/gi, " ");
  t = t.replace(/\bsvg\s*(<svg\b[\s\S]*?<\/svg>)/gi, " ");
  t = t.replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");
  t = t.replace(/\bsvg\s*<svg\b[\s\S]*$/gi, " ");
  t = t.replace(/<svg\b[\s\S]*$/gi, " ");
  t = t.replace(/```(?:svg|xml|mermaid)?\s*[\s\S]*$/gi, " ");
  t = t.replace(/data:image\/svg\+xml,[^\s)]*/gi, " ");
  // Percent-encoded SVG leftovers from mid-URI soft-breaks
  t = t.replace(/(?:%[0-9A-Fa-f]{2}){4,}/g, " ");
  t = t.replace(
    /\b(?:xmlns|viewBox|polygon|polyline|stroke-width|font-size|text-anchor|dominant-baseline|aria-label|fill-opacity)\b[^\s]*/gi,
    " ",
  );

  if (isEncodedJunk(t)) return "";

  // Strip remaining fenced / inline code and links
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  t = t.replace(/!\[[^\]]*\]\([^)]*$/g, " ");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // LaTeX → rough spoken form
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr: string) => latexToSpeech(expr));
  t = t.replace(/\$([^$\n]+)\$/g, (_, expr: string) => latexToSpeech(expr));
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr: string) => latexToSpeech(expr));
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr: string) => latexToSpeech(expr));
  // Markdown chrome
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^\s*>\s?/gm, "");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/^\s*\d+\.\s+/gm, "");
  t = t.replace(/[*_~]+/g, "");

  if (isMostlyCjk(t)) {
    t = t.replace(/\n{2,}/g, "。");
    t = t.replace(/\n/g, "");
  } else {
    t = t.replace(/\n{2,}/g, ". ");
    t = t.replace(/\n/g, " ");
  }

  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(
    /([\u4e00-\u9fff\u3400-\u4dbf])\s+(?=[\u4e00-\u9fff\u3400-\u4dbf])/g,
    "$1",
  );
  t = t.replace(/\s*([。！？，、；：])\s*/g, "$1");
  t = t.replace(/([.!?])([A-Za-z])/g, "$1 $2");
  t = t.replace(/\s{2,}/g, " ").trim();

  if (isEncodedJunk(t)) return "";
  return t;
}

/** Best-effort LaTeX → short English for TTS (not a full math reader). */
function latexToSpeech(raw: string): string {
  let e = raw.trim();
  e = e.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 over $2");
  e = e.replace(/\\sqrt\{([^{}]+)\}/g, "square root of $1");
  e = e.replace(/\\sqrt/g, "square root ");
  e = e.replace(/\\pm/g, " plus or minus ");
  e = e.replace(/\\times/g, " times ");
  e = e.replace(/\\div/g, " divided by ");
  e = e.replace(/\\cdot/g, " times ");
  e = e.replace(/\\leq/g, " less than or equal to ");
  e = e.replace(/\\geq/g, " greater than or equal to ");
  e = e.replace(/\\neq/g, " not equal to ");
  e = e.replace(/\\angle/g, " angle ");
  e = e.replace(/\\triangle/g, " triangle ");
  e = e.replace(/\\degree|\\circ/g, " degrees ");
  e = e.replace(/\\left|\\right/g, "");
  e = e.replace(/\\,/g, " ");
  e = e.replace(/\\;/g, " ");
  // x^{2} / x^2 → x squared (common G4 forms)
  e = e.replace(/([A-Za-z0-9])\^\{?2\}?/g, "$1 squared");
  e = e.replace(/([A-Za-z0-9])\^\{?3\}?/g, "$1 cubed");
  e = e.replace(/([A-Za-z0-9])_\{?([A-Za-z0-9]+)\}?/g, "$1 sub $2");
  e = e.replace(/\\[a-zA-Z]+/g, " ");
  e = e.replace(/[{}^_]/g, " ");
  e = e.replace(/\s+/g, " ").trim();
  return e ? ` ${e} ` : " ";
}

/** Split into phrases so synthesis stays fast without choppy mid-phrase gaps. */
export function chunkForNeuralTts(text: string, maxLen = 280): string[] {
  const cleaned = cleanTutorSpeechText(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?。！？])\s*/).filter(Boolean);
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (!buf) {
      buf = s;
      continue;
    }
    const merged = joinSpeechParts(buf, s);
    if (merged.length <= maxLen) {
      buf = merged;
    } else {
      parts.push(buf);
      buf = s;
    }
  }
  if (buf) parts.push(buf);

  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= maxLen) {
      out.push(p);
      continue;
    }
    let rest = p;
    while (rest.length > maxLen) {
      const windowEnd = Math.min(rest.length, maxLen);
      let soft = findSoftBreak(rest, rest, Math.floor(maxLen * 0.45), windowEnd);
      if (soft < 0) soft = maxLen;
      out.push(rest.slice(0, soft).trim());
      rest = rest.slice(soft).trim();
    }
    if (rest) out.push(rest);
  }
  return out.filter((x) => x.length >= 2);
}

/**
 * Soft-break only at positions that are real in `raw` (not blanked diagram masks).
 * `masked` must be same length as `raw`.
 */
function findSoftBreak(
  raw: string,
  masked: string,
  minIdx: number,
  maxIdx: number,
): number {
  const real = (i: number) => masked[i] === raw[i];
  const strong = "。！？.!?;；";
  const medium = "，、,";
  for (let i = maxIdx - 1; i >= minIdx; i -= 1) {
    if (real(i) && strong.includes(raw[i]!)) return i + 1;
  }
  for (let i = maxIdx - 1; i >= minIdx; i -= 1) {
    if (real(i) && medium.includes(raw[i]!)) return i + 1;
  }
  for (let i = maxIdx - 1; i >= minIdx; i -= 1) {
    if (
      real(i) &&
      raw[i] === " " &&
      !CJK_CHAR.test(raw[i + 1] ?? "")
    ) {
      return i + 1;
    }
  }
  return -1;
}

/** Same-length mask so speech split indices stay aligned with the raw buffer. */
function maskCompleteDiagrams(text: string): string {
  let t = text;
  const blank = (m: string) => " ".repeat(m.length);
  t = t.replace(/!\[[^\]]*\]\(data:image\/[^)]*\)/gi, blank);
  t = t.replace(/```(?:svg|mermaid|xml)?\s*[\s\S]*?```/gi, blank);
  t = t.replace(/\bsvg\s*<svg\b[\s\S]*?<\/svg>/gi, blank);
  t = t.replace(/<svg\b[\s\S]*?<\/svg>/gi, blank);
  return t;
}

/** Index where an incomplete diagram / data-URI begins, or -1. */
function incompleteDiagramStart(buf: string): number {
  const candidates: number[] = [];

  // Incomplete markdown image: ![…](data:image… without closing )
  for (const m of buf.matchAll(/!\[[^\]]*\]\(data:image\//gi)) {
    if (m.index === undefined) continue;
    const after = buf.slice(m.index);
    if (!/^!\[[^\]]*\]\(data:image\/[^)]*\)/i.test(after)) {
      candidates.push(m.index);
    }
  }

  // Incomplete fenced diagram
  for (const m of buf.matchAll(/```(?:svg|xml|mermaid)?[^\n]*\n?/gi)) {
    if (m.index === undefined) continue;
    const after = buf.slice(m.index + m[0].length);
    if (!after.includes("```")) candidates.push(m.index);
  }

  // Incomplete bare SVG
  for (const m of buf.matchAll(/(?:^|[\s\n])(?:svg\s*)?<svg\b/gi)) {
    if (m.index === undefined) continue;
    const from = m[0].startsWith("<") || m[0].startsWith("s")
      ? m.index
      : m.index + 1;
    const after = buf.slice(from);
    if (!/<\/svg>/i.test(after)) {
      const local = after.search(/svg\s*<svg\b|<svg\b/i);
      candidates.push(from + (local >= 0 ? local : 0));
    }
  }

  // Mid-URI leftovers already in buffer (no ![ prefix) — hold from first %3Csvg / data:image
  const mid = buf.search(/data:image\/svg\+xml,%3C|%3Csvg\b/i);
  if (mid >= 0) {
    // If this isn't part of a complete markdown image earlier, hold it
    const before = buf.slice(0, mid);
    const openImg = before.lastIndexOf("![");
    if (openImg < 0 || !/!\[[^\]]*\]\(data:image\/[^)]*$/i.test(buf.slice(openImg))) {
      // Check complete image containing this point
      let covered = false;
      for (const m of buf.matchAll(/!\[[^\]]*\]\(data:image\/[^)]*\)/gi)) {
        if (m.index === undefined) continue;
        if (m.index <= mid && m.index + m[0].length > mid) {
          covered = true;
          break;
        }
      }
      if (!covered) candidates.push(mid);
    }
  }

  if (!candidates.length) return -1;
  return Math.min(...candidates);
}

/**
 * Pull speakable phrases from a live streaming buffer.
 * Prefers full sentences; soft-breaks only when the buffer grows long.
 * Never speaks SVG / data-URI diagram payloads (complete or partial).
 */
export function pullSpeakableFromBuffer(
  buffer: string,
  opts: { force?: boolean; minChars?: number; maxWaitChars?: number } = {},
): { ready: string[]; rest: string } {
  const minChars = opts.minChars ?? 28;
  const maxWaitChars = opts.maxWaitChars ?? 160;
  let buf = buffer.replace(/\r\n/g, "\n");
  const ready: string[] = [];

  // Keep incomplete diagram tails out of sentence splitting.
  let held = "";
  if (!opts.force) {
    const cut = incompleteDiagramStart(buf);
    if (cut >= 0) {
      held = buf.slice(cut);
      buf = buf.slice(0, cut);
    }
  }

  const take = (end: number) => {
    const raw = buf.slice(0, end);
    buf = buf.slice(end).replace(/^\s+/, "");
    const cleaned = cleanTutorSpeechText(raw);
    if (cleaned.length >= 2) ready.push(cleaned);
  };

  while (true) {
    const liveMask = maskCompleteDiagrams(buf);
    const mm = liveMask.match(/[.!?。！？](?:["')\]]+)?(?:\s+|$)/);
    if (!mm || mm.index === undefined) break;
    // Reject matches that only exist because we blanked a diagram (should not happen for 。.!?)
    const end = mm.index + mm[0].length;
    if (liveMask[mm.index] !== buf[mm.index]) break;
    if (
      cleanTutorSpeechText(buf.slice(0, end)).length < Math.min(10, minChars) &&
      !opts.force
    ) {
      break;
    }
    take(end);
  }

  if (opts.force) {
    if (buf.trim()) take(buf.length);
    if (held.trim()) {
      const cleaned = cleanTutorSpeechText(held);
      held = "";
      if (cleaned.length >= 2) ready.push(cleaned);
    }
  } else if (buf.length >= maxWaitChars) {
    const windowEnd = Math.min(buf.length, maxWaitChars + 40);
    const masked = maskCompleteDiagrams(buf);
    const soft = findSoftBreak(buf, masked, minChars, windowEnd);
    if (soft >= minChars) {
      take(soft);
    } else {
      // Prefer cutting before a complete diagram rather than mid-payload
      const beforeDiag = buf.search(
        /!\[[^\]]*\]\(data:image\/|<svg\b|```(?:svg|xml|mermaid)\b/i,
      );
      if (beforeDiag >= minChars) {
        take(beforeDiag);
      }
      // else: wait — do not soft-break into diagram soup
    }
  }

  const merged: string[] = [];
  for (const piece of ready) {
    if (isEncodedJunk(piece)) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      (prev.length < 36 || piece.length < 20) &&
      joinSpeechParts(prev, piece).length <= 200
    ) {
      merged[merged.length - 1] = joinSpeechParts(prev, piece);
    } else {
      merged.push(piece);
    }
  }

  return { ready: merged, rest: buf + held };
}
