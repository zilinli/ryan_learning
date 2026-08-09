"use client";

import { useCallback, useEffect, useState } from "react";
import {
  initGomoku,
  placeGomoku,
  type GomokuState,
} from "@/lib/entertain/gomoku";
import {
  chooseGomokuAiMove,
  AI_DIFFICULTIES,
  type AiDifficulty,
} from "@/lib/entertain/gomoku-local";

type GameMode = "ai" | "pvp";

export function GomokuGame() {
  const [state, setState] = useState<GomokuState>(() => initGomoku(15));
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [aiBusy, setAiBusy] = useState(false);

  const reset = useCallback(() => {
    setState(initGomoku(15));
    setAiBusy(false);
  }, []);

  const onCell = useCallback(
    (row: number, col: number) => {
      if (aiBusy || state.status !== "playing") return;
      if (mode === "ai" && state.turn !== "black") return;
      setState((prev) => placeGomoku(prev, row, col));
    },
    [aiBusy, mode, state.status, state.turn],
  );

  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || state.turn !== "white") {
      setAiBusy(false);
      return;
    }

    let alive = true;
    setAiBusy(true);

    const id = window.setTimeout(() => {
      if (!alive) return;
      try {
        const move = chooseGomokuAiMove(state, difficulty);
        if (!alive || !move) return;
        const [r, c] = move.split(",").map(Number);
        setState((prev) => placeGomoku(prev, r, c));
      } catch (err) {
        console.error("[Gomoku AI]", err);
      } finally {
        if (alive) setAiBusy(false);
      }
    }, 40);

    return () => {
      alive = false;
      clearTimeout(id);
      setAiBusy(false);
    };
  }, [state, mode, difficulty]);

  const status =
    state.status === "black_win"
      ? "Black wins!"
      : state.status === "white_win"
        ? "White wins!"
        : state.status === "draw"
          ? "Draw"
          : aiBusy
            ? "AI thinking…"
            : state.turn === "black"
              ? "Black to move"
              : "White to move";

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-[var(--ink-muted)]">Mode:</span>
        {(["ai", "pvp"] as GameMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              reset();
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              mode === m
                ? "bg-[var(--teal)] text-white"
                : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            }`}
          >
            {m === "ai" ? "vs AI" : "2 Players"}
          </button>
        ))}
        {mode === "ai" && (
          <>
            <span className="ml-1 text-xs text-[var(--ink-muted)]">Level:</span>
            {AI_DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  difficulty === d
                    ? "bg-[var(--coral)] text-white"
                    : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--mist)]"
                }`}
              >
                {d}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-[var(--line)]">
        <span>{status}</span>
        {aiBusy && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
        )}
      </div>

      <div
        className="mb-4 grid rounded-lg border-4 border-[#6b4c2a] bg-[#deb887] p-1 shadow-lg"
        style={{
          gridTemplateColumns: `repeat(${state.size}, 1fr)`,
          width: "min(92vw, 480px)",
        }}
      >
        {Array.from({ length: state.size }, (_, row) =>
          Array.from({ length: state.size }, (_, col) => {
            const stone = state.board[row][col];
            const last =
              state.lastMove?.row === row && state.lastMove?.col === col;
            return (
              <button
                key={`${row},${col}`}
                type="button"
                onClick={() => onCell(row, col)}
                disabled={aiBusy || state.status !== "playing" || !!stone}
                className="relative aspect-square"
              >
                <span
                  className="absolute inset-[18%] rounded-full"
                  style={
                    stone
                      ? {
                          background:
                            stone === "black"
                              ? "radial-gradient(circle at 35% 30%, #555, #111)"
                              : "radial-gradient(circle at 35% 30%, #fefefe, #bbb)",
                          boxShadow: last
                            ? "0 0 0 2px var(--teal)"
                            : "0 1px 2px rgba(0,0,0,0.35)",
                        }
                      : undefined
                  }
                />
              </button>
            );
          }),
        )}
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
      >
        New Game
      </button>
    </div>
  );
}
