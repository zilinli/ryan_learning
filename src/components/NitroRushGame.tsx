"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initNitroRush,
  setNitro,
  steerNitro,
  tickNitro,
  type NitroRushState,
} from "@/lib/entertain/nitro-rush";

export function NitroRushGame() {
  const [state, setState] = useState<NitroRushState>(() => initNitroRush());
  const stateRef = useRef(state);
  stateRef.current = state;
  const nitroHeld = useRef(false);

  const reset = useCallback(() => {
    nitroHeld.current = false;
    setState(initNitroRush());
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.status !== "playing") return;
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D", "Shift"].includes(k)) {
        e.preventDefault();
      }
      if (k === "ArrowLeft" || k === "a" || k === "A") {
        setState((s) => steerNitro(s, "L"));
      } else if (k === "ArrowRight" || k === "d" || k === "D") {
        setState((s) => steerNitro(s, "R"));
      } else if (k === "Shift") {
        nitroHeld.current = true;
        setState((s) => setNitro(s, true));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        nitroHeld.current = false;
        setState((s) => setNitro(s, false));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => {
      setState((s) => {
        let next = s;
        if (nitroHeld.current) next = setNitro(next, true);
        return tickNitro(next);
      });
    }, state.tickMs);
    return () => clearInterval(id);
  }, [state.status, state.tickMs]);

  const speedMph = Math.round(60 + state.speed * 48);

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>Score {state.score}</span>
        <span>{speedMph} mph</span>
        <span>Nitro {Math.round(state.nitro)}</span>
        {state.nitroActive ? (
          <span className="font-semibold text-[var(--coral)]">BOOST</span>
        ) : null}
        {state.status === "over" && (
          <span className="text-[var(--coral)]">Crashed!</span>
        )}
      </div>

      <div
        className="relative mb-4 overflow-hidden rounded-xl shadow-lg ring-1 ring-black/20"
        style={{
          width: "min(92vw, 320px)",
          height: "min(70vh, 420px)",
          background:
            "linear-gradient(180deg, #0c4a6e 0%, #164e63 40%, #0f172a 100%)",
        }}
      >
        {/* road */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{
            width: "78%",
            background:
              "repeating-linear-gradient(180deg, #1e293b 0 18px, #334155 18px 36px)",
          }}
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-amber-300/80" />
          <div className="absolute inset-y-0 right-0 w-1 bg-amber-300/80" />
          {Array.from({ length: state.lanes - 1 }, (_, i) => (
            <div
              key={i}
              className="absolute inset-y-0 w-px bg-white/30"
              style={{ left: `${((i + 1) / state.lanes) * 100}%` }}
            />
          ))}

          {state.traffic.map((c) => (
            <div
              key={c.id}
              className="absolute rounded-md shadow"
              style={{
                left: `${(c.lane + 0.15) * (100 / state.lanes)}%`,
                width: `${70 / state.lanes}%`,
                top: `${c.y * 100}%`,
                height: "7%",
                background: "linear-gradient(180deg, #f87171, #b91c1c)",
                transform: "translateY(-50%)",
              }}
            />
          ))}

          <div
            className="absolute rounded-md shadow-lg ring-2 ring-cyan-300/60"
            style={{
              left: `${(state.playerLane + 0.15) * (100 / state.lanes)}%`,
              width: `${70 / state.lanes}%`,
              top: `${state.playerY * 100}%`,
              height: "8%",
              background: state.nitroActive
                ? "linear-gradient(180deg, #67e8f9, #0284c7)"
                : "linear-gradient(180deg, #38bdf8, #0369a1)",
              transform: "translateY(-50%)",
              boxShadow: state.nitroActive
                ? "0 0 18px rgba(34,211,238,0.7)"
                : undefined,
            }}
          />
        </div>
      </div>

      <p className="mb-3 text-center text-xs text-[var(--ink-muted)]">
        ← → steer · hold Shift for nitro
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setState((s) => steerNitro(s, "L"))}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
        >
          ←
        </button>
        <button
          type="button"
          onPointerDown={() => {
            nitroHeld.current = true;
            setState((s) => setNitro(s, true));
          }}
          onPointerUp={() => {
            nitroHeld.current = false;
            setState((s) => setNitro(s, false));
          }}
          onPointerLeave={() => {
            nitroHeld.current = false;
            setState((s) => setNitro(s, false));
          }}
          className="rounded-full border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-4 py-2 text-sm font-semibold text-[var(--coral)]"
        >
          Nitro
        </button>
        <button
          type="button"
          onClick={() => setState((s) => steerNitro(s, "R"))}
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
