"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLevelCount,
  initSokoban,
  movePlayer,
  undoMove,
  type Direction,
  type SokobanState,
} from "@/lib/entertain/sokoban";

export function SokobanGame() {
  const [state, setState] = useState<SokobanState>(() => initSokoban(0));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state.solved) setMessage(`Solved in ${state.moveCount} moves!`);
  }, [state.solved, state.moveCount]);

  const handleMove = useCallback((dir: Direction) => {
    setState((prev) => movePlayer(prev, dir));
  }, []);

  const handleUndo = useCallback(() => {
    setState((prev) => undoMove(prev));
    setMessage(null);
  }, []);

  const handleReset = useCallback(() => {
    setState(initSokoban(state.levelIndex));
    setMessage(null);
  }, [state.levelIndex]);

  const changeLevel = useCallback((delta: number) => {
    setState((prev) => {
      const total = getLevelCount();
      const next = (prev.levelIndex + delta + total) % total;
      return initSokoban(next);
    });
    setMessage(null);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") handleMove("up");
      else if (e.key === "ArrowDown") handleMove("down");
      else if (e.key === "ArrowLeft") handleMove("left");
      else if (e.key === "ArrowRight") handleMove("right");
      else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMove, handleUndo]);

  const cellColor = (cell: string): { bg: string; content: string } => {
    switch (cell) {
      case "#": return { bg: "bg-[#6b4c2a]", content: "" };
      case ".": return { bg: "bg-[#e8d5b0]", content: "·" };
      case "$": return { bg: "bg-[#e8d5b0]", content: "📦" };
      case "*": return { bg: "bg-[#e8d5b0]", content: "✅" };
      case "@": return { bg: "bg-[#e8d5b0]", content: "🧑" };
      case "+": return { bg: "bg-[#e8d5b0]", content: "🧑" };
      default: return { bg: "bg-[#e8d5b0]", content: "" };
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      {/* Info bar */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>Level {state.levelIndex + 1}/{getLevelCount()}</span>
        <span className="text-[var(--ink-muted)]">Moves: {state.moveCount}</span>
        <span className="text-[var(--ink-muted)]">Pushes: {state.pushCount}</span>
        {message && <span className="text-[var(--teal)]">{message}</span>}
      </div>

      {/* Board */}
      <div className="mb-4 rounded-lg border-2 border-[#6b4c2a] shadow-lg">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${state.grid[0].length}, 1fr)`,
            gridTemplateRows: `repeat(${state.grid.length}, 1fr)`,
          }}
        >
          {state.grid.map((row, r) =>
            row.map((cell, c) => {
              const { bg, content } = cellColor(cell);
              return (
                <div
                  key={`${r},${c}`}
                  className={`flex aspect-square items-center justify-center text-[clamp(0.6rem,2.5vw,1.1rem)] ${bg}`}
                  style={{ width: "min(8vw, 36px)", height: "min(8vw, 36px)" }}
                >
                  {content}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* D-pad */}
      <div className="mb-4 grid grid-cols-3 gap-1">
        <div />
        <button
          type="button"
          onClick={() => handleMove("up")}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-lg transition active:scale-95 active:bg-[var(--mist)]"
          aria-label="Move up"
        >
          ↑
        </button>
        <div />
        <button
          type="button"
          onClick={() => handleMove("left")}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-lg transition active:scale-95 active:bg-[var(--mist)]"
          aria-label="Move left"
        >
          ←
        </button>
        <div className="flex h-12 w-12 items-center justify-center text-xs text-[var(--ink-muted)]">
          move
        </div>
        <button
          type="button"
          onClick={() => handleMove("right")}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-lg transition active:scale-95 active:bg-[var(--mist)]"
          aria-label="Move right"
        >
          →
        </button>
        <div />
        <button
          type="button"
          onClick={() => handleMove("down")}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-lg transition active:scale-95 active:bg-[var(--mist)]"
          aria-label="Move down"
        >
          ↓
        </button>
        <div />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleUndo}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={() => changeLevel(-1)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => changeLevel(1)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
