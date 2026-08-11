"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { StudioAccountBar } from "./StudioAccountBar";

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

type StudioDest = {
  id: GameId;
  title: string;
  kicker: string;
  desc: string;
  cta: string;
  tone: "cinema" | "write" | "shelf";
};

const STUDIO: StudioDest[] = [
  {
    id: "ted-lab",
    title: "TED Lab",
    kicker: "Listen",
    desc: "Watch a talk. Then argue with it.",
    cta: "Open lab",
    tone: "cinema",
  },
  {
    id: "lyric-studio",
    title: "Writing Studio",
    kicker: "Create",
    desc: "Draft, coach, then stage song · image · video.",
    cta: "Open pad",
    tone: "write",
  },
  {
    id: "creations",
    title: "My Creations",
    kicker: "Keep",
    desc: "Songs, images, videos, and TED challenges you saved.",
    cta: "View library",
    tone: "shelf",
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
  "lyric-studio": "Writing Studio",
  creations: "My Creations",
};

type HubMode = "games" | "studio";

function readHubFromLocation(): HubMode {
  if (typeof window === "undefined") return "games";
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get("hub") === "studio" ? "studio" : "game";
  } catch {
    return "game";
  }
}

function readGameFromLocation(): GameId | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const g = q.get("game");
    if (!g) return null;
    const all = [...GAMES, ...STUDIO].map((x) => x.id);
    return all.includes(g as GameId) ? (g as GameId) : null;
  } catch {
    return null;
  }
}

export function EntertainPage() {
  const [hub, setHub] = useState<HubMode>("game");
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  useEffect(() => {
    setHub(readHubFromLocation());
    setActiveGame(readGameFromLocation());
  }, []);

  const handleBack = useCallback(() => {
    setActiveGame(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("game");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const openGame = useCallback((id: GameId) => {
    setActiveGame(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("game", id);
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const boardGames = useMemo(
    () => GAMES.filter((g) => g.category === "Board Games"),
    [],
  );
  const arcade = useMemo(
    () => GAMES.filter((g) => g.category === "Arcade"),
    [],
  );
  const puzzles = useMemo(
    () => GAMES.filter((g) => g.category === "Logic Puzzles"),
    [],
  );

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

  if (hub === "studio") {
    return <StudioHub onSelect={openGame} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-muted)]">
      <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-6 sm:py-5">
        <StudioAccountBar className="mb-3" />
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
          Entertainments
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--ink-muted)]">
          Board games · arcade · puzzles
        </p>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-8">
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Board Games
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {boardGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={() => openGame(game.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Arcade
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {arcade.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={() => openGame(game.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Logic Puzzles
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {puzzles.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={() => openGame(game.id)}
                />
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
    <header className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 sm:px-4">
      <StudioAccountBar onBack={onBack} backLabel="Hub" className="mb-1.5" />
      <h2 className="truncate px-1 text-base font-semibold text-[var(--ink)]">
        {title}
      </h2>
    </header>
  );
}

function StudioHub({ onSelect }: { onSelect: (id: GameId) => void }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-[#eef6f0]">
      {/* Full-bleed atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 12% -10%, #3d6b52 0%, transparent 55%), radial-gradient(90% 70% at 100% 20%, #1e3a32 0%, transparent 50%), linear-gradient(165deg, #0f1a16 0%, #152820 42%, #0c1411 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8fb896]/50 to-transparent"
        aria-hidden
      />

      <header className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pb-6 sm:pt-10">
        <StudioAccountBar tone="dark" className="mb-5" />
        <p className="font-[family-name:var(--font-display)] text-[11px] font-medium uppercase tracking-[0.28em] text-[#8fb896] sm:text-xs">
          Spark · Studio
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(2.35rem,7vw,4.25rem)] font-semibold leading-[1.05] tracking-tight text-[#f3faf5]">
          Studio
          <span className="font-normal text-[#8fb896]/90"> · learning</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#b7c9bc] sm:text-base">
          Listen deeply. Write clearly. Stage what you make.
        </p>
      </header>

      <div className="relative z-10 flex flex-1 flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-8 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4 lg:min-h-[min(52vh,520px)]">
          {STUDIO.map((dest, i) => (
            <StudioPanel
              key={dest.id}
              dest={dest}
              index={i}
              onSelect={() => onSelect(dest.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StudioPanel({
  dest,
  index,
  onSelect,
}: {
  dest: StudioDest;
  index: number;
  onSelect: () => void;
}) {
  const wash =
    dest.tone === "cinema"
      ? "from-[#1a2f28]/90 via-[#15241f]/55 to-transparent"
      : dest.tone === "write"
        ? "from-[#2a3428]/90 via-[#1c261f]/50 to-transparent"
        : "from-[#3a2a22]/85 via-[#241c18]/45 to-transparent";
  const accent =
    dest.tone === "cinema"
      ? "#8fb896"
      : dest.tone === "write"
        ? "#c4d4a8"
        : "#d4a890";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex min-h-[9.5rem] flex-col justify-end overflow-hidden rounded-xl border border-white/10 text-left outline-none transition duration-300 hover:border-white/25 focus-visible:ring-2 focus-visible:ring-[#8fb896] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1a16] sm:min-h-[11rem] lg:min-h-0 lg:rounded-2xl"
      style={{
        background:
          dest.tone === "cinema"
            ? "linear-gradient(160deg, #1c3530 0%, #0e1815 55%, #121a16 100%)"
            : dest.tone === "write"
              ? "linear-gradient(160deg, #243028 0%, #141c18 55%, #101612 100%)"
              : "linear-gradient(160deg, #3a2c26 0%, #1a1412 55%, #12100e 100%)",
      }}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${wash}`}
        aria-hidden
      />
      {/* Soft light sweep on hover */}
      <div
        className="pointer-events-none absolute -inset-x-1/4 -top-1/3 h-2/3 translate-y-[-20%] bg-gradient-to-b from-white/10 to-transparent opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative z-10 flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px]"
            style={{ color: accent }}
          >
            {dest.kicker}
          </span>
          <span
            className="font-[family-name:var(--font-display)] text-2xl font-light tabular-nums text-white/25 transition group-hover:text-white/45 sm:text-3xl"
            aria-hidden
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[1.35rem] font-semibold leading-tight tracking-tight text-[#f5faf7] sm:text-[1.55rem] lg:text-[1.7rem]">
            {dest.title}
          </h2>
          <p className="mt-1.5 max-w-[28ch] text-[13px] leading-snug text-[#a8b9ad] sm:text-sm sm:leading-relaxed">
            {dest.desc}
          </p>
          <span
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide sm:text-[13px]"
            style={{ color: accent }}
          >
            {dest.cta}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden
            >
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
}

function GameCard({ game, onSelect }: { game: GameInfo; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--teal)]/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--mist)] text-xl"
        aria-hidden
      >
        {game.icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)]">
          {game.title}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">
          {game.desc}
        </span>
      </span>
    </button>
  );
}
