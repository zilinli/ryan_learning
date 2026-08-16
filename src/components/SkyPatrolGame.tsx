"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fireSky,
  initSkyPatrol,
  moveSky,
  tickSky,
  type SkyPatrolState,
} from "@/lib/entertain/sky-patrol";

export function SkyPatrolGame() {
  const [state, setState] = useState<SkyPatrolState>(() => initSkyPatrol());
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => setState(initSkyPatrol()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current.status !== "playing") return;
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D", " ", "ArrowUp", "w", "W"].includes(k)) {
        e.preventDefault();
      }
      setState((s) => {
        if (s.status !== "playing") return s;
        if (k === "ArrowLeft" || k === "a" || k === "A") return moveSky(s, "L");
        if (k === "ArrowRight" || k === "d" || k === "D") return moveSky(s, "R");
        if (k === " " || k === "ArrowUp" || k === "w" || k === "W") return fireSky(s);
        return s;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => {
      setState((s) => tickSky(s));
    }, state.tickMs);
    return () => clearInterval(id);
  }, [state.status, state.tickMs]);

  const cell = 100 / Math.max(state.width, state.height);

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-3 flex items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>Score {state.score}</span>
        {state.status === "over" && (
          <span className="text-[var(--coral)]">Shot down!</span>
        )}
      </div>

      <div
        className="relative mb-4 overflow-hidden rounded-xl shadow-lg"
        style={{
          width: "min(92vw, 300px)",
          aspectRatio: `${state.width} / ${state.height}`,
          background:
            "radial-gradient(ellipse at top, #1e3a5f 0%, #0b1220 55%, #020617 100%)",
        }}
      >
        {/* stars */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1px 1px at 40% 80%, #cbd5e1, transparent)",
          }}
        />

        {state.bullets.map((b) => (
          <div
            key={b.id}
            className="absolute rounded-full bg-amber-300 shadow"
            style={{
              left: `${(b.x + 0.35) * (100 / state.width)}%`,
              top: `${(b.y / state.height) * 100}%`,
              width: `${cell * 0.3}%`,
              height: `${cell * 0.6}%`,
            }}
          />
        ))}

        {state.enemies.map((e) => (
          <div
            key={e.id}
            className="absolute flex items-center justify-center text-sm"
            style={{
              left: `${(e.x / state.width) * 100}%`,
              top: `${(e.y / state.height) * 100}%`,
              width: `${100 / state.width}%`,
              height: `${100 / state.height}%`,
              transform: "translate(-0%, 0)",
            }}
            aria-hidden
          >
            <span
              className="inline-block rounded-sm px-1 text-[10px] font-bold text-white"
              style={{
                background:
                  e.kind === "bomber"
                    ? "linear-gradient(180deg,#fb923c,#c2410c)"
                    : "linear-gradient(180deg,#f87171,#991b1b)",
              }}
            >
              ▾
            </span>
          </div>
        ))}

        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${(state.playerX / state.width) * 100}%`,
            top: `${(state.playerY / state.height) * 100}%`,
            width: `${100 / state.width}%`,
            height: `${100 / state.height}%`,
          }}
        >
          <span className="rounded-sm bg-cyan-400 px-1 text-[11px] font-bold text-slate-900 shadow-lg shadow-cyan-400/40">
            ▲
          </span>
        </div>
      </div>

      <p className="mb-3 text-center text-xs text-[var(--ink-muted)]">
        ← → move · Space / ↑ fire
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setState((s) => moveSky(s, "L"))}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setState((s) => fireSky(s))}
          className="rounded-full border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 py-2 text-sm font-semibold text-[var(--teal)]"
        >
          Fire
        </button>
        <button
          type="button"
          onClick={() => setState((s) => moveSky(s, "R"))}
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
