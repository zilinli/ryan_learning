/**
 * Hide tool-call / harness narration that leaks into assistant text
 * (e.g. "Let me check what diagram tools we have").
 */

const META_SENTENCE =
  /(?:^|[.!?。！？\n]\s*)((?:let me|i(?:'m| am| will|'ll)|okay[, ]+|ok[, ]+|sure[, ]+|now[, ]+|first[, ]+)?(?:(?:just )?(?:check|checking|look(?:ing)? up|search(?:ing)?|fetch(?:ing)?|call(?:ing)?|use|using|run(?:ning)?|draw(?:ing)?|open(?:ing)?)\b[^.!?\n]{0,120}(?:tool|diagram|web_search|fetch_page|run_python|run_js|draw_geometry|harness|svg generator)[^.!?\n]{0,80})[.!?。！？]?)/gi;

const META_LINE =
  /^\s*(?:[-*•]\s*)?(?:tool(?:\s+call)?|using tool|calling tool|web_search|fetch_page|run_python|run_js|draw_geometry|status:\s*thinking)\b.*$/gim;

const META_PHRASE =
  /\b(?:let me check what (?:diagram )?tools? we have|i(?:'ll| will) (?:now )?(?:use|call|run) (?:the )?(?:tool|diagram|search)|checking (?:available )?tools?|looking up (?:a )?(?:tool|diagram))\b[^.!?\n]*/gi;

/** True if a short chunk looks like internal tool narration only. */
export function isToolMetaNarration(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (t.length > 220) return false;
  if (
    /^(let me (check|look|search|fetch|draw|run|see)|i('ll| will) (check|look|use|call|search|draw|run)|checking|using (the )?(tool|web_search|draw_geometry)|drawing (a |the )?diagram|searching (for |the )?web)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(tool|web_search|draw_geometry|fetch_page|run_python)\b/i.test(t) && t.length < 100) {
    return true;
  }
  return false;
}

export type ScrubOptions = {
  /** Trim ends. Default true for finished messages; false for streaming deltas. */
  trim?: boolean;
};

/** Strip tool-meta sentences/lines from visible tutor text. */
export function scrubTutorVisibleText(
  text: string,
  opts: ScrubOptions = {},
): string {
  if (!text) return text;
  const doTrim = opts.trim !== false;
  let out = text.replace(META_LINE, "");
  out = out.replace(META_PHRASE, "");
  out = out.replace(META_SENTENCE, (full, _sent, offset) => {
    // Keep leading punctuation from the previous sentence
    if (offset > 0 && /[.!?。！？]/.test(full[0]!)) return full[0]!;
    return " ";
  });
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/ +\n/g, "\n");
  // Never trim streaming chunks — English text-deltas often start with a space.
  return doTrim ? out.trim() : out;
}

/**
 * Streaming-safe filter: drop pure meta deltas; scrub mixed ones.
 * Returns empty string to skip emitting this delta.
 *
 * Critical: preserve whitespace-only and punctuation-only deltas. The Cursor
 * SDK streams English as ["Hello", ",", " world", "!", ...] — dropping those
 * glued words into "Helloworld".
 */
export function filterTutorDelta(delta: string): string {
  if (!delta) return "";
  // Keep pure whitespace / punctuation exactly (do not scrub/trim).
  if (/^[\s.,!?;:'"“”‘’()\-[\]{}…，。！？、；：、]+$/.test(delta)) {
    return delta;
  }
  if (isToolMetaNarration(delta)) return "";
  const scrubbed = scrubTutorVisibleText(delta, { trim: false });
  // Scrub removed a meta sentence and left nothing
  if (!scrubbed.trim() && /[A-Za-z\u4e00-\u9fff]/.test(delta)) {
    return "";
  }
  return scrubbed;
}

/**
 * Prefer the SDK final result when streamed text lost spaces/punctuation.
 * Never drop a diagram the stream already captured.
 */
export function hasTutorDiagram(text: string): boolean {
  return /data:image\/svg\+xml|<svg\b[\s\S]*?<\/svg>|```\s*svg\b/i.test(
    text || "",
  );
}

export function extractTutorDiagrams(text: string): string[] {
  const out: string[] = [];
  for (const m of (text || "").matchAll(
    /!\[[^\]]*\]\(data:image\/svg\+xml(?:;base64)?,[^)]+\)/gi,
  )) {
    out.push(m[0]);
  }
  for (const m of (text || "").matchAll(/```\s*svg\b[\s\S]*?```/gi)) {
    out.push(m[0]);
  }
  for (const m of (text || "").matchAll(
    /(?:^|\n)\s*(?:svg\s*)?(<svg\b[\s\S]*?<\/svg>)/gi,
  )) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

/**
 * Prefer the SDK final result when streamed text lost spaces/punctuation.
 * Never drop a diagram the stream already captured — reinject if needed.
 */
export function preferCompleteTutorText(
  streamed: string,
  finalResult?: string | null,
): string {
  const a = streamed || "";
  const b = (finalResult || "").trim();
  if (!b) return a;
  if (!a.trim()) return b;

  const compact = (s: string) => s.replace(/[^A-Za-z0-9\u4e00-\u9fff]+/g, "");
  const latinSpaceRatio = (s: string) => {
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    if (letters < 12) return 1;
    const spaces = (s.match(/ /g) || []).length;
    return spaces / letters;
  };

  let pick = a;

  // Streamed glued English vs spaced final
  if (/\s/.test(b) && !/\s/.test(a) && compact(a) === compact(b)) pick = b;
  else if (
    latinSpaceRatio(b) > latinSpaceRatio(a) * 1.6 + 0.02 &&
    compact(a) === compact(b)
  ) {
    pick = b;
  } else if (
    (hasTutorDiagram(b) && !hasTutorDiagram(a)) ||
    (b.includes("](") && !a.includes("](") && /data:image\//i.test(b))
  ) {
    pick = b;
  } else if (
    b.length > a.length + 10 &&
    b.includes(a.slice(0, Math.min(24, a.length)))
  ) {
    pick = b;
  } else if (
    latinSpaceRatio(a) < 0.06 &&
    latinSpaceRatio(b) >= 0.12 &&
    compact(a).length > 40 &&
    compact(a) === compact(b)
  ) {
    pick = b;
  }

  // Always reinject diagrams from stream if the pick lost them
  if (hasTutorDiagram(a) && !hasTutorDiagram(pick)) {
    const diagrams = extractTutorDiagrams(a);
    if (diagrams.length) {
      return `${diagrams.join("\n\n")}\n\n${pick}`.trim();
    }
    return a;
  }
  return pick;
}
