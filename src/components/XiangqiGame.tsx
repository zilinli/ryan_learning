"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cellKey,
  getLegalMoves,
  initXiangqi,
  pieceChar,
  selectCell,
  type XiangqiState,
} from "@/lib/entertain/xiangqi";
import {
  applyXiangqiMove,
  chooseXiangqiAiMove,
  type AiDifficulty,
} from "@/lib/entertain/xiangqi-local";

type GameMode = "ai" | "pvp";

/** SVG Xiangqi board: 9 files × 10 ranks, pieces on intersections (xiangqiground style). */
function XiangqiBoardSvg() {
  const pad = 0.5;
  const x = (c: number) => pad + c;
  const y = (r: number) => pad + r;

  const lines: React.ReactNode[] = [];

  for (let r = 0; r < 10; r++) {
    lines.push(
      <line key={`h${r}`} x1={x(0)} y1={y(r)} x2={x(8)} y2={y(r)} stroke="#3d2b1f" strokeWidth={0.04} />,
    );
  }

  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) {
      lines.push(
        <line key={`v${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(9)} stroke="#3d2b1f" strokeWidth={0.04} />,
      );
    } else {
      lines.push(
        <line key={`vt${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(4)} stroke="#3d2b1f" strokeWidth={0.04} />,
      );
      lines.push(
        <line key={`vb${c}`} x1={x(c)} y1={y(5)} x2={x(c)} y2={y(9)} stroke="#3d2b1f" strokeWidth={0.04} />,
      );
    }
  }

  const palaceDiag = (r0: number, r2: number) => (
    <>
      <line x1={x(3)} y1={y(r0)} x2={x(5)} y2={y(r2)} stroke="#3d2b1f" strokeWidth={0.035} />
      <line x1={x(5)} y1={y(r0)} x2={x(3)} y2={y(r2)} stroke="#3d2b1f" strokeWidth={0.035} />
    </>
  );

  const starMarks: React.ReactNode[] = [];
  const stars: [number, number][] = [
    [2, 1], [2, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
    [7, 1], [7, 7], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  ];
  for (const [r, c] of stars) {
    const s = 0.14;
    const g = 0.05;
    const segs: [number, number, number, number][] = [];
    if (c > 0) {
      segs.push([c - g, r - g, c - g - s, r - g], [c - g, r - g, c - g, r - g - s]);
      segs.push([c - g, r + g, c - g - s, r + g], [c - g, r + g, c - g, r + g + s]);
    }
    if (c < 8) {
      segs.push([c + g, r - g, c + g + s, r - g], [c + g, r - g, c + g, r - g - s]);
      segs.push([c + g, r + g, c + g + s, r + g], [c + g, r + g, c + g, r + g + s]);
    }
    segs.forEach(([x1, y1, x2, y2], i) => {
      starMarks.push(
        <line
          key={`star-${r}-${c}-${i}`}
          x1={x(x1)}
          y1={y(y1)}
          x2={x(x2)}
          y2={y(y2)}
          stroke="#3d2b1f"
          strokeWidth={0.03}
        />,
      );
    });
  }

  return (
    <svg
      viewBox="0 0 9 10"
      className="absolute inset-0 h-full w-full rounded-xl"
      style={{ background: "#e8c48a" }}
      aria-hidden
    >
      {lines}
      {palaceDiag(0, 2)}
      {palaceDiag(7, 9)}
      {starMarks}
      <text
        x={4.5}
        y={4.65}
        textAnchor="middle"
        fontSize={0.35}
        fill="#5c4a3c"
        fontFamily="serif"
      >
        楚 河
      </text>
      <text
        x={4.5}
        y={5.55}
        textAnchor="middle"
        fontSize={0.35}
        fill="#5c4a3c"
        fontFamily="serif"
      >
        漢 界
      </text>
    </svg>
  );
}

export function XiangqiGame() {
  const [state, setState] = useState<XiangqiState>(initXiangqi);
  const [legalMoves, setLegalMoves] = useState<Set<string>>(new Set());
  const [aiBusy, setAiBusy] = useState(false);
  const [mode, setMode] = useState<GameMode>("ai");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");

  useEffect(() => {
    if (state.selectedCell) {
      const moves = getLegalMoves(state.board, state.selectedCell);
      setLegalMoves(new Set(moves.map((m) => cellKey(m.row, m.col))));
    } else {
      setLegalMoves(new Set());
    }
  }, [state.selectedCell, state.board]);

  const handlePointClick = useCallback(
    (row: number, col: number) => {
      if (aiBusy || state.status !== "playing") return;
      if (mode === "ai" && state.turn !== "red") return;
      setState((prev) => selectCell(prev, { row, col }));
    },
    [state.turn, state.status, aiBusy, mode],
  );

  // Local AI — same pattern as Chess (never leave aiBusy stuck)
  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || state.turn !== "black") {
      setAiBusy(false);
      return;
    }

    let alive = true;
    setAiBusy(true);

    const id = window.setTimeout(() => {
      if (!alive) return;
      try {
        const move = chooseXiangqiAiMove(state, difficulty);
        if (!alive || !move) return;
        setState((prev) => applyXiangqiMove(prev, move));
      } catch (err) {
        console.error("[Xiangqi AI]", err);
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
    setState(initXiangqi());
    setAiBusy(false);
    setLegalMoves(new Set());
  }, []);

  const statusText = (() => {
    if (state.status === "red_win") return "Red wins!";
    if (state.status === "black_win") return "Black wins!";
    if (aiBusy) return "AI thinking…";
    if (state.turn === "red") return "Red to move";
    return "Black to move";
  })();

  const pieceStyle = (row: number, col: number) => ({
    left: `${((0.5 + col) / 9) * 100}%`,
    top: `${((0.5 + row) / 10) * 100}%`,
    transform: "translate(-50%, -50%)",
  });

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
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
        <span>{statusText}</span>
        {aiBusy && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
        )}
      </div>

      <div
        className="relative mb-4 rounded-xl shadow-lg"
        style={{ width: "min(90vw, 420px)", aspectRatio: "9/10" }}
      >
        <XiangqiBoardSvg />

        {Array.from({ length: 10 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => {
            const piece = state.board[row][col];
            const isRed = piece ? "RNBAKCP".includes(piece) : false;
            const isSelected =
              state.selectedCell?.row === row && state.selectedCell?.col === col;
            const isLegal = legalMoves.has(cellKey(row, col));

            return (
              <button
                key={cellKey(row, col)}
                type="button"
                onClick={() => handlePointClick(row, col)}
                disabled={aiBusy || state.status !== "playing"}
                className="absolute z-10 flex items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:hover:scale-100"
                style={{
                  ...pieceStyle(row, col),
                  width: "11%",
                  height: "10%",
                }}
                aria-label={piece ? pieceChar(piece) : `empty ${row},${col}`}
              >
                {piece ? (
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-full border-2 shadow-md
                      ${isRed ? "border-[#c0392b] bg-[#fdf6e3] text-[#c0392b]" : "border-[#1a1a1a] bg-[#fdf6e3] text-[#1a1a1a]"}
                      ${isSelected ? "ring-2 ring-[var(--teal)] ring-offset-1" : ""}
                    `}
                    style={{ fontSize: "clamp(0.65rem, 2.8vw, 1rem)", fontWeight: 700 }}
                  >
                    {pieceChar(piece)}
                  </span>
                ) : isLegal ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--teal)]/60" />
                ) : null}
              </button>
            );
          }),
        )}
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
    </div>
  );
}
