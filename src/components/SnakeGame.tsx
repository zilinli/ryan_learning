"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initSnake,
  setDirection,
  stepSnake,
  type Dir,
  type SnakeState,
} from "@/lib/entertain/snake";

export function SnakeGame() {
  const [state, setState] = useState<SnakeState>(() => initSnake());
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => setState(initSnake()), []);

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: "U",
      ArrowDown: "D",
      ArrowLeft: "L",
      ArrowRight: "R",
      w: "U",
      s: "D",
      a: "L",
      d: "R",
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      setState((s) => setDirection(s, dir));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => {
      setState((s) => stepSnake(s));
    }, state.tickMs);
    return () => clearInterval(id);
  }, [state.status, state.tickMs]);

  const cells = new Map<string, "head" | "body" | "food">();
  state.snake.forEach((p, i) => cells.set(`${p.r},${p.c}`, i === 0 ? "head" : "body"));
  cells.set(`${state.food.r},${state.food.c}`, "food");

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-3 flex items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>Score {state.score}</span>
        {state.status === "over" && <span className="text-[var(--coral)]">Game over</span>}
      </div>

      <div
        className="mb-4 grid gap-px rounded-lg bg-[#14532d] p-1.5 shadow-lg"
        style={{
          gridTemplateColumns: `repeat(${state.width}, 1fr)`,
          width: "min(90vw, 360px)",
        }}
      >
        {Array.from({ length: state.height }, (_, r) =>
          Array.from({ length: state.width }, (_, c) => {
            const kind = cells.get(`${r},${c}`);
            let bg = "#166534";
            if (kind === "head") bg = "#86efac";
            else if (kind === "body") bg = "#4ade80";
            else if (kind === "food") bg = "#f87171";
            return (
              <div
                key={`${r}-${c}`}
                className="aspect-square rounded-[2px]"
                style={{ background: bg }}
              />
            );
          }),
        )}
      </div>

      <p className="mb-3 text-center text-xs text-[var(--ink-muted)]">
        Arrow keys or WASD
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {(["U", "L", "D", "R"] as Dir[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setState((s) => setDirection(s, d))}
            className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
          >
            {d === "U" ? "↑" : d === "D" ? "↓" : d === "L" ? "←" : "→"}
          </button>
        ))}
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
