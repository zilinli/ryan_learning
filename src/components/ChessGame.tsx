"use client";

import { useCallback, useEffect, useState } from "react";
import { Chess } from "chess.js";

type PieceChar = "♔" | "♕" | "♖" | "♗" | "♘" | "♙" | "♚" | "♛" | "♜" | "♝" | "♞" | "♟";

const PIECE_MAP: Record<string, PieceChar> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

type Square = string;
type GameMode = "ai" | "pvp";

export function ChessGame() {
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [thinking, setThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("White to move");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>("ai");

  const updateStatus = useCallback((g: Chess) => {
    if (g.isCheckmate()) {
      setStatus(`Checkmate — ${g.turn() === "w" ? "Black" : "White"} wins!`);
    } else if (g.isDraw()) {
      setStatus("Draw!");
    } else if (g.isStalemate()) {
      setStatus("Stalemate — Draw!");
    } else if (g.isCheck()) {
      setStatus(`${g.turn() === "w" ? "White" : "Black"} in check`);
    } else {
      setStatus(`${g.turn() === "w" ? "White" : "Black"} to move`);
    }
  }, []);

  const handleCellClick = useCallback(
    (square: Square) => {
      if (thinking || game.isGameOver()) return;
      if (mode === "ai" && game.turn() !== "w") return;

      if (selected) {
        const moves = game.moves({ square: selected, verbose: true });
        const validTargets = moves.map((m) => m.to);
        if (validTargets.includes(square)) {
          try {
            const promotion = square[1] === "8" || square[1] === "1" ? "q" : undefined;
            const newGame = new Chess(game.fen());
            newGame.move({ from: selected, to: square, promotion });
            setGame(newGame);
            setSelected(null);
            setLegalMoves([]);
            setMoveHistory((h) => [...h, `${selected}${square}`]);
            updateStatus(newGame);
          } catch {
            setSelected(null);
            setLegalMoves([]);
          }
        } else {
          const piece = game.get(square);
          if (piece && piece.color === game.turn()) {
            setSelected(square);
            const moves = game.moves({ square, verbose: true });
            setLegalMoves(moves.map((m) => m.to));
          } else {
            setSelected(null);
            setLegalMoves([]);
          }
        }
      } else {
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          setSelected(square);
          const moves = game.moves({ square, verbose: true });
          setLegalMoves(moves.map((m) => m.to));
        }
      }
    },
    [game, selected, thinking, mode, updateStatus],
  );

  // AI move (only in ai mode)
  useEffect(() => {
    if (thinking || game.isGameOver() || mode !== "ai" || game.turn() === "w") return;

    const makeAiMove = async () => {
      setThinking(true);
      setError(null);
      try {
        const res = await fetch("/api/entertain-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: "chess",
            boardState: game.fen(),
            moveHistory: game.history().join(" "),
            playerColor: "black",
          }),
        });

        if (!res.ok) throw new Error(`AI error: ${res.status}`);
        const data = await res.json();
        const aiMove = data.move?.trim();

        if (aiMove) {
          const newGame = new Chess(game.fen());
          try {
            const result = newGame.move(aiMove);
            if (result) {
              setGame(newGame);
              setMoveHistory((h) => [...h, aiMove]);
              updateStatus(newGame);
            }
          } catch {
            const moves = newGame.moves();
            if (moves.length > 0) {
              newGame.move(moves[Math.floor(Math.random() * moves.length)]);
              setGame(newGame);
              updateStatus(newGame);
            }
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
  }, [game, thinking, mode, updateStatus]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setSelected(null);
    setLegalMoves([]);
    setMoveHistory([]);
    setThinking(false);
    setError(null);
    updateStatus(newGame);
  }, [updateStatus]);

  const board = game.board();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

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
              mode === m
                ? "bg-[var(--teal)] text-white"
                : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            }`}
          >
            {m === "ai" ? "vs AI" : "2 Players"}
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{status}</span>
        {thinking && (
          <span className="flex items-center gap-1 text-[var(--teal)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
            AI thinking…
          </span>
        )}
        {error && <span className="text-xs text-[var(--coral)]">{error}</span>}
      </div>

      {/* Board */}
      <div className="mb-4 rounded-xl border-4 border-[#6b4c2a] bg-[#6b4c2a] p-1 shadow-lg">
        <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-sm"
          style={{ width: "min(85vw, 480px)" }}
        >
          {Array.from({ length: 8 }, (_, row) =>
            Array.from({ length: 8 }, (_, col) => {
              const r = 7 - row;
              const c = col;
              const square = `${files[c]}${r + 1}` as Square;
              const piece = board[r][c];
              const isLight = (r + c) % 2 === 0;
              const isSelected = selected === square;
              const isLegalTarget = legalMoves.includes(square);
              const isCheck = piece?.type === "k" && game.isCheck() && piece.color === game.turn();

              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => handleCellClick(square)}
                  className={`relative flex aspect-square items-center justify-center text-[clamp(1.4rem,5vw,2.8rem)] transition-all select-none
                    ${isLight ? "bg-[#e8d5b0]" : "bg-[#a87c51]"}
                    ${isSelected ? "ring-2 ring-[var(--teal)] ring-inset" : ""}
                    ${isLegalTarget ? "after:absolute after:inset-0 after:m-auto after:h-3 after:w-3 after:rounded-full after:bg-[var(--teal)]/50" : ""}
                    ${isCheck ? "bg-[var(--coral)]/80" : ""}
                    hover:opacity-90
                  `}
                >
                  {piece ? PIECE_MAP[piece.color === "w" ? piece.type.toUpperCase() : piece.type] ?? null : null}
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

      {moveHistory.length > 0 && (
        <div className="mt-4 w-full max-w-md rounded-xl bg-[var(--surface)] p-3 shadow-sm ring-1 ring-[var(--line)]">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Moves</h3>
          <div className="max-h-32 overflow-auto text-xs text-[var(--ink)]">
            {moveHistory.map((m, i) => (
              <span key={i} className="mr-2">
                {Math.floor(i / 2) + 1}.{i % 2 === 0 ? "" : "…"} {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
