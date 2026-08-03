/** Prepare tutor replies for natural neural TTS playback. */

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
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\n/g, " ");
  t = t.replace(/\s+/g, " ").trim();
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

/** Split into short phrases so synthesis stays fast and natural. */
export function chunkForNeuralTts(text: string, maxLen = 220): string[] {
  const cleaned = cleanTutorSpeechText(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?。！？])\s+/);
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (!s) continue;
    if (!buf) {
      buf = s;
      continue;
    }
    if ((buf + " " + s).length <= maxLen) {
      buf = `${buf} ${s}`;
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
    for (let i = 0; i < p.length; i += maxLen) {
      out.push(p.slice(i, i + maxLen));
    }
  }
  return out;
}

/**
 * Pull speakable phrases from a live streaming buffer.
 * Speaks completed sentences early; also flushes long clauses without waiting for the full reply.
 */
export function pullSpeakableFromBuffer(
  buffer: string,
  opts: { force?: boolean; minChars?: number; maxWaitChars?: number } = {},
): { ready: string[]; rest: string } {
  // Snappy defaults: start speaking as soon as a short clause is ready
  const minChars = opts.minChars ?? 16;
  const maxWaitChars = opts.maxWaitChars ?? 90;
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
      cleanTutorSpeechText(buf.slice(0, end)).length < Math.min(8, minChars) &&
      !opts.force
    ) {
      break;
    }
    take(end);
  }

  if (opts.force && buf.trim()) {
    take(buf.length);
  } else if (buf.length >= maxWaitChars) {
    // Soft-break near the wait window (not the first space in the buffer)
    const windowEnd = Math.min(buf.length, maxWaitChars + 24);
    let soft = -1;
    for (let i = windowEnd - 1; i >= minChars; i -= 1) {
      const ch = buf[i]!;
      if (",;:，；、 ".includes(ch)) {
        soft = i;
        break;
      }
    }
    if (soft >= minChars) {
      take(soft + 1);
    } else {
      take(Math.min(buf.length, maxWaitChars));
    }
  }

  return { ready, rest: buf };
}
