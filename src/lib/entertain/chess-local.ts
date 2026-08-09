/**
 * Pure helpers for Chess UI / local AI — unit-tested, no React.
 * Board orientation: white at bottom (a1 dark, bottom-left).
 */

import { Chess, type Square, type Move } from "chess.js";

export type AiDifficulty = "easy" | "medium" | "hard";

/** Visual row 0 = top of board = rank 8. */
export function squareFromVisual(row: number, col: number): Square {
  const files = "abcdefgh";
  return `${files[col]}${8 - row}` as Square;
}

/** chess.js board()[0] is rank 8 — same as visual row 0. */
export function pieceAtVisual(game: Chess, row: number, col: number) {
  return game.board()[row][col];
}

/** a1 is dark → visual (row=7,col=0) is dark. */
export function isLightSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

function evaluate(game: Chess): number {
  // Positive = good for white
  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p.type] ?? 0;
      score += p.color === "w" ? v : -v;
      // Tiny center bonus for knights/pawns
      if (p.type === "p" || p.type === "n") {
        const center = 3.5;
        const dist = Math.abs(r - center) + Math.abs(c - center);
        const bonus = (4 - dist) * 2;
        score += p.color === "w" ? bonus : -bonus;
      }
    }
  }
  if (game.isCheck()) {
    score += game.turn() === "w" ? -40 : 40;
  }
  return score;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || game.isGameOver()) {
    if (game.isCheckmate()) {
      return game.turn() === "w" ? -100000 : 100000;
    }
    if (game.isDraw()) return 0;
    return evaluate(game);
  }

  const moves = game.moves({ verbose: true }) as Move[];
  // Move ordering: captures first
  moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move(m);
      const val = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    game.move(m);
    const val = minimax(game, depth - 1, alpha, beta, true);
    game.undo();
    best = Math.min(best, val);
    alpha; // keep
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best;
}

/**
 * Pick a local AI move in SAN. Fast: depth 1–2. No network.
 * Side to move is whoever `game.turn()` says.
 */
export function chooseChessAiMove(
  fen: string,
  difficulty: AiDifficulty = "medium",
): string {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return "";

  if (difficulty === "easy") {
    // Prefer non-blunders lightly: random among all
    const pick = moves[Math.floor(Math.random() * moves.length)];
    return pick.san;
  }

  const depth = difficulty === "hard" ? 2 : 1;
  const maximizing = game.turn() === "w";

  let bestSan = moves[0].san;
  let bestScore = maximizing ? -Infinity : Infinity;

  // Shuffle for variety among equal scores
  const shuffled = [...moves].sort(() => Math.random() - 0.5);
  shuffled.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

  for (const m of shuffled) {
    game.move(m);
    const score = minimax(game, depth - 1, -Infinity, Infinity, !maximizing);
    game.undo();
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestSan = m.san;
    }
  }

  return bestSan;
}

/** Apply a human click-to-move. Returns new FEN + SAN or null if illegal. */
export function tryPlayerMove(
  fen: string,
  from: Square,
  to: Square,
): { fen: string; san: string } | null {
  const game = new Chess(fen);
  try {
    const promotion = to[1] === "8" || to[1] === "1" ? "q" : undefined;
    const result = game.move({ from, to, promotion });
    if (!result) return null;
    return { fen: game.fen(), san: result.san };
  } catch {
    return null;
  }
}

export function legalTargets(fen: string, from: Square): Square[] {
  const game = new Chess(fen);
  return game.moves({ square: from, verbose: true }).map((m) => m.to as Square);
}
