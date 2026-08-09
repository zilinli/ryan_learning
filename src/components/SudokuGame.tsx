"use client";

import { useCallback, useEffect, useState } from "react";
import {
  generatePuzzle,
  getConflicts,
  isSolved,
  type SudokuDifficulty,
  type SudokuGrid,
} from "@/lib/entertain/sudoku";

export function SudokuGame() {
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>("easy");
  const [puzzle, setPuzzle] = useState<SudokuGrid>(() => Array.from({ length: 9 }, () => Array(9).fill(null)));
  const [solution, setSolution] = useState<SudokuGrid>(() => Array.from({ length: 9 }, () => Array(9).fill(null)));
  const [board, setBoard] = useState<SudokuGrid>(() => Array.from({ length: 9 }, () => Array(9).fill(null)));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const newGame = useCallback((diff?: SudokuDifficulty) => {
    const d = diff ?? difficulty;
    const { puzzle: p, solution: s } = generatePuzzle(d);
    setPuzzle(p);
    setSolution(s);
    setBoard(p.map((row) => [...row]));
    setSelected(null);
    setConflicts(new Set());
    setMessage(null);
  }, [difficulty]);

  useEffect(() => {
    newGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellClick = useCallback((r: number, c: number) => {
    setSelected([r, c]);
  }, []);

  const handleNumber = useCallback(
    (num: number | null) => {
      if (!selected) return;
      const [r, c] = selected;
      if (puzzle[r][c] !== null) return; // cannot change given cells

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = num;
      setBoard(newBoard);
      const newConflicts = getConflicts(newBoard);
      setConflicts(newConflicts);

      if (num !== null && isSolved(newBoard, solution)) {
        setMessage("Solved! Well done!");
      }
    },
    [selected, board, puzzle, solution],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selected) return;
      const num = Number(e.key);
      if (num >= 1 && num <= 9) {
        handleNumber(num);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        handleNumber(null);
      } else if (e.key === "ArrowUp" && selected[0] > 0) {
        setSelected([selected[0] - 1, selected[1]]);
      } else if (e.key === "ArrowDown" && selected[0] < 8) {
        setSelected([selected[0] + 1, selected[1]]);
      } else if (e.key === "ArrowLeft" && selected[1] > 0) {
        setSelected([selected[0], selected[1] - 1]);
      } else if (e.key === "ArrowRight" && selected[1] < 8) {
        setSelected([selected[0], selected[1] + 1]);
      }
    },
    [selected, handleNumber],
  );

  return (
    <div className="flex flex-1 flex-col items-center px-3 py-4" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Difficulty selector */}
      <div className="mb-3 flex items-center gap-2">
        {(["easy", "medium", "hard"] as SudokuDifficulty[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => { setDifficulty(d); newGame(d); }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
              difficulty === d
                ? "bg-[var(--teal)] text-white"
                : "border border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--mist)]"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className="mb-3 rounded-full bg-[var(--teal)]/10 px-4 py-1.5 text-sm font-medium text-[var(--teal)]">
          {message}
        </div>
      )}

      {/* Board */}
      <div className="mb-4 rounded-xl border-2 border-[#333] bg-white p-1 shadow-lg">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(9, 1fr)",
            width: "min(80vw, 360px)",
            aspectRatio: "1/1",
          }}
        >
          {Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 9 }, (_, c) => {
              const val = board[r][c];
              const isGiven = puzzle[r][c] !== null;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isConflict = conflicts.has(`${r},${c}`);
              const isSameNumber = val !== null && selected && board[selected[0]][selected[1]] === val;
              const isSameRowCol = selected && (selected[0] === r || selected[1] === c);
              const isSameBox = selected &&
                Math.floor(selected[0] / 3) === Math.floor(r / 3) &&
                Math.floor(selected[1] / 3) === Math.floor(c / 3);
              const isHighlighted = isSameRowCol || isSameBox;
              const thickRight = c === 2 || c === 5;
              const thickBottom = r === 2 || r === 5;

              return (
                <button
                  key={`${r},${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  className={`flex aspect-square items-center justify-center text-lg font-medium transition-all
                    ${thickRight ? "border-r-2 border-r-[#333]" : "border-r border-r-[#ccc]"}
                    ${thickBottom ? "border-b-2 border-b-[#333]" : "border-b border-b-[#ccc]"}
                    ${isSel ? "bg-[var(--teal)]/30 ring-2 ring-[var(--teal)] ring-inset z-10" : ""}
                    ${isHighlighted && !isSel ? "bg-[var(--teal)]/10" : ""}
                    ${isSameNumber && !isSel ? "bg-[var(--teal)]/15" : ""}
                    ${isConflict ? "text-[var(--coral)]" : ""}
                    ${isGiven ? "text-[#333]" : "text-[var(--teal)]"}
                    hover:bg-[var(--mist)]/30 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-[var(--teal)]
                  `}
                  style={{ fontSize: "clamp(1rem, 4.5vw, 1.4rem)" }}
                >
                  {val ?? ""}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Number pad */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleNumber(n)}
            className="flex h-10 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--mist)] active:scale-95 sm:h-11 sm:w-10"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleNumber(null)}
          className="flex h-10 w-12 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--mist)] active:scale-95 sm:h-11 sm:w-14"
          aria-label="Erase"
        >
          Erase
        </button>
      </div>

      {/* Actions */}
      <button
        type="button"
        onClick={() => newGame()}
        className="mt-4 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
      >
        New Puzzle
      </button>
    </div>
  );
}
