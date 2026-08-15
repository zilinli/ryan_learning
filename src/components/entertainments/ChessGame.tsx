"use client";

import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { t } from "@/lib/entertainments/i18n";
import type { EntLang } from "@/lib/entertainments/types";

const GLYPH: Record<string, string> = {
  wp: "♙",
  wr: "♖",
  wn: "♘",
  wb: "♗",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bq: "♛",
  bk: "♚",
};

export function ChessGame({ lang }: { lang: EntLang }) {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [sel, setSel] = useState<Square | null>(null);
  const [vsCpu, setVsCpu] = useState(true);
  const game = useMemo(() => new Chess(fen), [fen]);

  const legalTargets = useMemo(() => {
    if (!sel) return new Set<string>();
    return new Set(game.moves({ square: sel, verbose: true }).map((m) => m.to));
  }, [game, sel]);

  const playCpu = (g: Chess) => {
    if (g.isGameOver()) return g;
    const moves = g.moves({ verbose: true });
    if (!moves.length) return g;
    const m = moves[Math.floor(Math.random() * moves.length)]!;
    g.move(m);
    return g;
  };

  const onSquare = (sq: Square) => {
    if (game.isGameOver()) return;
    if (sel && legalTargets.has(sq)) {
      const g = new Chess(fen);
      g.move({ from: sel, to: sq, promotion: "q" });
      if (vsCpu && !g.isGameOver()) playCpu(g);
      setFen(g.fen());
      setSel(null);
      return;
    }
    const piece = game.get(sq);
    if (piece && piece.color === game.turn()) setSel(sq);
    else setSel(null);
  };

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
            vsCpu ? "bg-[var(--teal)] text-white" : "bg-[var(--surface-muted)]"
          }`}
          onClick={() => setVsCpu(true)}
        >
          {t(lang, "vsCpu")}
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
            !vsCpu ? "bg-[var(--teal)] text-white" : "bg-[var(--surface-muted)]"
          }`}
          onClick={() => setVsCpu(false)}
        >
          {t(lang, "vsHuman")}
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] font-semibold"
          onClick={() => {
            setFen(new Chess().fen());
            setSel(null);
          }}
        >
          {t(lang, "newGame")}
        </button>
      </div>
      <p className="text-center text-[11px] text-[var(--ink-muted)]">
        {t(lang, "turn")}: {game.turn() === "w" ? "White" : "Black"}
        {game.isCheckmate()
          ? " · Checkmate"
          : game.isDraw()
            ? " · Draw"
            : game.isCheck()
              ? " · Check"
              : ""}
      </p>
      <div className="mx-auto grid w-full max-w-sm grid-cols-8 overflow-hidden rounded-xl border border-[var(--line)]">
        {ranks.map((r) =>
          files.map((f) => {
            const sq = `${f}${r}` as Square;
            const dark = (f.charCodeAt(0) + r) % 2 === 0;
            const piece = game.get(sq);
            const key = piece ? `${piece.color}${piece.type}` : "";
            return (
              <button
                key={sq}
                type="button"
                onClick={() => onSquare(sq)}
                className={`aspect-square text-xl leading-none ${
                  dark ? "bg-[#b7c4a1]" : "bg-[#eef2e6]"
                } ${sel === sq ? "ring-2 ring-inset ring-[var(--teal)]" : ""} ${
                  legalTargets.has(sq) ? "after:absolute" : ""
                }`}
              >
                <span className="relative inline-flex h-full w-full items-center justify-center">
                  {key ? GLYPH[key] : ""}
                  {legalTargets.has(sq) ? (
                    <span className="absolute h-2.5 w-2.5 rounded-full bg-[var(--teal)]/50" />
                  ) : null}
                </span>
              </button>
            );
          }),
        )}
      </div>
      {game.isCheckmate() || game.isDraw() ? (
        <p role="status" className="text-center text-sm font-semibold text-[var(--teal)]">
          {t(lang, "youWin")}
        </p>
      ) : null}
    </div>
  );
}
