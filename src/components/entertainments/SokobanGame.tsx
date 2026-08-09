"use client";

import { useEffect, useState } from "react";
import {
  isSokobanWon,
  loadSokoban,
  moveSokoban,
  SOKOBAN_LEVELS,
  undoSokoban,
} from "@/lib/entertainments/sokoban";
import { t } from "@/lib/entertainments/i18n";
import type { EntLang } from "@/lib/entertainments/types";

export function SokobanGame({ lang }: { lang: EntLang }) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [state, setState] = useState(() => loadSokoban(SOKOBAN_LEVELS[0]!));
  const won = isSokobanWon(state);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      setState((st) => moveSokoban(st, d[0], d[1]));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cell = (i: number) => {
    if (state.walls[i]) return "#";
    if (state.boxes[i] && state.goals[i]) return "*";
    if (state.boxes[i]) return "$";
    if (state.player === i && state.goals[i]) return "+";
    if (state.player === i) return "@";
    if (state.goals[i]) return ".";
    return " ";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-muted)]">
        <span>
          {t(lang, "level")} {levelIdx + 1}/{SOKOBAN_LEVELS.length}
        </span>
        <span>
          {t(lang, "moves")}: {state.moves}
        </span>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1 font-semibold text-[var(--ink)]"
          onClick={() => setState(undoSokoban(state))}
        >
          {t(lang, "undo")}
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1 font-semibold text-[var(--ink)]"
          onClick={() => setState(loadSokoban(SOKOBAN_LEVELS[levelIdx]!))}
        >
          {t(lang, "reset")}
        </button>
      </div>
      <div
        className="mx-auto grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${state.w}, minmax(0, 1.6rem))` }}
      >
        {Array.from({ length: state.w * state.h }, (_, i) => {
          const ch = cell(i);
          const bg =
            ch === "#"
              ? "bg-[var(--ink-muted)]"
              : ch === "." || ch === "+" || ch === "*"
                ? "bg-[var(--teal)]/20"
                : "bg-[var(--surface-muted)]";
          return (
            <div
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-sm text-xs font-bold ${bg}`}
            >
              {ch === "@" || ch === "+"
                ? "☺"
                : ch === "$" || ch === "*"
                  ? "■"
                  : ch === "."
                    ? "·"
                    : ""}
            </div>
          );
        })}
      </div>
      <div className="mx-auto grid grid-cols-3 gap-2">
        <div />
        <Pad onClick={() => setState((s) => moveSokoban(s, 0, -1))}>↑</Pad>
        <div />
        <Pad onClick={() => setState((s) => moveSokoban(s, -1, 0))}>←</Pad>
        <Pad onClick={() => setState((s) => moveSokoban(s, 0, 1))}>↓</Pad>
        <Pad onClick={() => setState((s) => moveSokoban(s, 1, 0))}>→</Pad>
      </div>
      {won ? (
        <div className="flex flex-col items-center gap-2">
          <p role="status" className="text-sm font-semibold text-[var(--teal)]">
            {t(lang, "youWin")}
          </p>
          {levelIdx < SOKOBAN_LEVELS.length - 1 ? (
            <button
              type="button"
              className="rounded-full bg-[var(--teal)] px-4 py-2 text-xs font-semibold text-white"
              onClick={() => {
                const n = levelIdx + 1;
                setLevelIdx(n);
                setState(loadSokoban(SOKOBAN_LEVELS[n]!));
              }}
            >
              {t(lang, "level")} {levelIdx + 2}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Pad({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-xl bg-[var(--surface-muted)] text-lg font-bold text-[var(--ink)]"
    >
      {children}
    </button>
  );
}
