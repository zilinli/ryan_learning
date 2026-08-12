/**
 * Client-side session focus timer — tracks active learning duration.
 * Gentle: no streaks, no forced locks, no gamification.
 * Used by ChatThread for break nudges and FamilyControlsPage for daily focus summary.
 */

const STORAGE_DAILY_KEY = "spark.focusDaily.";

type DailyFocusRecord = {
  /** YYYY-MM-DD */
  date: string;
  /** Total active focus ms for that day */
  totalMs: number;
};

let sessionStartMs = 0;
let pausedMs = 0;
let pauseStartMs = 0;
let nudgeShown = false;
let nudgeIntervalMs = 25 * 60_000; // 25 minutes
let nudgeDismissed = false;

export type SessionTimerSnapshot = {
  elapsedMs: number;
  isActive: boolean;
  totalTodayMs: number;
};

export function startSessionTimer(): void {
  sessionStartMs = performance.now();
  pausedMs = 0;
  pauseStartMs = 0;
  nudgeShown = false;
  nudgeDismissed = false;
}

export function pauseSessionTimer(): void {
  if (pauseStartMs > 0) return; // already paused
  pauseStartMs = performance.now();
}

export function resumeSessionTimer(): void {
  if (pauseStartMs <= 0) return; // was not paused
  pausedMs += performance.now() - pauseStartMs;
  pauseStartMs = 0;
}

/** Active elapsed ms (excluding pauses). */
export function getSessionElapsedMs(): number {
  if (sessionStartMs <= 0) return 0;
  const now = performance.now();
  const extraPause =
    pauseStartMs > 0 ? now - pauseStartMs : 0;
  return Math.max(0, now - sessionStartMs - pausedMs - extraPause);
}

/** Total focus ms accumulated today (session + previous sessions). */
export function getTotalTodayMs(): number {
  const today = localDateKey();
  const prev = loadDailyFocus(today);
  return prev.totalMs + getSessionElapsedMs();
}

export function getSessionSnapshot(): SessionTimerSnapshot {
  return {
    elapsedMs: getSessionElapsedMs(),
    isActive: pauseStartMs <= 0,
    totalTodayMs: getTotalTodayMs(),
  };
}

/** Persist current session focus time and reset for a new session. */
export function commitSessionFocus(): void {
  const elapsed = getSessionElapsedMs();
  if (elapsed < 30_000) return; // ignore sessions under 30s
  const today = localDateKey();
  const prev = loadDailyFocus(today);
  saveDailyFocus(today, prev.totalMs + elapsed);
  // Reset for next session
  sessionStartMs = 0;
  pausedMs = 0;
  pauseStartMs = 0;
  nudgeShown = false;
  nudgeDismissed = false;
}

// ── Break nudge ──

/** Returns true exactly once when the session crosses the nudge threshold. */
export function shouldShowBreakNudge(forceMinutes?: number): boolean {
  if (nudgeShown || nudgeDismissed) return false;
  const thresholdMs = (forceMinutes ?? 25) * 60_000;
  const elapsed = getSessionElapsedMs();
  if (elapsed >= thresholdMs) {
    nudgeShown = true;
    return true;
  }
  return false;
}

export function dismissBreakNudge(): void {
  nudgeDismissed = true;
}

/** Approximate readable duration for the nudge. */
export function formatFocusDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "less than a minute";
  if (mins === 1) return "1 minute";
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} hour${h > 1 ? "s" : ""}`;
  return `${h} hour${h > 1 ? "s" : ""} ${m} min`;
}

// ── Daily persistence (localStorage kv, same pattern as browser-kv) ──

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadDailyFocus(date: string): DailyFocusRecord {
  try {
    const raw = localStorage.getItem(`${STORAGE_DAILY_KEY}${date}`);
    if (!raw) return { date, totalMs: 0 };
    const parsed = JSON.parse(raw) as DailyFocusRecord;
    return { date: parsed.date || date, totalMs: Number(parsed.totalMs) || 0 };
  } catch {
    return { date, totalMs: 0 };
  }
}

function saveDailyFocus(date: string, totalMs: number): void {
  try {
    localStorage.setItem(
      `${STORAGE_DAILY_KEY}${date}`,
      JSON.stringify({ date, totalMs }),
    );
  } catch {
    /* localStorage full — non-critical */
  }
}
