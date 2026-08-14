/**
 * Learning Games shared design tokens (learning-games-v2.md §5).
 * One deep, dark base + a single accent per game. Shared source of truth so
 * the six games stay visually consistent without repeating literals.
 */

export type GameTokens = {
  /** Page background. */
  base: string;
  /** Card / panel background. */
  surface: string;
  /** Hairline border. */
  stroke: string;
  /** Single primary accent. */
  accent: string;
  /** Error / opposite-direction / collision. */
  danger: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
};

export type LearningGameId =
  | "fraction-voyager"
  | "force-bay"
  | "energy-chain"
  | "orbit-scout"
  | "eco-genesis"
  | "time-vault";

function make(
  accent: string,
  base: string,
  surface: string,
  ink: string,
  inkMuted: string,
  inkFaint: string,
): GameTokens {
  return {
    base,
    surface,
    stroke: "rgba(255,255,255,0.12)",
    accent,
    danger: "#fb7185",
    ink,
    inkMuted,
    inkFaint,
  };
}

export const GAME_TOKENS: Record<LearningGameId, GameTokens> = {
  "fraction-voyager": make("#4da3ff", "#0a0f1a", "#0d1424", "#e8f0ff", "#9fb8da", "#5f7a8f"),
  "force-bay": make("#2dd4bf", "#0b1210", "#12201c", "#e8f0ff", "#9fb8da", "#5f7a8f"),
  "energy-chain": make("#fbbf24", "#120f08", "#1a150c", "#f4ead5", "#cbb892", "#8a7a5c"),
  "orbit-scout": make("#a78bfa", "#0b0d14", "#121522", "#e8f0ff", "#9fb8da", "#5f6a8a"),
  "eco-genesis": make("#34d399", "#0c1410", "#13201a", "#e8f6ee", "#a9c6b8", "#6d8a7c"),
  "time-vault": make("#d4a15c", "#161009", "#1e1710", "#e8dcc8", "#c8b08a", "#8a7a5f"),
};
