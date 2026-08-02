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

  // Hard-split any leftover long piece
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
