/**
 * CA-4 / Phase 4.1a — TTS barge-in helpers (stop speech before mic listen).
 */

export type BargeInPlan = {
  stopSpeech: true;
  thenListen: true;
};

/** Mic should interrupt when TTS is actively speaking. */
export function shouldBargeIn(speaking: boolean): boolean {
  return speaking === true;
}

export function interruptHint(speaking: boolean): string {
  return speaking ? "Speaking — tap mic to interrupt" : "";
}

/** Canonical order for voice barge-in. */
export function planBargeIn(): BargeInPlan {
  return { stopSpeech: true, thenListen: true };
}
