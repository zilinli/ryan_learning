"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  assertBoardMapping,
  chooseChessAiMove,
  isLightSquare,
  legalTargets,
  pieceAtVisual,
  squareFromVisual,
  statusText,
  tryPlayerMove,
  type AiDifficulty,
  AI_DIFFICULTIES,
} from "@/lib/entertain/chess-local";

type GameMode = "ai" | "pvp";

/** Same glyph set for both sides; color via CSS (Unicode “white” glyphs often render identical). */
const GLYPH: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

export function ChessGame() {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [targets, setTargets] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [history, setHistory] = useState<string[]>([]);
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("hard");
  const [aiBusy, setAiBusy] = useState(false);

  const game = useMemo(() => new Chess(fen), [fen]);
  const turn = game.turn();
  const over = game.isGameOver();
  const humanCanMove = !over && !aiBusy && (mode === "pvp" || turn === "w");

  const status = statusText(fen, mode);

  // Dev-time invariant: mapping must stay consistent
  if (process.env.NODE_ENV !== "production" && !assertBoardMapping(game)) {
    console.error("[Chess] board mapping mismatch");
  }

  const startFresh = useCallback((m: GameMode) => {
    const g = new Chess();
    setFen(g.fen());
    setSelected(null);
    setTargets([]);
    setLastMove(null);
    setHistory([]);
    setAiBusy(false);
    setMode(m);
  }, []);

  const onSquareClick = useCallback(
    (square: Square) => {
      if (!humanCanMove) return;

      if (selected) {
        if (targets.includes(square)) {
          const result = tryPlayerMove(fen, selected, square);
          if (result) {
            setFen(result.fen);
            setHistory((h) => [...h, result.san]);
            setLastMove({ from: result.from, to: result.to });
            setSelected(null);
            setTargets([]);
          }
          return;
        }
        const piece = game.get(square);
        if (piece && piece.color === turn) {
          setSelected(square);
          setTargets(legalTargets(fen, square));
        } else {
          setSelected(null);
          setTargets([]);
        }
        return;
      }

      const piece = game.get(square);
      if (piece && piece.color === turn) {
        setSelected(square);
        setTargets(legalTargets(fen, square));
      }
    },
    [humanCanMove, selected, targets, fen, game, turn],
  );

  // Local AI — never leave aiBusy stuck
  useEffect(() => {
    if (mode !== "ai" || over || turn !== "b") {
      setAiBusy(false);
      return;
    }

    let alive = true;
    setAiBusy(true);

    const id = window.setTimeout(() => {
      if (!alive) return;
      try {
        const san = chooseChessAiMove(fen, difficulty);
        if (!alive || !san) return;
        const next = new Chess(fen);
        const mv = next.move(san);
        if (!mv || !alive) return;
        setFen(next.fen());
        setHistory((h) => [...h, mv.san]);
        setLastMove({ from: mv.from, to: mv.to });
        setSelected(null);
        setTargets([]);
      } catch (err) {
        console.error("[Chess AI]", err);
      } finally {
        if (alive) setAiBusy(false);
      }
    }, 40);

    return () => {
      alive = false;
      clearTimeout(id);
      // Ensure UI unlocks if effect is cancelled mid-flight
      setAiBusy(false);
    };
  }, [fen, mode, difficulty, turn, over]);

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-[var(--ink-muted)]">Mode:</span>
        {(["ai", "pvp"] as GameMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => startFresh(m)}
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

      <div className="mb-3 flex min-h-10 items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{status}</span>
        {aiBusy && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
        )}
      </div>

      {/* Board + file labels */}
      <div className="mb-4 flex flex-col items-center">
        <div className="flex">
          {/* rank labels */}
          <div
            className="mr-1 flex flex-col justify-around py-1 text-[10px] text-[var(--ink-muted)]"
            style={{ height: "min(85vw, 480px)" }}
            aria-hidden
          >
            {[8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
              <span key={n} className="flex flex-1 items-center">
                {n}
              </span>
            ))}
          </div>

          <div className="rounded-xl border-4 border-[#5c4030] bg-[#5c4030] p-1 shadow-lg">
            <div
              className="grid grid-cols-8 overflow-hidden rounded-sm"
              style={{ width: "min(85vw, 480px)", aspectRatio: "1" }}
              role="grid"
              aria-label="Chess board, white at bottom"
            >
              {Array.from({ length: 8 }, (_, row) =>
                Array.from({ length: 8 }, (_, col) => {
                  const square = squareFromVisual(row, col);
                  const piece = pieceAtVisual(game, row, col);
                  const light = isLightSquare(row, col);
                  const isSelected = selected === square;
                  const isTarget = targets.includes(square);
                  const isLast =
                    lastMove?.from === square || lastMove?.to === square;
                  const inCheck =
                    !!piece &&
                    piece.type === "k" &&
                    game.isCheck() &&
                    piece.color === turn;

                  return (
                    <button
                      key={square}
                      type="button"
                      role="gridcell"
                      aria-label={
                        piece
                          ? `${piece.color === "w" ? "White" : "Black"} ${piece.type} ${square}`
                          : square
                      }
                      onClick={() => onSquareClick(square)}
                      className={`relative flex items-center justify-center select-none
                        ${light ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                        ${isLast ? "brightness-110 ring-1 ring-inset ring-amber-400/80" : ""}
                        ${isSelected ? "ring-2 ring-inset ring-[var(--teal)]" : ""}
                        ${inCheck ? "!bg-[#e07070]" : ""}
                        ${humanCanMove ? "cursor-pointer hover:brightness-95" : "cursor-default"}
                      `}
                    >
                      {isTarget && !piece && (
                        <span className="pointer-events-none absolute h-[28%] w-[28%] rounded-full bg-[var(--teal)]/50" />
                      )}
                      {isTarget && piece && (
                        <span className="pointer-events-none absolute inset-[6%] rounded-sm ring-[3px] ring-[var(--teal)]/70" />
                      )}
                      {piece ? (
                        <span
                          className="pointer-events-none leading-none"
                          style={{
                            fontSize: "clamp(1.5rem, 6vw, 2.75rem)",
                            color: piece.color === "w" ? "#f8f4ec" : "#111",
                            textShadow:
                              piece.color === "w"
                                ? "0 0 1px #222, 0 1px 2px rgba(0,0,0,.45), 1px 0 0 #333, -1px 0 0 #333, 0 1px 0 #333, 0 -1px 0 #333"
                                : "0 1px 1px rgba(255,255,255,.15)",
                          }}
                        >
                          {GLYPH[piece.type]}
                        </span>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </div>

        {/* file labels */}
        <div
          className="mt-1 flex justify-around pl-4 text-[10px] text-[var(--ink-muted)]"
          style={{ width: "min(85vw, 480px)" }}
          aria-hidden
        >
          {["a", "b", "c", "d", "e", "f", "g", "h"].map((f) => (
            <span key={f} className="flex-1 text-center">
              {f}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => startFresh(mode)}
        className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
      >
        New Game
      </button>

      {history.length > 0 && (
        <div className="mt-4 w-full max-w-md rounded-xl bg-[var(--surface)] p-3 shadow-sm ring-1 ring-[var(--line)]">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Moves
          </h3>
          <div className="max-h-32 overflow-auto text-xs text-[var(--ink)]">
            {history.map((m, i) => (
              <span key={`${i}-${m}`} className="mr-2">
                {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}
                {m}{" "}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
