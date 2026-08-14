"use client";

import { useCallback, useRef } from "react";

/**
 * Learning Games juice primitives (learning-games-v2.md §5.4).
 * Synthesised Web Audio + haptics, with graceful silent fallback:
 * - No AudioContext until the first user gesture (browsers block autoplay).
 * - `navigator.vibrate` is a no-op on unsupported devices.
 * - Every failure is swallowed — juice must never break the lesson.
 */

type JuiceKind = "tap" | "correct" | "error";

export function useJuice() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctxRef.current) {
      try {
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (freq: number, start: number, dur: number, gain = 0.04, type: OscillatorType = "sine") => {
      const ctx = getCtx();
      if (!ctx) return;
      try {
        if (ctx.state === "suspended") void ctx.resume();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.02);
      } catch {
        /* silent */
      }
    },
    [getCtx],
  );

  const buzz = useCallback((pattern: number | number[]) => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* silent */
    }
  }, []);

  const play = useCallback(
    (kind: JuiceKind) => {
      if (kind === "tap") {
        tone(340, 0, 0.06, 0.025, "triangle");
        return;
      }
      if (kind === "correct") {
        tone(523.25, 0, 0.12, 0.045, "sine"); // C5
        tone(783.99, 0.09, 0.16, 0.045, "sine"); // G5
        buzz(24);
        return;
      }
      // error
      tone(196, 0, 0.14, 0.05, "square"); // G3
      tone(155.56, 0.1, 0.18, 0.05, "square"); // D#3
      buzz([30, 40, 30]);
    },
    [tone, buzz],
  );

  return { play, playTap: () => play("tap"), playCorrect: () => play("correct"), playError: () => play("error") };
}

/** Shared keyframes for per-game inline <style> blocks (kept out of React state). */
export const JUICE_KEYFRAMES = `
  @keyframes lgPulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
  @keyframes lgBurst {
    from{transform:translate(0,0);opacity:.9}
    to{transform:translate(var(--dx),var(--dy));opacity:0}
  }
  @keyframes lgGlow {
    0%,100%{filter:drop-shadow(0 0 0 rgba(255,255,255,0))}
    45%{filter:drop-shadow(0 0 14px var(--glow, rgba(255,255,255,.8)))}
  }
`;
