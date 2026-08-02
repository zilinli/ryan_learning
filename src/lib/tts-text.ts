/** Prepare tutor replies for natural neural TTS playback. */

export function cleanTutorSpeechText(text: string): string {
  let t = text.replace(/\r\n/g, "\n").trim();
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/[*_~]+/g, "");
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\n/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** Split into short phrases so synthesis stays natural and reliable. */
export function chunkForNeuralTts(text: string, maxLen = 420): string[] {
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
    if (cleanTutorSpeechText(buf.slice(0, end)).length < Math.min(12, minChars) && !opts.force) {
      break;
    }
    take(end);
  }

  if (opts.force && buf.trim()) {
    take(buf.length);
  } else if (buf.length >= maxWaitChars) {
    // Soft break at comma / space so speech starts before the full answer
    const soft = buf.search(/[,;:，；]\s+| {1}/);
    if (soft > minChars) {
      take(soft + 1);
    } else if (buf.length >= maxWaitChars + 40) {
      take(maxWaitChars);
    }
  }

  return { ready, rest: buf };
}
