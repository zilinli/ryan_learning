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

/** Strip tool-meta sentences/lines from visible tutor text. */
export function scrubTutorVisibleText(text: string): string {
  if (!text) return text;
  let out = text.replace(META_LINE, "");
  out = out.replace(META_PHRASE, "");
  out = out.replace(META_SENTENCE, (full, _sent, offset) => {
    // Keep leading punctuation from the previous sentence
    if (offset > 0 && /[.!?。！？]/.test(full[0]!)) return full[0]!;
    return " ";
  });
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/ +\n/g, "\n").trim();
  return out;
}

/**
 * Streaming-safe filter: drop pure meta deltas; scrub mixed ones.
 * Returns empty string to skip emitting this delta.
 */
export function filterTutorDelta(delta: string): string {
  if (!delta) return "";
  if (isToolMetaNarration(delta)) return "";
  const scrubbed = scrubTutorVisibleText(delta);
  // If scrubbing removed everything meaningful, skip
  if (!scrubbed.trim()) return "";
  // Avoid emitting tiny leftover glue from scrubbing mid-stream
  if (scrubbed.length < 2 && !/[\u4e00-\u9fffA-Za-z0-9]/.test(scrubbed)) {
    return "";
  }
  return scrubbed === delta ? delta : scrubbed;
}
