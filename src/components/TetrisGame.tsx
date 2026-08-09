"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  displayGrid,
  hardDrop,
  initTetris,
  movePiece,
  rotatePiece,
  tick,
  type Cell,
  type TetrisState,
} from "@/lib/entertain/tetris";

const COLORS: Record<number, string> = {
  0: "transparent",
  1: "#38bdf8",
  2: "#facc15",
  3: "#a78bfa",
  4: "#4ade80",
  5: "#f87171",
  6: "#60a5fa",
  7: "#fb923c",
};

export function TetrisGame() {
  const [state, setState] = useState<TetrisState>(() => initTetris());
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => setState(initTetris()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current.status !== "playing") return;
      const k = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "w", "a", "s", "d"].includes(k)) {
        e.preventDefault();
      }
      setState((s) => {
        if (s.status !== "playing") return s;
        if (k === "ArrowLeft" || k === "a") return movePiece(s, "L");
        if (k === "ArrowRight" || k === "d") return movePiece(s, "R");
        if (k === "ArrowDown" || k === "s") return movePiece(s, "D");
        if (k === "ArrowUp" || k === "w") return rotatePiece(s);
        if (k === " ") return hardDrop(s);
        return s;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => {
      setState((s) => tick(s));
    }, state.tickMs);
    return () => clearInterval(id);
  }, [state.status, state.tickMs]);

  const grid = displayGrid(state);

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-3 flex items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>Score {state.score}</span>
        <span>Lines {state.lines}</span>
        <span>Lv {state.level}</span>
        {state.status === "over" && <span className="text-[var(--coral)]">Game over</span>}
      </div>

      <div
        className="mb-4 grid gap-px rounded-lg bg-[#1e293b] p-1 shadow-lg"
        style={{
          gridTemplateColumns: `repeat(${state.width}, 1fr)`,
          width: "min(80vw, 280px)",
        }}
      >
        {grid.flatMap((row, r) =>
          row.map((cell: Cell, c) => (
            <div
              key={`${r}-${c}`}
              className="aspect-square rounded-[2px]"
              style={{
                background: cell ? COLORS[cell] : "#0f172a",
                boxShadow: cell ? "inset 0 0 0 1px rgba(255,255,255,0.15)" : undefined,
              }}
            />
          )),
        )}
      </div>

      <p className="mb-3 text-center text-xs text-[var(--ink-muted)]">
        ← → move · ↑ rotate · ↓ soft · Space hard drop
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setState((s) => movePiece(s, "L"))}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setState((s) => rotatePiece(s))}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
        >
          ↻
        </button>
        <button
          type="button"
          onClick={() => setState((s) => movePiece(s, "R"))}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => setState((s) => movePiece(s, "D"))}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => setState((s) => hardDrop(s))}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
        >
          Drop
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
