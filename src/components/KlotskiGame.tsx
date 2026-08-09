"use client";

import { useCallback, useEffect, useState } from "react";
import {
  initKlotski,
  LAYOUTS,
  movePiece,
  undoKlotski,
  type KlotskiState,
} from "@/lib/entertain/klotski";

const BOARD_ROWS = 5;
const BOARD_COLS = 4;

export function KlotskiGame() {
  const [state, setState] = useState<KlotskiState>(() => initKlotski(0));
  const [layoutIdx, setLayoutIdx] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (state.solved) {
      setMessage(`Cao Cao escaped in ${state.moveCount} moves!`);
    }
  }, [state.solved, state.moveCount]);

  const changeLayout = useCallback((delta: number) => {
    const next = (layoutIdx + delta + LAYOUTS.length) % LAYOUTS.length;
    setLayoutIdx(next);
    setState(initKlotski(next));
    setMessage(null);
  }, [layoutIdx]);

  const handleReset = useCallback(() => {
    setState(initKlotski(layoutIdx));
    setMessage(null);
  }, [layoutIdx]);

  const handleUndo = useCallback(() => {
    setState((prev) => undoKlotski(prev));
    setMessage(null);
  }, []);

  // Click-based movement: select a piece, then select adjacent cell to move
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handlePieceClick = useCallback((pieceId: string) => {
    if (state.solved) return;
    setDraggingId(null);
    if (selectedId === pieceId) {
      setSelectedId(null);
    } else {
      setSelectedId(pieceId);
    }
  }, [selectedId, state.solved]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (state.solved || !selectedId) return;

    const piece = state.pieces.find((p) => p.id === selectedId);
    if (!piece) return;

    // Determine direction from piece to clicked cell
    const isLeft = col < piece.col && row >= piece.row && row < piece.row + piece.h;
    const isRight = col >= piece.col + piece.w && row >= piece.row && row < piece.row + piece.h;
    const isUp = row < piece.row && col >= piece.col && col < piece.col + piece.w;
    const isDown = row >= piece.row + piece.h && col >= piece.col && col < piece.col + piece.w;

    let dr = 0;
    let dc = 0;
    if (isLeft) dc = -1;
    else if (isRight) dc = 1;
    else if (isUp) dr = -1;
    else if (isDown) dr = 1;

    if (dr !== 0 || dc !== 0) {
      const newState = movePiece(state, selectedId, dr, dc);
      if (newState !== state) {
        setState(newState);
        setSelectedId(null);
      }
    } else {
      setSelectedId(null);
    }
  }, [state, selectedId]);

  // Drag-based movement
  const handlePointerDown = useCallback((pieceId: string, e: React.PointerEvent) => {
    if (state.solved) return;
    setDraggingId(pieceId);
    setSelectedId(null);
    setDragStart({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [state.solved]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingId || !dragStart) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const threshold = 30;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      const dr = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 1 : -1) : 0;
      const dc = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;

      const newState = movePiece(state, draggingId, dr, dc);
      if (newState !== state) {
        setState(newState);
      }
      setDraggingId(null);
      setDragStart(null);
    }
  }, [draggingId, dragStart, state]);

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
    setDragStart(null);
  }, []);

  const pieceColors: Record<string, string> = {
    caocao: "bg-[#c44]/20 border-[#c44] text-[#c44]",
    guanyu: "bg-[#4a8]/20 border-[#4a8] text-[#4a8]",
    zhangfei: "bg-[#488]/20 border-[#488] text-[#488]",
    zhaoyun: "bg-[#84a]/20 border-[#84a] text-[#84a]",
    machao: "bg-[#a84]/20 border-[#a84] text-[#a84]",
    huangzhong: "bg-[#a88]/20 border-[#a88] text-[#a88]",
  };

  // Build occupied grid
  const grid: (string | null)[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(null),
  );
  for (const p of state.pieces) {
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          grid[r][c] = p.id;
        }
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4">
      {/* Info bar */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
        <span>{LAYOUTS[layoutIdx].nameZh}</span>
        <span className="text-[var(--ink-muted)]">Moves: {state.moveCount}</span>
        {message && <span className="text-[var(--teal)] font-bold">{message}</span>}
      </div>

      {/* Board */}
      <div
        className="mb-4 rounded-xl border-4 border-[#7a5a3a] bg-[#d4a76a] p-1 shadow-lg select-none touch-none"
        style={{ width: "min(80vw, 320px)", aspectRatio: "4/5" }}
      >
        <div
          className="relative grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${BOARD_ROWS}, 1fr)`,
          }}
        >
          {/* Grid cells */}
          {Array.from({ length: BOARD_ROWS }, (_, row) =>
            Array.from({ length: BOARD_COLS }, (_, col) => {
              const id = grid[row][col];
              const piece = id ? state.pieces.find((p) => p.id === id) : null;
              const isSelected = selectedId === id;

              // Only render piece on its top-left cell
              if (piece && row === piece.row && col === piece.col) {
                const colorClass = pieceColors[piece.id] ?? "bg-[var(--mist)]/40 border-[var(--ink-muted)] text-[var(--ink)]";
                return (
                  <div
                    key={piece.id}
                    className="absolute z-10"
                    style={{
                      left: `${(piece.col / BOARD_COLS) * 100}%`,
                      top: `${(piece.row / BOARD_ROWS) * 100}%`,
                      width: `${(piece.w / BOARD_COLS) * 100}%`,
                      height: `${(piece.h / BOARD_ROWS) * 100}%`,
                      padding: "2px",
                    }}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => handlePointerDown(piece.id, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onClick={() => handlePieceClick(piece.id)}
                      className={`flex h-full w-full items-center justify-center rounded-lg border-2 text-[clamp(0.6rem,2.5vw,0.9rem)] font-bold transition-all
                        ${colorClass}
                        ${isSelected ? "ring-2 ring-[var(--teal)]" : ""}
                        ${piece.id === "caocao" ? "text-base" : ""}
                        hover:shadow-md active:scale-95
                      `}
                    >
                      {piece.label}
                    </button>
                  </div>
                );
              }
              return null;
            }),
          )}

          {/* Grid cells for click-to-move targeting */}
          {Array.from({ length: BOARD_ROWS }, (_, row) =>
            Array.from({ length: BOARD_COLS }, (_, col) => (
              <button
                key={`cell-${row},${col}`}
                type="button"
                onClick={() => handleCellClick(row, col)}
                className="relative z-0 border border-[#c09050]/20"
                aria-label={`Cell ${row},${col}`}
              />
            )),
          )}
        </div>
      </div>

      {/* Exit marker */}
      <div className="mb-3 text-xs text-[var(--ink-muted)]">
        Goal: Move Cao Cao to exit ↓
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
          onClick={() => changeLayout(-1)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => changeLayout(1)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
