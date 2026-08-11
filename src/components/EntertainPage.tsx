"use client";

import { useCallback, useState } from "react";
import type { GameId } from "@/lib/entertain/types";
import { ChessGame } from "./ChessGame";
import { XiangqiGame } from "./XiangqiGame";
import { GoGame } from "./GoGame";
import { GomokuGame } from "./GomokuGame";
import { UtttGame } from "./UtttGame";
import { TetrisGame } from "./TetrisGame";
import { SnakeGame } from "./SnakeGame";
import { SudokuGame } from "./SudokuGame";
import { SokobanGame } from "./SokobanGame";
import { KlotskiGame } from "./KlotskiGame";
import { TedLab } from "./TedLab";
import { LyricStudio } from "./LyricStudio";
import { CreationsLibrary } from "./CreationsLibrary";

interface GameInfo {
  id: GameId;
  title: string;
  desc: string;
  icon: string;
  category: string;
}

const GAMES: GameInfo[] = [
  { id: "chess", title: "Chess", desc: "International chess — local AI, 3 levels", icon: "♚", category: "Board Games" },
  { id: "xiangqi", title: "Chinese Chess", desc: "象棋 — local AI, 3 levels", icon: "帥", category: "Board Games" },
  { id: "go", title: "Go", desc: "围棋 9×9 — local AI, 3 levels", icon: "⚫", category: "Board Games" },
  { id: "gomoku", title: "Gomoku", desc: "五子棋 — pattern AI, 3 levels", icon: "❺", category: "Board Games" },
  { id: "uttt", title: "Ultimate TTT", desc: "9 boards — local AI, 3 levels", icon: "⊞", category: "Board Games" },
  { id: "blocks", title: "Blocks", desc: "Falling blocks — clear lines", icon: "▦", category: "Arcade" },
  { id: "snake", title: "Snake", desc: "Grow and avoid the walls", icon: "◎", category: "Arcade" },
  { id: "sudoku", title: "Sudoku", desc: "Classic number placement puzzle", icon: "9", category: "Logic Puzzles" },
  { id: "sokoban", title: "Sokoban", desc: "Push boxes to targets", icon: "📦", category: "Logic Puzzles" },
  { id: "klotski", title: "Klotski", desc: "华容道 — free Cao Cao", icon: "曹", category: "Logic Puzzles" },
];

const STUDIO: GameInfo[] = [
  {
    id: "ted-lab",
    title: "TED Lab",
    desc: "Watch a talk. Then argue with it.",
    icon: "🎬",
    category: "Studio",
  },
  {
    id: "lyric-studio",
    title: "Lyric Studio",
    desc: "Write. Polish. Hear it sung.",
    icon: "♪",
    category: "Studio",
  },
  {
    id: "creations",
    title: "My Creations",
    desc: "Songs & TED challenges you kept.",
    icon: "◆",
    category: "Studio",
  },
];

const TITLES: Record<GameId, string> = {
  chess: "Chess",
  xiangqi: "Chinese Chess · 象棋",
  go: "Go · 围棋",
  gomoku: "Gomoku · 五子棋",
  uttt: "Ultimate Tic-Tac-Toe",
  blocks: "Blocks",
  snake: "Snake",
  sudoku: "Sudoku",
  sokoban: "Sokoban · 推箱子",
  klotski: "Klotski · 华容道",
  "ted-lab": "TED Lab",
  "lyric-studio": "Lyric Studio",
  creations: "My Creations",
};

export function EntertainPage() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const handleBack = useCallback(() => setActiveGame(null), []);

  if (activeGame) {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
        <TopBar title={TITLES[activeGame]} onBack={handleBack} />
        {activeGame === "chess" && <ChessGame />}
        {activeGame === "xiangqi" && <XiangqiGame />}
        {activeGame === "go" && <GoGame />}
        {activeGame === "gomoku" && <GomokuGame />}
        {activeGame === "uttt" && <UtttGame />}
        {activeGame === "blocks" && <TetrisGame />}
        {activeGame === "snake" && <SnakeGame />}
        {activeGame === "sudoku" && <SudokuGame />}
        {activeGame === "sokoban" && <SokobanGame />}
        {activeGame === "klotski" && <KlotskiGame />}
        {activeGame === "ted-lab" && <TedLab />}
        {activeGame === "lyric-studio" && <LyricStudio />}
        {activeGame === "creations" && <CreationsLibrary />}
      </div>
    );
  }

  const boardGames = GAMES.filter((g) => g.category === "Board Games");
  const arcade = GAMES.filter((g) => g.category === "Arcade");
  const puzzles = GAMES.filter((g) => g.category === "Logic Puzzles");

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
      <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-6">
        <h1 className="text-center text-2xl font-bold text-[var(--ink)]">
          Entertainments
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--ink-muted)]">
          Studio listening & songwriting · board games · arcade · puzzles
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Studio
            </h2>
            <p className="mb-4 text-xs text-[var(--ink-muted)]">
              Cinema seminar and notebook → stage — different from the chess grid.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {STUDIO.map((game) => (
                <StudioCard
                  key={game.id}
                  game={game}
                  onSelect={() => setActiveGame(game.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Board Games
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {boardGames.map((game) => (
                <GameCard key={game.id} game={game} onSelect={() => setActiveGame(game.id)} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Arcade
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {arcade.map((game) => (
                <GameCard key={game.id} game={game} onSelect={() => setActiveGame(game.id)} />
              ))}
            </div>
          </section>

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

function StudioCard({ game, onSelect }: { game: GameInfo; onSelect: () => void }) {
  const thumb =
    game.id === "ted-lab"
      ? "linear-gradient(135deg, #141210 0%, #2a3d38 55%, #4f7356 100%)"
      : game.id === "lyric-studio"
        ? "linear-gradient(135deg, #f3efe6 0%, #c4a484 45%, #1a2228 100%)"
        : "linear-gradient(135deg, #3d2b1f 0%, #a85f42 50%, #4f7356 100%)";
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative overflow-hidden rounded-2xl border border-[var(--line)] text-left transition hover:border-[var(--teal)]/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
    >
      <div
        className="h-28 w-full transition group-hover:scale-[1.02]"
        style={{ background: thumb }}
        aria-hidden
      />
      <div className="bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {game.icon}
          </span>
          <span className="text-base font-semibold text-[var(--ink)]">
            {game.title}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">{game.desc}</p>
      </div>
    </button>
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
