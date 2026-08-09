"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cellKey,
  getLegalMoves,
  initXiangqi,
  pieceChar,
  selectCell,
  type XiangqiPosition,
  type XiangqiState,
} from "@/lib/entertain/xiangqi";

type GameMode = "ai" | "pvp";

export function XiangqiGame() {
  const [state, setState] = useState<XiangqiState>(initXiangqi);
  const [legalMoves, setLegalMoves] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>("ai");

  useEffect(() => {
    if (state.selectedCell) {
      const moves = getLegalMoves(state.board, state.selectedCell);
      setLegalMoves(new Set(moves.map((m) => cellKey(m.row, m.col))));
    } else {
      setLegalMoves(new Set());
    }
  }, [state.selectedCell, state.board]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (thinking || state.status !== "playing") return;
      if (mode === "ai" && state.turn !== "red") return;
      setState((prev) => selectCell(prev, { row, col }));
    },
    [state.turn, state.status, thinking, mode],
  );

  // AI move
  useEffect(() => {
    if (thinking || state.status !== "playing" || mode !== "ai" || state.turn === "red") return;

    const makeAiMove = async () => {
      setThinking(true);
      setError(null);
      try {
        const boardDesc = state.board
          .map((row) => row.map((cell) => (cell || "·")).join(" "))
          .join("\n");
        const history = state.moveHistory
          .map((m) => `${m.from.row},${m.from.col}-${m.to.row},${m.to.col}`)
          .join("; ");

        const res = await fetch("/api/entertain-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: "xiangqi", boardState: boardDesc, moveHistory: history, playerColor: "black" }),
        });

        if (!res.ok) throw new Error(`AI error: ${res.status}`);
        const data = await res.json();
        const moveStr = data.move?.trim();

        if (moveStr) {
          const parts = moveStr.split("-");
          const fromParts = parts[0]?.split(",").map(Number);
          const toParts = parts[1]?.split(",").map(Number);
          if (fromParts?.length === 2 && toParts?.length === 2) {
            const from: XiangqiPosition = { row: fromParts[0], col: fromParts[1] };
            const to: XiangqiPosition = { row: toParts[0], col: toParts[1] };
            setState((prev) => {
              if (prev.board[from.row][from.col]) {
                return selectCell({ ...prev, selectedCell: from }, to);
              }
              return prev;
            });
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "AI unavailable");
      } finally {
        setThinking(false);
      }
    };

    const timer = setTimeout(makeAiMove, 300);
    return () => clearTimeout(timer);
  }, [state.turn, state.status, state.board, state.moveHistory, thinking, mode]);

  const resetGame = useCallback(() => {
    setState(initXiangqi());
    setThinking(false);
    setError(null);
    setLegalMoves(new Set());
  }, []);

  const statusText = (() => {
    if (state.status === "red_win") return "Red wins!";
    if (state.status === "black_win") return "Black wins!";
    if (thinking) return "AI thinking…";
    if (state.turn === "red") return "Red to move";
    return "Black to move";
  })();

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      {/* Mode selector */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-[var(--ink-muted)]">Mode:</span>
        {(["ai", "pvp"] as GameMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); resetGame(); }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              mode === m ? "bg-[var(--teal)] text-white" : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            }`}
          >
            {m === "ai" ? "vs AI" : "2 Players"}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{statusText}</span>
        {thinking && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />}
        {error && <span className="text-xs text-[var(--coral)]">{error}</span>}
      </div>

      {/* Board */}
      <div className="mb-4 rounded-xl border-4 border-[#7a5a3a] bg-[#d4a76a] p-2 shadow-lg">
        <div className="grid overflow-hidden rounded-sm"
          style={{ gridTemplateColumns: "repeat(9, 1fr)", gridTemplateRows: "repeat(10, 1fr)", width: "min(85vw, 500px)", aspectRatio: "9/10" }}
        >
          {Array.from({ length: 10 }, (_, row) =>
            Array.from({ length: 9 }, (_, col) => {
              const piece = state.board[row][col];
              const isRed = piece && "RNBAKCP".includes(piece);
              const isSelected = state.selectedCell?.row === row && state.selectedCell?.col === col;
              const isLegal = legalMoves.has(cellKey(row, col));
              const isRiver = row === 4;

              return (
                <button
                  key={cellKey(row, col)}
                  type="button"
                  onClick={() => handleCellClick(row, col)}
                  disabled={thinking || state.status !== "playing"}
                  className={`relative flex aspect-square items-center justify-center text-[clamp(1rem,3.2vw,1.5rem)] select-none transition-all
                    ${isRiver ? "border-b-2 border-[var(--ink-muted)]/30" : ""}
                    ${isSelected ? "ring-2 ring-[var(--teal)] ring-inset bg-[var(--teal)]/20" : ""}
                    ${isLegal ? "after:absolute after:inset-0 after:m-auto after:h-3 after:w-3 after:rounded-full after:bg-[var(--teal)]/50" : ""}
                    hover:bg-[#c09050]/50
                  `}
                >
                  {piece ? (
                    <span className={`flex h-[clamp(1.6rem,6vw,2.4rem)] w-[clamp(1.6rem,6vw,2.4rem)] items-center justify-center rounded-full border-2
                      ${isRed ? "border-[#c44] bg-[#faf0e0] text-[#c44]" : "border-[#333] bg-[#faf0e0] text-[#222]"}`}
                      style={{ fontSize: "clamp(0.7rem, 2.5vw, 1rem)" }}
                    >
                      {pieceChar(piece)}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={resetGame} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]">
          New Game
        </button>
      </div>

      {state.moveHistory.length > 0 && (
        <div className="mt-4 w-full max-w-md rounded-xl bg-[var(--surface)] p-3 shadow-sm ring-1 ring-[var(--line)]">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Moves</h3>
          <div className="max-h-32 overflow-auto text-xs text-[var(--ink)]">
            {state.moveHistory.map((m, i) => (
              <span key={i} className="mr-2">{i + 1}. ({m.from.row},{m.from.col})→({m.to.row},{m.to.col})</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
