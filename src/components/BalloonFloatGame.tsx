"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  driftBalloon,
  flapBalloon,
  initBalloonFloat,
  tickBalloon,
  type BalloonFloatState,
} from "@/lib/entertain/balloon-float";

export function BalloonFloatGame() {
  const [state, setState] = useState<BalloonFloatState>(() => initBalloonFloat());
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => setState(initBalloonFloat()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current.status !== "playing") return;
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D", " ", "ArrowUp", "w", "W"].includes(k)) {
        e.preventDefault();
      }
      setState((s) => {
        if (s.status !== "playing") return s;
        if (k === "ArrowLeft" || k === "a" || k === "A") return driftBalloon(s, "L");
        if (k === "ArrowRight" || k === "d" || k === "D") return driftBalloon(s, "R");
        if (k === " " || k === "ArrowUp" || k === "w" || k === "W") return flapBalloon(s);
        return s;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => {
      setState((s) => tickBalloon(s));
    }, state.tickMs);
    return () => clearInterval(id);
  }, [state.status, state.tickMs]);

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-3 flex items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>Score {state.score}</span>
        {state.status === "over" && (
          <span className="text-[var(--coral)]">Splash!</span>
        )}
      </div>

      <div
        className="relative mb-4 overflow-hidden rounded-xl shadow-lg"
        style={{
          width: "min(92vw, 320px)",
          aspectRatio: `${state.width} / ${state.height}`,
          background:
            "linear-gradient(180deg, #7dd3fc 0%, #bae6fd 45%, #38bdf8 78%, #0ea5e9 88%, #0369a1 100%)",
        }}
        onClick={() => setState((s) => flapBalloon(s))}
        role="presentation"
      >
        {/* water band */}
        <div className="absolute inset-x-0 bottom-0 h-[8%] bg-[#0284c7]/90" />

        {state.rivals.map((r) => (
          <div
            key={r.id}
            className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-400 text-[10px] font-bold text-white shadow"
            style={{
              left: `${(r.x / state.width) * 100}%`,
              top: `${(r.y / state.height) * 100}%`,
            }}
          >
            ○
          </div>
        ))}

        <div
          className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lime-300 text-xs font-bold text-lime-900 shadow-lg ring-2 ring-white/70"
          style={{
            left: `${(state.x / state.width) * 100}%`,
            top: `${(state.y / state.height) * 100}%`,
          }}
        >
          ◉
        </div>
      </div>

      <p className="mb-3 text-center text-xs text-[var(--ink-muted)]">
        Tap / Space flap · ← → drift · pop rivals from above · avoid the water
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setState((s) => driftBalloon(s, "L"))}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setState((s) => flapBalloon(s))}
          className="rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 py-2 text-sm font-semibold text-[var(--teal)]"
        >
          Flap
        </button>
        <button
          type="button"
          onClick={() => setState((s) => driftBalloon(s, "R"))}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
        >
          →
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
