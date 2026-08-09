"use client";

import { useCallback, useEffect, useState } from "react";
import {
  initGo,
  passTurn,
  placeStone,
  resign,
  type GoPosition,
  type GoState,
} from "@/lib/entertain/go-logic";
import {
  chooseGoAiMove,
  AI_DIFFICULTIES,
  type AiDifficulty,
} from "@/lib/entertain/go-local";

type GameMode = "ai" | "pvp";

export function GoGame() {
  const [state, setState] = useState<GoState>(() => initGo(9));
  const [aiBusy, setAiBusy] = useState(false);
  const [hoverCell, setHoverCell] = useState<GoPosition | null>(null);
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (aiBusy || state.status !== "playing") return;
      if (mode === "ai" && state.turn !== "black") return;

      const newState = placeStone(state, { row, col });
      if (newState !== state) setState(newState);
    },
    [state, aiBusy, mode],
  );

  const handlePass = useCallback(() => {
    if (aiBusy || state.status !== "playing") return;
    if (mode === "ai" && state.turn !== "black") return;
    setState((prev) => passTurn(prev));
  }, [aiBusy, mode, state.status, state.turn]);

  const handleResign = useCallback(() => {
    if (state.status !== "playing") return;
    setState((prev) => resign(prev));
  }, [state.status]);

  // Local AI — same pattern as Chess
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
        const move = chooseGoAiMove(state, difficulty);
        if (!alive) return;
        if (!move || move === "pass") {
          setState((prev) => passTurn(prev));
        } else {
          const [r, c] = move.split(",").map(Number);
          setState((prev) => placeStone(prev, { row: r, col: c }));
        }
      } catch (err) {
        console.error("[Go AI]", err);
        setState((prev) => passTurn(prev));
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

  const resetGame = useCallback(() => {
    setState(initGo(9));
    setAiBusy(false);
  }, []);

  const statusText = (() => {
    if (state.status === "black_win") return "Black wins!";
    if (state.status === "white_win") return "White wins!";
    if (state.status === "scoring") return "Both passed — game over";
    if (aiBusy) return "AI thinking…";
    if (state.turn === "black") return "Black to move";
    return "White to move";
  })();

  const starPoints = [2, 4, 6].flatMap((r) => [2, 4, 6].map((c) => ({ row: r, col: c })));
  const currentPlayerCanAct = mode === "pvp" || state.turn === "black";

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
              resetGame();
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

      <div className="mb-2 flex gap-6 text-xs text-[var(--ink-muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#222] ring-1 ring-[var(--line)]" /> Captures: {state.capturedWhite}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-white ring-1 ring-[var(--line)]" /> Captures: {state.capturedBlack}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{statusText}</span>
        {aiBusy && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
        )}
      </div>

      <div className="mb-4 rounded-xl border-4 border-[#6b4c2a] bg-[#d4a76a] p-2 shadow-lg">
        <div
          className="relative grid overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${state.size}, 1fr)`,
            gridTemplateRows: `repeat(${state.size}, 1fr)`,
            width: "min(85vw, 420px)",
            aspectRatio: "1/1",
          }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)`,
              backgroundSize: `${100 / state.size}% ${100 / state.size}%`,
            }}
            aria-hidden
          />

          {Array.from({ length: state.size }, (_, row) =>
            Array.from({ length: state.size }, (_, col) => {
              const cell = state.board[row][col];
              const isEmpty = cell === null;
              const isHovered = hoverCell?.row === row && hoverCell?.col === col;
              const isStar = starPoints.some((p) => p.row === row && p.col === col);

              return (
                <button
                  key={`${row},${col}`}
                  type="button"
                  onClick={() => handleCellClick(row, col)}
                  onMouseEnter={() => setHoverCell({ row, col })}
                  onMouseLeave={() => setHoverCell(null)}
                  disabled={aiBusy || state.status !== "playing"}
                  className="relative z-10 flex aspect-square items-center justify-center"
                >
                  {cell ? (
                    <span
                      className="flex h-[85%] w-[85%] items-center justify-center rounded-full text-lg shadow-md transition-all"
                      style={{
                        background:
                          cell === "black"
                            ? "radial-gradient(circle at 35% 30%, #555, #111)"
                            : "radial-gradient(circle at 35% 30%, #fff, #ccc)",
                      }}
                    />
                  ) : isHovered && currentPlayerCanAct && state.status === "playing" ? (
                    <span
                      className="flex h-[85%] w-[85%] items-center justify-center rounded-full opacity-30"
                      style={{
                        background:
                          state.turn === "black"
                            ? "radial-gradient(circle at 35% 30%, #555, #111)"
                            : "radial-gradient(circle at 35% 30%, #fff, #ccc)",
                      }}
                    />
                  ) : null}
                  {isStar && isEmpty && (
                    <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-[#222]/40" aria-hidden />
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {state.status === "playing" && currentPlayerCanAct && (
          <>
            <button
              type="button"
              onClick={handlePass}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
            >
              Pass
            </button>
            <button
              type="button"
              onClick={handleResign}
              className="rounded-full border border-[var(--coral)]/30 px-4 py-2 text-sm font-medium text-[var(--coral)] transition hover:bg-[var(--coral)]/10"
            >
              Resign
            </button>
          </>
        )}
        <button
          type="button"
          onClick={resetGame}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
