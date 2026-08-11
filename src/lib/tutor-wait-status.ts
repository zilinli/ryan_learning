/**
 * Phased wait labels while the tutor agent is silent (latency perception).
 * Prefer real tool/SSE status when present — these phases fill the blank "Thinking…".
 */

export type WaitPhaseContext = {
  hasMedia: boolean;
};

/** Wall-clock ms from send → advance to next phase index. */
export const WAIT_PHASE_AT_MS = [0, 4_000, 12_000, 25_000] as const;

const PHOTO_PHASES = [
  "Looking at your photo…",
  "Figuring it out…",
  "Taking a bit longer…",
  "Still working — hang tight…",
] as const;

const TEXT_PHASES = [
  "Thinking…",
  "Working on it…",
  "Taking a bit longer…",
  "Still working — hang tight…",
] as const;

export function waitPhases(ctx: WaitPhaseContext): readonly string[] {
  return ctx.hasMedia ? PHOTO_PHASES : TEXT_PHASES;
}

export function initialWaitStatus(ctx: WaitPhaseContext): string {
  return waitPhases(ctx)[0]!;
}

/** Largest phase index whose threshold ≤ elapsedMs. */
export function waitPhaseIndex(elapsedMs: number): number {
  let idx = 0;
  for (let i = 0; i < WAIT_PHASE_AT_MS.length; i += 1) {
    if (elapsedMs >= WAIT_PHASE_AT_MS[i]!) idx = i;
  }
  return idx;
}

export function waitStatusAt(ctx: WaitPhaseContext, elapsedMs: number): string {
  const phases = waitPhases(ctx);
  const i = Math.min(waitPhaseIndex(elapsedMs), phases.length - 1);
  return phases[i]!;
}

/**
 * True when the current label is still a generic wait phase (safe to replace
 * with the next timed phase). Tool labels like "Drawing a diagram…" win.
 */
export function isGenericWaitStatus(status: string): boolean {
  const s = (status || "").trim();
  if (!s) return true;
  const all = new Set<string>([...PHOTO_PHASES, ...TEXT_PHASES]);
  return all.has(s);
}
