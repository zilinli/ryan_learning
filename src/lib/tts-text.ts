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

export function cleanTutorSpeechText(text: string): string {
  let t = text.replace(/\r\n/g, "\n").trim();
  // Strip fenced / inline code and links
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
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

  // Paragraph / line breaks: Chinese joins tightly; English keeps sentence pauses
  if (isMostlyCjk(t)) {
    t = t.replace(/\n{2,}/g, "。");
    t = t.replace(/\n/g, "");
  } else {
    t = t.replace(/\n{2,}/g, ". ");
    t = t.replace(/\n/g, " ");
  }

  t = t.replace(/\s+/g, " ").trim();

  // LLM often inserts spaces between Chinese characters → edge-tts pauses on each gap
  t = t.replace(
    /([\u4e00-\u9fff\u3400-\u4dbf])\s+(?=[\u4e00-\u9fff\u3400-\u4dbf])/g,
    "$1",
  );
  // Tighten spaces around CJK punctuation (avoid "字 ， 字" style hiccups)
  t = t.replace(/\s*([。！？，、；：])\s*/g, "$1");
  // Keep a single space after Latin sentence enders when more Latin follows
  t = t.replace(/([.!?])([A-Za-z])/g, "$1 $2");
  // Collapse any double spaces left from mixed cleanup
  t = t.replace(/\s{2,}/g, " ").trim();
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
  e = e.replace(/\\left|\\right/g, "");
  e = e.replace(/\\,/g, " ");
  e = e.replace(/\\;/g, " ");
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

  // Prefer sentence boundaries; Chinese often has no space after 。！？
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
    // Soft-split long runs at clause punctuation, not mid-word
    let rest = p;
    while (rest.length > maxLen) {
      const windowEnd = Math.min(rest.length, maxLen);
      let soft = findSoftBreak(rest, Math.floor(maxLen * 0.45), windowEnd);
      if (soft < 0) soft = maxLen;
      out.push(rest.slice(0, soft).trim());
      rest = rest.slice(soft).trim();
    }
    if (rest) out.push(rest);
  }
  return out.filter((x) => x.length >= 2);
}

/** Prefer strong clause ends; avoid breaking on plain spaces when possible. */
function findSoftBreak(text: string, minIdx: number, maxIdx: number): number {
  const strong = "。！？.!?;；";
  const medium = "，、,";
  for (let i = maxIdx - 1; i >= minIdx; i -= 1) {
    if (strong.includes(text[i]!)) return i + 1;
  }
  for (let i = maxIdx - 1; i >= minIdx; i -= 1) {
    if (medium.includes(text[i]!)) return i + 1;
  }
  // Last resort: space (English), never split a CJK char (they're 1 code unit here)
  for (let i = maxIdx - 1; i >= minIdx; i -= 1) {
    if (text[i] === " " && !CJK_CHAR.test(text[i + 1] ?? "")) return i + 1;
  }
  return -1;
}

/**
 * Pull speakable phrases from a live streaming buffer.
 * Prefers full sentences; soft-breaks only when the buffer grows long.
 */
export function pullSpeakableFromBuffer(
  buffer: string,
  opts: { force?: boolean; minChars?: number; maxWaitChars?: number } = {},
): { ready: string[]; rest: string } {
  // Larger windows → fewer MP3 clips → smoother rhythm (less mid-phrase silence)
  const minChars = opts.minChars ?? 28;
  const maxWaitChars = opts.maxWaitChars ?? 160;
  let buf = buffer.replace(/\r\n/g, "\n");
  const ready: string[] = [];

  const take = (end: number) => {
    const raw = buf.slice(0, end);
    buf = buf.slice(end).replace(/^\s+/, "");
    const cleaned = cleanTutorSpeechText(raw);
    if (cleaned.length >= 2) ready.push(cleaned);
  };

  while (true) {
    const m = buf.match(/[.!?。！？](?:["')\]]+)?(?:\s+|$)/);
    if (!m || m.index === undefined) break;
    const end = m.index + m[0].length;
    // Avoid tiny fragments like "OK."
    if (
      cleanTutorSpeechText(buf.slice(0, end)).length < Math.min(10, minChars) &&
      !opts.force
    ) {
      break;
    }
    take(end);
  }

  if (opts.force && buf.trim()) {
    take(buf.length);
  } else if (buf.length >= maxWaitChars) {
    const windowEnd = Math.min(buf.length, maxWaitChars + 40);
    const soft = findSoftBreak(buf, minChars, windowEnd);
    if (soft >= minChars) {
      take(soft);
    } else {
      take(Math.min(buf.length, maxWaitChars));
    }
  }

  // Merge consecutive tiny ready pieces so we don't speak 5-char clips
  const merged: string[] = [];
  for (const piece of ready) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.length < 36 || piece.length < 20) && joinSpeechParts(prev, piece).length <= 200) {
      merged[merged.length - 1] = joinSpeechParts(prev, piece);
    } else {
      merged.push(piece);
    }
  }

  return { ready: merged, rest: buf };
}
