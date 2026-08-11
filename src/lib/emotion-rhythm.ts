/**
 * Soft win/struggle copy for emotion rhythm (UX-RPT.10).
 * Prompt injection + optional UI one-liner — never streaks.
 */

export type EmotionKind = "win" | "struggle" | "neutral";

const STORAGE_KEY = "spark.emotionStreak";

type StreakState = { kind: EmotionKind; count: number };

/** In-memory fallback when sessionStorage is missing (vitest / SSR). */
let memoryStreak: StreakState = { kind: "neutral", count: 0 };

function loadStreak(): StreakState {
  if (typeof window === "undefined") return { ...memoryStreak };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...memoryStreak };
    const p = JSON.parse(raw) as StreakState;
    if (p.kind !== "win" && p.kind !== "struggle") {
      return { kind: "neutral", count: 0 };
    }
    const next = { kind: p.kind, count: Math.max(0, Number(p.count) || 0) };
    memoryStreak = next;
    return next;
  } catch {
    return { ...memoryStreak };
  }
}

function saveStreak(s: StreakState): void {
  memoryStreak = s;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Test helper — reset streak. */
export function resetEmotionStreakForTests(): void {
  memoryStreak = { kind: "neutral", count: 0 };
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Update consecutive win/struggle counters from turn heuristics. */
export function noteEmotionOutcome(kind: EmotionKind): StreakState {
  if (kind === "neutral") return loadStreak();
  const prev = loadStreak();
  const next: StreakState =
    prev.kind === kind
      ? { kind, count: Math.min(5, prev.count + 1) }
      : { kind, count: 1 };
  saveStreak(next);
  return next;
}

/** Short kid-facing line after a turn (≤1 sentence). */
export function emotionUiLine(state: StreakState): string | null {
  if (state.kind === "struggle" && state.count >= 2) {
    return "No worries — let's look at it another way.";
  }
  if (state.kind === "win" && state.count >= 2) {
    return "Nice — you're getting the hang of this.";
  }
  return null;
}

/** Prompt fence for the next Agent turn. */
export function emotionPromptLines(state?: StreakState): string[] {
  const s = state ?? loadStreak();
  if (!s || s.count < 2) return [];
  if (s.kind === "struggle") {
    return [
      "",
      "[Emotional rhythm]",
      "Student has struggled on recent turns. Lead with one short encourage (e.g. “No worries — try another angle”), then one clear next move. Max 3 short sentences total for the emotional beat.",
    ];
  }
  if (s.kind === "win") {
    return [
      "",
      "[Emotional rhythm]",
      "Student succeeded on recent turns. One short warm affirm (e.g. “You found the pattern”), then gently raise the challenge one notch. No badges or streaks wording.",
    ];
  }
  return [];
}
