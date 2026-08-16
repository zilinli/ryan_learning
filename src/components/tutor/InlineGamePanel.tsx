"use client";

import type { GameId } from "@/lib/entertain/types";
import { FractionVoyagerGame } from "../FractionVoyagerGame";
import { EcoGenesisGame } from "../EcoGenesisGame";
import { TimeVaultGame } from "../TimeVaultGame";
import { ForceBayGame } from "../ForceBayGame";
import { EnergyChainGame } from "../EnergyChainGame";
import { OrbitScoutGame } from "../OrbitScoutGame";
import { WordEchoGame } from "../WordEchoGame";
import { GameIcon } from "../learning-games/icons";

type Props = {
  gameId: GameId;
  /** Friendly title for the header (caller already resolved it). */
  title: string;
  onClose: () => void;
};

const TITLES: Partial<Record<GameId, string>> = {
  "fraction-voyager": "Fraction Voyager",
  "force-bay": "Force Bay",
  "energy-chain": "Energy Chain",
  "orbit-scout": "Orbit Scout",
  "eco-genesis": "Eco Genesis",
  "time-vault": "Time Vault",
  "word-echo": "Spell Words",
};

/**
 * Embedded mini-game inside the main chat. Container is height-capped with
 * internal scrolling so a game never blows up the message thread; game
 * components are self-contained and already record learning turns via
 * `recordStudioLearningTurn` (BKT path stays intact).
 */
export function InlineGamePanel({ gameId, title, onClose }: Props) {
  const heading = title || TITLES[gameId] || gameId;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--teal)]/40 bg-[var(--surface)] shadow-[0_8px_28px_rgba(20,40,35,0.08)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--teal)]/8 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[var(--teal)]" aria-hidden>
            <GameIcon id={gameId} size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
              Quick game
            </p>
            <p className="truncate text-xs text-[var(--ink-muted)]">{heading}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`/entertain?game=${gameId}`}
            className="min-h-9 rounded-lg border border-[var(--line)] px-2.5 text-xs text-[var(--ink-muted)] hover:border-[var(--teal)]/40 hover:text-[var(--teal)]"
          >
            Fullscreen
          </a>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>
      <div className="h-[60vh] overflow-y-auto bg-[var(--surface-muted)]/40">
        {gameId === "fraction-voyager" && <FractionVoyagerGame />}
        {gameId === "eco-genesis" && <EcoGenesisGame />}
        {gameId === "time-vault" && <TimeVaultGame />}
        {gameId === "force-bay" && <ForceBayGame />}
        {gameId === "energy-chain" && <EnergyChainGame />}
        {gameId === "orbit-scout" && <OrbitScoutGame />}
        {gameId === "word-echo" && <WordEchoGame />}
      </div>
    </div>
  );
}
