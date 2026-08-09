"use client";

import { useState } from "react";
import {
  initialKlotski,
  isKlotskiWon,
  moveKlotski,
  undoKlotski,
} from "@/lib/entertainments/klotski";
import { t } from "@/lib/entertainments/i18n";
import type { EntLang } from "@/lib/entertainments/types";

const COLORS: Record<string, string> = {
  cao: "bg-[#c45c26] text-white",
  v: "bg-[var(--teal)]/80 text-white",
  h: "bg-[var(--teal)]/55 text-white",
  s: "bg-[var(--mist)] text-[var(--ink)]",
};

export function KlotskiGame({ lang }: { lang: EntLang }) {
  const [state, setState] = useState(initialKlotski);
  const won = isKlotskiWon(state);
  const sel = state.selected;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 text-[11px] text-[var(--ink-muted)]">
        <span>
          {t(lang, "moves")}: {state.moves}
        </span>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1 font-semibold text-[var(--ink)]"
          onClick={() => setState(undoKlotski(state))}
        >
          {t(lang, "undo")}
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1 font-semibold text-[var(--ink)]"
          onClick={() => setState(initialKlotski())}
        >
          {t(lang, "reset")}
        </button>
      </div>
      <div className="relative mx-auto aspect-[4/5] w-full max-w-xs rounded-2xl border-2 border-[var(--ink-muted)]/40 bg-[var(--surface-muted)]">
        {/* exit gap marker */}
        <div className="absolute bottom-0 left-1/4 h-1 w-1/2 bg-[var(--teal)]" />
        {state.blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setState({ ...state, selected: b.id })}
            className={`absolute flex items-center justify-center rounded-lg text-xs font-bold shadow-sm ${
              COLORS[b.kind]
            } ${sel === b.id ? "ring-2 ring-[var(--ink)]" : ""}`}
            style={{
              left: `${(b.x / 4) * 100}%`,
              top: `${(b.y / 5) * 100}%`,
              width: `${(b.w / 4) * 100}%`,
              height: `${(b.h / 5) * 100}%`,
            }}
          >
            {b.kind === "cao" ? "曹操" : ""}
          </button>
        ))}
      </div>
      {sel ? (
        <div className="mx-auto grid grid-cols-3 gap-2">
          <div />
          <Pad onClick={() => setState((s) => moveKlotski(s, sel, 0, -1))}>↑</Pad>
          <div />
          <Pad onClick={() => setState((s) => moveKlotski(s, sel, -1, 0))}>←</Pad>
          <Pad onClick={() => setState((s) => moveKlotski(s, sel, 0, 1))}>↓</Pad>
          <Pad onClick={() => setState((s) => moveKlotski(s, sel, 1, 0))}>→</Pad>
        </div>
      ) : (
        <p className="text-center text-[11px] text-[var(--ink-muted)]">
          Tap a block, then slide
        </p>
      )}
      {won ? (
        <p role="status" className="text-center text-sm font-semibold text-[var(--teal)]">
          {t(lang, "youWin")}
        </p>
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
      className="min-h-11 rounded-xl bg-[var(--surface-muted)] text-lg font-bold"
    >
      {children}
    </button>
  );
}
