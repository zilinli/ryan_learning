"use client";

import { useEffect, useState } from "react";
import { GAMES } from "@/lib/entertainments/registry";
import { entLangFromVoice, gameBlurb, gameTitle, t } from "@/lib/entertainments/i18n";
import type { GameId } from "@/lib/entertainments/types";
import { SudokuGame } from "./SudokuGame";
import { SokobanGame } from "./SokobanGame";
import { KlotskiGame } from "./KlotskiGame";
import { ChessGame } from "./ChessGame";
import { XiangqiGame } from "./XiangqiGame";
import { GoGame } from "./GoGame";

type Props = {
  open: boolean;
  onClose: () => void;
  voiceId?: string;
};

const ICONS: Record<GameId, string> = {
  sudoku: "9",
  sokoban: "▣",
  klotski: "▦",
  chess: "♞",
  xiangqi: "车",
  go: "●",
};

export function EntertainmentsPanel({ open, onClose, voiceId }: Props) {
  const lang = entLangFromVoice(voiceId);
  const [game, setGame] = useState<GameId | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (game) setGame(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, game, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(10,28,34,0.4)]"
        aria-label={t(lang, "close")}
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col bg-[var(--surface)] shadow-2xl ring-1 ring-[var(--line)] animate-slide-in-right"
        role="dialog"
        aria-modal
        aria-label={t(lang, "hubTitle")}
      >
        <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          {game ? (
            <button
              type="button"
              onClick={() => setGame(null)}
              className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--teal)]"
            >
              ← {t(lang, "back")}
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-[var(--ink)]">
              {game ? gameTitle(lang, game) : t(lang, "hubTitle")}
            </h2>
            {!game ? (
              <p className="truncate text-[11px] text-[var(--ink-muted)]">
                {t(lang, "hubSub")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs text-[var(--ink-muted)]"
            aria-label={t(lang, "close")}
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!game ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGame(g.id)}
                  className="flex flex-col items-start gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-left transition hover:border-[var(--teal)]/40 hover:bg-[var(--mist)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--teal)]/15 text-base font-bold text-[var(--teal)]">
                    {ICONS[g.id]}
                  </span>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {gameTitle(lang, g.id)}
                  </span>
                  <span className="text-[11px] leading-snug text-[var(--ink-muted)]">
                    {gameBlurb(lang, g.id)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <GameBody id={game} lang={lang} />
          )}
        </div>
      </aside>
    </div>
  );
}

function GameBody({ id, lang }: { id: GameId; lang: ReturnType<typeof entLangFromVoice> }) {
  switch (id) {
    case "sudoku":
      return <SudokuGame lang={lang} />;
    case "sokoban":
      return <SokobanGame lang={lang} />;
    case "klotski":
      return <KlotskiGame lang={lang} />;
    case "chess":
      return <ChessGame lang={lang} />;
    case "xiangqi":
      return <XiangqiGame lang={lang} />;
    case "go":
      return <GoGame lang={lang} />;
    default:
      return null;
  }
}
