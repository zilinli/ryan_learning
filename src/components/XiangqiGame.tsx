"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cellKey,
  getAllLegalMoveStrings,
  getLegalMoves,
  initXiangqi,
  pieceChar,
  selectCell,
  type XiangqiPosition,
  type XiangqiState,
} from "@/lib/entertain/xiangqi";

type GameMode = "ai" | "pvp";

/** SVG Xiangqi board: 9 files × 10 ranks, pieces on intersections (xiangqiground style). */
function XiangqiBoardSvg() {
  // Coordinate space: cols 0..8, rows 0..9 → viewBox 0..8 × 0..9 with padding
  const pad = 0.5;
  const vbW = 8 + pad * 2;
  const vbH = 9 + pad * 2;
  const x = (c: number) => pad + c;
  const y = (r: number) => pad + r;

  const lines: React.ReactNode[] = [];

  // Horizontal lines (10 ranks)
  for (let r = 0; r < 10; r++) {
    lines.push(
      <line key={`h${r}`} x1={x(0)} y1={y(r)} x2={x(8)} y2={y(r)} stroke="#3d2b1f" strokeWidth={0.04} />,
    );
  }

  // Vertical lines — split at river (between rank 4 and 5)
  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) {
      // Outer edges run full height
      lines.push(
        <line key={`v${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(9)} stroke="#3d2b1f" strokeWidth={0.04} />,
      );
    } else {
      // Inner files stop at river
      lines.push(
        <line key={`vt${c}`} x1={x(c)} y1={y(0)} x2={x(c)} y2={y(4)} stroke="#3d2b1f" strokeWidth={0.04} />,
      );
      lines.push(
        <line key={`vb${c}`} x1={x(c)} y1={y(5)} x2={x(c)} y2={y(9)} stroke="#3d2b1f" strokeWidth={0.04} />,
      );
    }
  }

  // Palace diagonals (black top, red bottom)
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
          key={`s${r}${c}${i}`}
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
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* Board fill */}
      <rect x={0} y={0} width={vbW} height={vbH} fill="#e8c98a" rx={0.15} />
      {/* Outer border */}
      <rect
        x={x(0) - 0.08}
        y={y(0) - 0.08}
        width={8 + 0.16}
        height={9 + 0.16}
        fill="none"
        stroke="#3d2b1f"
        strokeWidth={0.08}
      />
      {lines}
      {palaceDiag(0, 2)}
      {palaceDiag(7, 9)}
      {starMarks}
      {/* River labels */}
      <text
        x={x(2)}
        y={y(4.55)}
        textAnchor="middle"
        fontSize={0.35}
        fill="#5c4a3c"
        fontFamily="serif"
      >
        楚 河
      </text>
      <text
        x={x(6)}
        y={y(4.55)}
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

  const handlePointClick = useCallback(
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
          .map((row) => row.map((cell) => cell || "·").join(" "))
          .join("\n");
        const history = state.moveHistory
          .map((m) => `${m.from.row},${m.from.col}-${m.to.row},${m.to.col}`)
          .join("; ");
        const legal = getAllLegalMoveStrings(state.board, "black");

        const res = await fetch("/api/entertain-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: "xiangqi",
            boardState: boardDesc,
            moveHistory: history,
            playerColor: "black",
            legalMoves: legal,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `AI error: ${res.status}`);
        }
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
              if (prev.board[from.row]?.[from.col]) {
                return selectCell({ ...prev, selectedCell: from }, to);
              }
              // Fallback: pick first legal
              if (legal.length > 0) {
                const [fr, fc] = legal[0].split("-")[0].split(",").map(Number);
                const [tr, tc] = legal[0].split("-")[1].split(",").map(Number);
                return selectCell({ ...prev, selectedCell: { row: fr, col: fc } }, { row: tr, col: tc });
              }
              return prev;
            });
          }
        }
      } catch (err: unknown) {
        // Client-side fallback: play a random legal move
        const legal = getAllLegalMoveStrings(state.board, "black");
        if (legal.length > 0) {
          const pick = legal[Math.floor(Math.random() * legal.length)];
          const [fromS, toS] = pick.split("-");
          const [fr, fc] = fromS.split(",").map(Number);
          const [tr, tc] = toS.split(",").map(Number);
          setState((prev) =>
            selectCell({ ...prev, selectedCell: { row: fr, col: fc } }, { row: tr, col: tc }),
          );
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : "AI unavailable");
        }
      } finally {
        setThinking(false);
      }
    };

    const timer = setTimeout(makeAiMove, 400);
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

  // Pieces sit on intersections: viewBox width=9 (0.5+8+0.5), height=10
  const pieceStyle = (row: number, col: number) => ({
    left: `${((0.5 + col) / 9) * 100}%`,
    top: `${((0.5 + row) / 10) * 100}%`,
    transform: "translate(-50%, -50%)",
  });

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      {/* Mode */}
      <div className="mb-3 flex items-center gap-2">
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
      </div>

      {/* Status */}
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{statusText}</span>
        {thinking && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />
        )}
        {error && <span className="text-xs text-[var(--coral)]">{error}</span>}
      </div>

      {/* Board */}
      <div
        className="relative mb-4 rounded-xl shadow-lg"
        style={{ width: "min(90vw, 420px)", aspectRatio: "9/10" }}
      >
        <XiangqiBoardSvg />

        {/* Clickable intersection points + pieces */}
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
                disabled={thinking || state.status !== "playing"}
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
