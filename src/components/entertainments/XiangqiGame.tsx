"use client";

import { useMemo, useState } from "react";
import {
  initialXiangqi,
  playXiangqi,
  XIANGQI_LABEL,
  xiangqiLegalMoves,
  type XPiece,
} from "@/lib/entertainments/xiangqi";
import { t } from "@/lib/entertainments/i18n";
import type { EntLang } from "@/lib/entertainments/types";

export function XiangqiGame({ lang }: { lang: EntLang }) {
  const [state, setState] = useState(initialXiangqi);
  const legal = useMemo(
    () =>
      state.selected != null
        ? new Set(xiangqiLegalMoves(state, state.selected))
        : new Set<number>(),
    [state],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] font-semibold"
          onClick={() => setState(initialXiangqi())}
        >
          {t(lang, "newGame")}
        </button>
        <span className="text-[11px] text-[var(--ink-muted)]">
          {t(lang, "turn")}:{" "}
          {state.winner
            ? state.winner
            : state.redToMove
              ? "Red"
              : "Black"}
        </span>
      </div>
      <div className="relative mx-auto w-full max-w-sm">
        <div className="grid grid-cols-9 gap-0 rounded-xl border border-[var(--line)] bg-[#f3e2c2] p-1">
          {state.board.map((p: XPiece, i) => {
            const y = Math.floor(i / 9);
            const river = y === 4 || y === 5;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (state.winner) return;
                  if (state.selected != null && legal.has(i)) {
                    setState(playXiangqi(state, state.selected, i));
                    return;
                  }
                  const piece = state.board[i]!;
                  if (piece === ".") {
                    setState({ ...state, selected: null });
                    return;
                  }
                  const red = piece === piece.toUpperCase();
                  if (red === state.redToMove) {
                    setState({ ...state, selected: i });
                  }
                }}
                className={`aspect-square text-sm font-bold ${
                  river ? "bg-[#e8d2a8]" : "bg-transparent"
                } ${state.selected === i ? "ring-2 ring-[var(--teal)]" : ""} ${
                  legal.has(i) ? "bg-[var(--teal)]/25" : ""
                } ${
                  p !== "." && p === p.toUpperCase()
                    ? "text-[#b33]"
                    : "text-[#222]"
                }`}
              >
                {p === "." ? "" : XIANGQI_LABEL[p]}
              </button>
            );
          })}
        </div>
        <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] tracking-[0.3em] text-[var(--ink-muted)]/50">
          楚河　汉界
        </p>
      </div>
      {state.winner ? (
        <p role="status" className="text-center text-sm font-semibold text-[var(--teal)]">
          {t(lang, "youWin")} ({state.winner})
        </p>
      ) : null}
    </div>
  );
}
