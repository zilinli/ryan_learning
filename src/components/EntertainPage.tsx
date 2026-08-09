"use client";

import { useCallback, useState } from "react";
import type { GameId } from "@/lib/entertain/types";
import { ChessGame } from "./ChessGame";
import { XiangqiGame } from "./XiangqiGame";
import { GoGame } from "./GoGame";
import { SudokuGame } from "./SudokuGame";
import { SokobanGame } from "./SokobanGame";
import { KlotskiGame } from "./KlotskiGame";

interface GameInfo {
  id: GameId;
  title: string;
  desc: string;
  icon: string;
  category: string;
}

const GAMES: GameInfo[] = [
  { id: "chess", title: "Chess", desc: "Classic international chess with AI opponent", icon: "♚", category: "Board Games" },
  { id: "xiangqi", title: "Chinese Chess", desc: "象棋 — traditional strategy with AI", icon: "帥", category: "Board Games" },
  { id: "go", title: "Go", desc: "围棋 — territory game of profound depth", icon: "⚫", category: "Board Games" },
  { id: "sudoku", title: "Sudoku", desc: "Classic number placement puzzle", icon: "9", category: "Logic Puzzles" },
  { id: "sokoban", title: "Sokoban", desc: "Push boxes to targets — spatial reasoning", icon: "📦", category: "Logic Puzzles" },
  { id: "klotski", title: "Klotski", desc: "华容道 — free Cao Cao from the fortress", icon: "曹", category: "Logic Puzzles" },
];

export function EntertainPage() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  const handleBack = useCallback(() => setActiveGame(null), []);

  if (activeGame === "chess") {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title="Chess" onBack={handleBack} />
        <ChessGame />
      </div>
    );
  }

  if (activeGame === "xiangqi") {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title="Chinese Chess · 象棋" onBack={handleBack} />
        <XiangqiGame />
      </div>
    );
  }

  if (activeGame === "go") {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title="Go · 围棋" onBack={handleBack} />
        <GoGame />
      </div>
    );
  }

  if (activeGame === "sudoku") {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title="Sudoku" onBack={handleBack} />
        <SudokuGame />
      </div>
    );
  }

  if (activeGame === "sokoban") {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title="Sokoban · 推箱子" onBack={handleBack} />
        <SokobanGame />
      </div>
    );
  }

  if (activeGame === "klotski") {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title="Klotski · 华容道" onBack={handleBack} />
        <KlotskiGame />
      </div>
    );
  }

  // Hub view
  const boardGames = GAMES.filter((g) => g.category === "Board Games");
  const puzzles = GAMES.filter((g) => g.category === "Logic Puzzles");

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-6">
        <h1 className="text-center text-2xl font-bold text-[var(--ink)]">
          Entertainments
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--ink-muted)]">
          Puzzle games and board games for a quick mental break
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Board Games */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Board Games
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {boardGames.map((game) => (
                <GameCard key={game.id} game={game} onSelect={() => setActiveGame(game.id)} />
              ))}
            </div>
          </section>

          {/* Logic Puzzles */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Logic Puzzles
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {puzzles.map((game) => (
                <GameCard key={game.id} game={game} onSelect={() => setActiveGame(game.id)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="shrink-0 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--mist)]"
        aria-label="Back to games"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15,18 9,12 15,6" />
        </svg>
      </button>
      <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
    </header>
  );
}

function GameCard({ game, onSelect }: { game: GameInfo; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-left transition hover:border-[var(--teal)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--mist)] text-2xl transition group-hover:bg-[var(--teal)]/20"
        aria-hidden
      >
        {game.icon}
      </span>
      <div className="text-center">
        <div className="text-sm font-semibold text-[var(--ink)]">{game.title}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]">
          {game.desc}
        </div>
      </div>
    </button>
  );
}
