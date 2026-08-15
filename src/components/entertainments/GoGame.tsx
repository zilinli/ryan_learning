"use client";

import { useState } from "react";
import { initialGo, passGo, playGo } from "@/lib/entertainments/go";
import { t } from "@/lib/entertainments/i18n";
import type { EntLang } from "@/lib/entertainments/types";

export function GoGame({ lang }: { lang: EntLang }) {
  const [state, setState] = useState(() => initialGo(9));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-[11px] text-[var(--ink-muted)]">
        <span>
          {t(lang, "turn")}: {state.toPlay === 1 ? "Black" : "White"}
        </span>
        <span>
          Captured B/W: {state.captured[0]}/{state.captured[1]}
        </span>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1 font-semibold text-[var(--ink)]"
          onClick={() => setState(passGo(state))}
        >
          Pass
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1 font-semibold text-[var(--ink)]"
          onClick={() => setState(initialGo(9))}
        >
          {t(lang, "newGame")}
        </button>
      </div>
      <div
        className="mx-auto grid w-full max-w-sm gap-0 rounded-xl border border-[var(--line)] bg-[#d8b57a] p-2"
        style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}
      >
        {state.board.map((v, i) => (
          <button
            key={i}
            type="button"
            disabled={state.over}
            onClick={() => {
              const next = playGo(state, i);
              if (next) setState(next);
            }}
            className="relative aspect-square"
          >
            <span className="absolute inset-[46%] rounded-full bg-[var(--ink-muted)]/35" />
            {v === 1 ? (
              <span className="absolute inset-[18%] rounded-full bg-[#1a1a1a] shadow" />
            ) : null}
            {v === 2 ? (
              <span className="absolute inset-[18%] rounded-full bg-[#f5f5f5] shadow ring-1 ring-black/20" />
            ) : null}
            {state.last === i ? (
              <span className="absolute inset-[42%] rounded-full bg-[var(--teal)]" />
            ) : null}
          </button>
        ))}
      </div>
      {state.over ? (
        <p role="status" className="text-center text-sm font-semibold text-[var(--teal)]">
          Game over · {t(lang, "youWin")}
        </p>
      ) : null}
    </div>
  );
}
