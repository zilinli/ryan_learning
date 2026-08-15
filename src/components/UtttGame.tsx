"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyMove,
  getLegalMoves,
  initUttt,
  type UtttState,
} from "@/lib/entertain/uttt";
import {
  chooseUtttAiMove,
  type AiDifficulty,
} from "@/lib/entertain/uttt-local";

type GameMode = "ai" | "pvp";

export function UtttGame() {
  const [state, setState] = useState<UtttState>(() => initUttt());
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [aiBusy, setAiBusy] = useState(false);

  const reset = useCallback(() => {
    setState(initUttt());
    setAiBusy(false);
  }, []);

  const legal = new Set(getLegalMoves(state));

  const onCell = useCallback(
    (board: number, cell: number) => {
      if (aiBusy) return;
      const key = `${board},${cell}`;
      setState((prev) => {
        if (prev.status !== "playing") return prev;
        if (mode === "ai" && prev.turn !== "X") return prev;
        if (!getLegalMoves(prev).includes(key)) return prev;
        return applyMove(prev, key);
      });
    },
    [aiBusy, mode],
  );

  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || state.turn !== "O") {
      setAiBusy(false);
      return;
    }

    let alive = true;
    setAiBusy(true);

    const id = window.setTimeout(() => {
      if (!alive) return;
      try {
        const move = chooseUtttAiMove(state, difficulty);
        if (!alive || !move) return;
        setState((prev) => applyMove(prev, move));
      } catch (err) {
        console.error("[UTTT AI]", err);
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
    state.status === "X_win"
      ? "X wins!"
      : state.status === "O_win"
        ? "O wins!"
        : state.status === "draw"
          ? "Draw"
          : aiBusy
            ? "AI thinking…"
            : state.turn === "X"
              ? "X to move"
              : "O to move";

  const constrained =
    state.activeBoard !== null && state.winners[state.activeBoard] === null;

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
            {(["easy", "medium", "hard"] as AiDifficulty[]).map((d) => (
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
        {constrained && state.status === "playing" && (
          <span className="text-xs text-[var(--ink-muted)]">
            · play in highlighted board
          </span>
        )}
      </div>

      <div
        className="mb-4 grid gap-1.5 rounded-xl bg-[#1e293b]/10 p-2 shadow-lg ring-1 ring-[var(--line)]"
        style={{
          gridTemplateColumns: "repeat(3, 1fr)",
          width: "min(92vw, 420px)",
        }}
      >
        {Array.from({ length: 9 }, (_, board) => {
          const winner = state.winners[board];
          const mustPlayHere =
            state.status === "playing" &&
            state.activeBoard === board &&
            winner === null;
          const freeChoiceHighlight =
            state.status === "playing" &&
            state.activeBoard === null &&
            winner === null;

          return (
            <div
              key={board}
              className={`relative grid aspect-square gap-0.5 rounded-md p-1 transition ${
                mustPlayHere || freeChoiceHighlight
                  ? "bg-[var(--teal)]/15 ring-2 ring-[var(--teal)]"
                  : winner
                    ? "bg-[var(--mist)] opacity-90"
                    : "bg-[var(--surface)] opacity-50"
              }`}
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
            >
              {Array.from({ length: 9 }, (_, cell) => {
                const mark = state.boards[board][cell];
                const key = `${board},${cell}`;
                const canClick =
                  !aiBusy &&
                  state.status === "playing" &&
                  legal.has(key) &&
                  (mode === "pvp" || state.turn === "X");
                const last =
                  state.lastMove?.board === board &&
                  state.lastMove?.cell === cell;

                return (
                  <button
                    key={cell}
                    type="button"
                    disabled={!canClick}
                    onClick={() => onCell(board, cell)}
                    className={`flex aspect-square items-center justify-center rounded-sm text-sm font-bold transition ${
                      canClick ? "hover:bg-[var(--teal)]/20" : ""
                    } ${last ? "ring-2 ring-[var(--coral)]" : "bg-[var(--surface-muted)]"}`}
                    aria-label={`Board ${board} cell ${cell}`}
                  >
                    {mark === "X" && (
                      <span className="text-[#0ea5e9]">X</span>
                    )}
                    {mark === "O" && (
                      <span className="text-[var(--coral)]">O</span>
                    )}
                  </button>
                );
              })}

              {winner && winner !== "draw" && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/10 text-5xl font-black opacity-40"
                  aria-hidden
                >
                  <span className={winner === "X" ? "text-[#0ea5e9]" : "text-[var(--coral)]"}>
                    {winner}
                  </span>
                </div>
              )}
              {winner === "draw" && (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/5 text-2xl font-bold text-[var(--ink-muted)] opacity-50"
                  aria-hidden
                >
                  =
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mb-3 max-w-sm text-center text-xs text-[var(--ink-muted)]">
        Win 3 small boards in a row. Your cell sends the opponent to that board.
      </p>

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
