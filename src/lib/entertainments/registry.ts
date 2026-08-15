import type { GameId, GameMeta } from "./types";

export const GAMES: GameMeta[] = [
  {
    id: "sudoku",
    titleEn: "Sudoku",
    blurbEn: "Fill 1–9 so every row, column and box is unique.",
  },
  {
    id: "sokoban",
    titleEn: "Sokoban",
    blurbEn: "Push each crate onto a target square.",
  },
  {
    id: "klotski",
    titleEn: "Klotski",
    blurbEn: "Slide blocks so the big piece escapes.",
  },
  {
    id: "chess",
    titleEn: "Chess",
    blurbEn: "Classic international chess on an 8×8 board.",
  },
  {
    id: "xiangqi",
    titleEn: "Xiangqi",
    blurbEn: "Chinese chess — generals, chariots and cannons.",
  },
  {
    id: "go",
    titleEn: "Go (9×9)",
    blurbEn: "Capture by surrounding — a friendly teaching board.",
  },
];

export function isGameId(id: string): id is GameId {
  return GAMES.some((g) => g.id === id);
}
