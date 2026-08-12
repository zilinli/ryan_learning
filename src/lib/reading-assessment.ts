/**
 * P2 (report §8.11) — "read a passage to me" oral reading assessment.
 * Compares the STT transcript against the target passage and returns a
 * kid-friendly accuracy score plus the words to polish.
 */

export type ReadingScore = {
  /** Target word count (or characters for CJK passages) */
  totalWords: number;
  /** Positional matches between target and transcript */
  correctWords: number;
  /** 0–100 rounded percentage */
  accuracy: number;
  /** Target words not present in the transcript */
  missed: string[];
};

/** Normalize a word for comparison: lowercase, strip punctuation, keep letters/numbers. */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf]/g, "");
}

function splitTokens(text: string): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  const hasHan = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(t);
  if (hasHan && !/\s/.test(t)) {
    // CJK: tokenize by character (keep whitespace-separated chunks too)
    return t.split(/\s+/).flatMap((chunk) => chunk.split(""));
  }
  return t.split(/\s+/);
}

function normTokens(text: string): string[] {
  return splitTokens(text)
    .map(normalizeWord)
    .filter(Boolean);
}

/** Positional accuracy + missed words. Never throws on empty input. */
export function scoreReading(transcript: string, target: string): ReadingScore {
  const targetTokens = normTokens(target);
  if (!targetTokens.length) {
    return { totalWords: 0, correctWords: 0, accuracy: 100, missed: [] };
  }
  const heardTokens = normTokens(transcript);
  const heardSet = new Set(heardTokens);

  let correct = 0;
  for (let i = 0; i < targetTokens.length; i += 1) {
    if (heardTokens[i] === targetTokens[i]) correct += 1;
  }

  const missed = Array.from(
    new Set(targetTokens.filter((w) => !heardSet.has(w))),
  );
  const accuracy = Math.round((correct / targetTokens.length) * 100);
  return {
    totalWords: targetTokens.length,
    correctWords: correct,
    accuracy,
    missed,
  };
}

/** Kid-facing feedback line for a score. */
export function readingFeedback(score: ReadingScore): string {
  if (!score.totalWords) return "Pick a passage, listen, then read it aloud.";
  if (score.accuracy >= 90) {
    return `Fluent read! ${score.correctWords}/${score.totalWords} words spot-on. You could teach this one.`;
  }
  if (score.accuracy >= 70) {
    const polish = score.missed.length
      ? ` Listen for: ${score.missed.slice(0, 5).join(", ")}.`
      : "";
    return `Nice read — ${score.correctWords}/${score.totalWords} words matched.${polish}`;
  }
  if (score.accuracy >= 40) {
    return `Good try! You got ${score.correctWords}/${score.totalWords} words. Tap Listen again, then read it once more.`;
  }
  return `Great try! It is okay to stumble — tap Listen, then read along slowly.`;
}
