/**
 * Pure Chess helpers — board mapping + local AI. No React.
 * Orientation: white at bottom; a1 is dark (bottom-left).
 */

import { Chess, type Square, type Move } from "chess.js";

export type AiDifficulty = "easy" | "medium" | "hard";

const FILES = "abcdefgh";

/** Visual row 0 = top = rank 8; col 0 = file a. */
export function squareFromVisual(row: number, col: number): Square {
  return `${FILES[col]}${8 - row}` as Square;
}

/** chess.js board()[0] === rank 8 === visual row 0. */
export function pieceAtVisual(game: Chess, row: number, col: number) {
  return game.board()[row]?.[col] ?? null;
}

/** a1 (row=7,col=0) is dark. */
export function isLightSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 0;
}

/** Sanity: piece shown at visual cell must equal game.get(square). */
export function assertBoardMapping(game: Chess): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = squareFromVisual(row, col);
      const fromBoard = pieceAtVisual(game, row, col);
      const fromGet = game.get(sq);
      const a = fromBoard ? `${fromBoard.color}${fromBoard.type}` : "";
      const b = fromGet ? `${fromGet.color}${fromGet.type}` : "";
      if (a !== b) return false;
    }
  }
  return true;
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
  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p.type] ?? 0;
      score += p.color === "w" ? v : -v;
    }
  }
  if (game.isCheck()) score += game.turn() === "w" ? -50 : 50;
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
    if (game.isCheckmate()) return game.turn() === "w" ? -100000 : 100000;
    if (game.isDraw()) return 0;
    return evaluate(game);
  }

  const moves = game.moves({ verbose: true }) as Move[];
  moves.sort((a, b) => Number(!!b.captured) - Number(!!a.captured));

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
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseChessAiMove(
  fen: string,
  difficulty: AiDifficulty = "medium",
): string {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return "";

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)].san;
  }

  const depth = difficulty === "hard" ? 2 : 1;
  const maximizing = game.turn() === "w";
  let bestSan = moves[0].san;
  let bestScore = maximizing ? -Infinity : Infinity;

  const ordered = [...moves].sort(
    (a, b) => Number(!!b.captured) - Number(!!a.captured),
  );

  for (const m of ordered) {
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

export function tryPlayerMove(
  fen: string,
  from: Square,
  to: Square,
): { fen: string; san: string; from: Square; to: Square } | null {
  const game = new Chess(fen);
  try {
    const needsPromo =
      game.get(from)?.type === "p" && (to[1] === "8" || to[1] === "1");
    const result = game.move({
      from,
      to,
      promotion: needsPromo ? "q" : undefined,
    });
    if (!result) return null;
    return { fen: game.fen(), san: result.san, from: result.from, to: result.to };
  } catch {
    return null;
  }
}

export function legalTargets(fen: string, from: Square): Square[] {
  const game = new Chess(fen);
  const piece = game.get(from);
  if (!piece || piece.color !== game.turn()) return [];
  return game.moves({ square: from, verbose: true }).map((m) => m.to as Square);
}

export function statusText(fen: string, mode: "ai" | "pvp"): string {
  const g = new Chess(fen);
  if (g.isCheckmate()) {
    return `Checkmate — ${g.turn() === "w" ? "Black" : "White"} wins!`;
  }
  if (g.isStalemate()) return "Stalemate — Draw";
  if (g.isDraw()) return "Draw";
  if (g.isCheck()) {
    return `${g.turn() === "w" ? "White" : "Black"} in check`;
  }
  if (mode === "ai") {
    return g.turn() === "w" ? "Your turn (White)" : "AI moving…";
  }
  return `${g.turn() === "w" ? "White" : "Black"} to move`;
}
