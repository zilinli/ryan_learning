"use client";

import { useMemo, useState } from "react";
import {
  generateSudoku,
  isSudokuComplete,
  setSudokuCell,
  sudokuConflicts,
  type SudokuDifficulty,
} from "@/lib/entertainments/sudoku";
import { t } from "@/lib/entertainments/i18n";
import type { EntLang } from "@/lib/entertainments/types";

export function SudokuGame({ lang }: { lang: EntLang }) {
  const [diff, setDiff] = useState<SudokuDifficulty>("easy");
  const [state, setState] = useState(() => generateSudoku("easy"));
  const [sel, setSel] = useState<number | null>(null);
  const conflicts = useMemo(() => sudokuConflicts(state), [state]);
  const won = isSudokuComplete(state);

  const newGame = (d: SudokuDifficulty) => {
    setDiff(d);
    setState(generateSudoku(d));
    setSel(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => newGame(d)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              diff === d
                ? "bg-[var(--teal)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--ink)]"
            }`}
          >
            {t(lang, d)}
          </button>
        ))}
      </div>
      <div
        className="mx-auto grid w-full max-w-sm grid-cols-9 gap-px rounded-xl bg-[var(--line)] p-px"
        role="grid"
        aria-label={t(lang, "sudoku")}
      >
        {state.board.map((n, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const thickR = c % 3 === 0;
          const thickB = r % 3 === 0;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              onClick={() => setSel(i)}
              className={`aspect-square text-sm font-semibold ${
                state.given[i]
                  ? "bg-[var(--mist)] text-[var(--ink)]"
                  : "bg-[var(--surface)] text-[var(--teal)]"
              } ${sel === i ? "ring-2 ring-[var(--teal)]" : ""} ${
                conflicts[i] ? "text-red-600" : ""
              } ${thickR ? "border-l border-[var(--ink-muted)]/30" : ""} ${
                thickB ? "border-t border-[var(--ink-muted)]/30" : ""
              }`}
            >
              {n || ""}
            </button>
          );
        })}
      </div>
      <div className="mx-auto grid w-full max-w-sm grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <button
            key={n}
            type="button"
            className="min-h-10 rounded-xl bg-[var(--surface-muted)] text-sm font-bold text-[var(--ink)]"
            onClick={() => {
              if (sel == null) return;
              setState((s) => setSudokuCell(s, sel, n));
            }}
          >
            {n === 0 ? "⌫" : n}
          </button>
        ))}
      </div>
      {won ? (
        <p role="status" className="text-center text-sm font-semibold text-[var(--teal)]">
          {t(lang, "youWin")}
        </p>
      ) : null}
    </div>
  );
}
