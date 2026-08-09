"use client";

import { useCallback, useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  chooseChessAiMove,
  isLightSquare,
  legalTargets,
  pieceAtVisual,
  squareFromVisual,
  tryPlayerMove,
  type AiDifficulty,
} from "@/lib/entertain/chess-local";

type PieceChar =
  | "♔"
  | "♕"
  | "♖"
  | "♗"
  | "♘"
  | "♙"
  | "♚"
  | "♛"
  | "♜"
  | "♝"
  | "♞"
  | "♟";

const PIECE_MAP: Record<string, PieceChar> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

type GameMode = "ai" | "pvp";

export function ChessGame() {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [targets, setTargets] = useState<Square[]>([]);
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [status, setStatus] = useState("White to move — you are White");
  const game = new Chess(fen);

  const refreshStatus = useCallback((f: string, m: GameMode) => {
    const g = new Chess(f);
    if (g.isCheckmate()) {
      setStatus(
        `Checkmate — ${g.turn() === "w" ? "Black" : "White"} wins!`,
      );
    } else if (g.isStalemate()) {
      setStatus("Stalemate — Draw");
    } else if (g.isDraw()) {
      setStatus("Draw");
    } else if (g.isCheck()) {
      setStatus(`${g.turn() === "w" ? "White" : "Black"} in check`);
    } else if (m === "ai") {
      setStatus(
        g.turn() === "w"
          ? "Your turn (White)"
          : "AI thinking…",
      );
    } else {
      setStatus(`${g.turn() === "w" ? "White" : "Black"} to move`);
    }
  }, []);

  const resetGame = useCallback(() => {
    const g = new Chess();
    setFen(g.fen());
    setSelected(null);
    setTargets([]);
    setHistory([]);
    setThinking(false);
    refreshStatus(g.fen(), mode);
  }, [mode, refreshStatus]);

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (thinking) return;
      const g = new Chess(fen);
      if (g.isGameOver()) return;
      // In AI mode human is always white
      if (mode === "ai" && g.turn() !== "w") return;

      if (selected) {
        if (targets.includes(square)) {
          const result = tryPlayerMove(fen, selected, square);
          if (result) {
            setFen(result.fen);
            setHistory((h) => [...h, result.san]);
            setSelected(null);
            setTargets([]);
            refreshStatus(result.fen, mode);
          }
          return;
        }
        // Reselect own piece
        const piece = g.get(square);
        if (piece && piece.color === g.turn()) {
          setSelected(square);
          setTargets(legalTargets(fen, square));
        } else {
          setSelected(null);
          setTargets([]);
        }
        return;
      }

      const piece = g.get(square);
      if (piece && piece.color === g.turn()) {
        setSelected(square);
        setTargets(legalTargets(fen, square));
      }
    },
    [fen, selected, targets, thinking, mode, refreshStatus],
  );

  // Local AI — no network. Runs after white moves.
  useEffect(() => {
    if (mode !== "ai") return;
    const g = new Chess(fen);
    if (g.isGameOver() || g.turn() !== "b") return;

    let cancelled = false;
    setThinking(true);

    // Yield to paint status, then compute locally (typically <50ms)
    const t = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const san = chooseChessAiMove(fen, difficulty);
        if (cancelled || !san) return;
        const next = new Chess(fen);
        const mv = next.move(san);
        if (mv && !cancelled) {
          setFen(next.fen());
          setHistory((h) => [...h, mv.san]);
          refreshStatus(next.fen(), mode);
        }
      } finally {
        if (!cancelled) setThinking(false);
      }
    }, 20);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fen, mode, difficulty, refreshStatus]);

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      {/* Mode */}
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-[var(--ink-muted)]">Mode:</span>
        {(["ai", "pvp"] as GameMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              const g = new Chess();
              setFen(g.fen());
              setSelected(null);
              setTargets([]);
              setHistory([]);
              setThinking(false);
              refreshStatus(g.fen(), m);
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
            <span className="ml-2 text-xs text-[var(--ink-muted)]">Level:</span>
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

      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{status}</span>
        {thinking && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
        )}
      </div>

      {/* Board: white at bottom, a1 dark bottom-left */}
      <div className="mb-4 rounded-xl border-4 border-[#6b4c2a] bg-[#6b4c2a] p-1 shadow-lg">
        <div
          className="grid aspect-square grid-cols-8 overflow-hidden rounded-sm"
          style={{ width: "min(85vw, 480px)" }}
          role="grid"
          aria-label="Chess board"
        >
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => {
              const square = squareFromVisual(row, col);
              const piece = pieceAtVisual(game, row, col);
              const light = isLightSquare(row, col);
              const isSelected = selected === square;
              const isTarget = targets.includes(square);
              const inCheck =
                !!piece &&
                piece.type === "k" &&
                game.isCheck() &&
                piece.color === game.turn();

              return (
                <button
                  key={square}
                  type="button"
                  role="gridcell"
                  aria-label={
                    piece
                      ? `${piece.color === "w" ? "White" : "Black"} ${piece.type} on ${square}`
                      : square
                  }
                  onClick={() => handleSquareClick(square)}
                  disabled={thinking}
                  className={`relative flex aspect-square items-center justify-center text-[clamp(1.4rem,5vw,2.8rem)] select-none
                    ${light ? "bg-[#eed7b0]" : "bg-[#b58863]"}
                    ${isSelected ? "ring-2 ring-inset ring-[var(--teal)]" : ""}
                    ${inCheck ? "bg-[#e85d5d]/85" : ""}
                    ${thinking ? "cursor-wait" : "hover:brightness-95"}
                  `}
                >
                  {isTarget && !piece && (
                    <span className="absolute h-3 w-3 rounded-full bg-[var(--teal)]/45" />
                  )}
                  {isTarget && piece && (
                    <span className="absolute inset-0.5 rounded-sm ring-2 ring-[var(--teal)]/70" />
                  )}
                  {piece
                    ? PIECE_MAP[
                        piece.color === "w"
                          ? piece.type.toUpperCase()
                          : piece.type
                      ]
                    : null}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetGame}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          New Game
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-4 w-full max-w-md rounded-xl bg-[var(--surface)] p-3 shadow-sm ring-1 ring-[var(--line)]">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Moves
          </h3>
          <div className="max-h-32 overflow-auto text-xs text-[var(--ink)]">
            {history.map((m, i) => (
              <span key={`${i}-${m}`} className="mr-2">
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}
                {m}{" "}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
