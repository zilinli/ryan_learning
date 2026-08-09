/**
 * Pure Chess helpers — board mapping + local AI. No React.
 * Orientation: white at bottom; a1 is dark (bottom-left).
 * Difficulty ladder mirrors Xiangqi (yingwang-style depths + PST + quiescence).
 */

import { Chess, type Square, type Move } from "chess.js";

export type AiDifficulty = "easy" | "medium" | "hard" | "expert" | "master";

export const AI_DIFFICULTIES: AiDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
];

/** Search depth by level — capped for browser UX (<400ms typical). */
export function searchDepth(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "easy":
      return 1;
    case "medium":
      return 2;
    case "hard":
      return 2;
    case "expert":
      return 3;
    case "master":
      return 3;
  }
}

export function usesQuiescence(difficulty: AiDifficulty): boolean {
  return difficulty === "master";
}

/** Expert+ check pressure weight (medium/hard use base 50). */
export function checkBias(difficulty: AiDifficulty): number {
  return difficulty === "expert" || difficulty === "master" ? 90 : 50;
}

/** Soft time budget (ms) — iterative deepening stops when exceeded. */
export function timeBudgetMs(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "easy":
      return 0;
    case "medium":
      return 80;
    case "hard":
      return 150;
    case "expert":
      return 250;
    case "master":
      return 350;
  }
}

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

/** White-perspective PST; index = chess.js board row*8+col (row0 = rank 8). */
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
    20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10,
    0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
    0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20,
    20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20,
    -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0,
    5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10,
    0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20,
    -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0,
    -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
    5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5,
    5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
    -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
    -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

function pstBonus(type: string, color: "w" | "b", row: number, col: number): number {
  const table = PST[type];
  if (!table) return 0;
  const idx = color === "w" ? row * 8 + col : (7 - row) * 8 + col;
  return table[idx] ?? 0;
}

function evaluate(game: Chess, checkWeight = 50): number {
  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = (PIECE_VALUE[p.type] ?? 0) + pstBonus(p.type, p.color, r, c);
      score += p.color === "w" ? v : -v;
    }
  }
  if (game.isCheck()) score += game.turn() === "w" ? -checkWeight : checkWeight;
  return score;
}

function captureOrder(a: Move, b: Move): number {
  const va = a.captured ? PIECE_VALUE[a.captured] ?? 0 : 0;
  const vb = b.captured ? PIECE_VALUE[b.captured] ?? 0 : 0;
  return vb - va || Number(!!b.promotion) - Number(!!a.promotion);
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  checkWeight: number,
  quiescence: boolean,
): number {
  if (game.isGameOver()) {
    if (game.isCheckmate()) return game.turn() === "w" ? -100000 : 100000;
    if (game.isDraw()) return 0;
    return evaluate(game, checkWeight);
  }

  if (depth <= 0) {
    if (quiescence) {
      const captures = (game.moves({ verbose: true }) as Move[]).filter(
        (m) => m.captured || m.promotion,
      );
      if (captures.length === 0) return evaluate(game, checkWeight);
      let best = evaluate(game, checkWeight);
      for (const m of [...captures].sort(captureOrder).slice(0, 12)) {
        game.move(m);
        const val = evaluate(game, checkWeight);
        game.undo();
        best = maximizing ? Math.max(best, val) : Math.min(best, val);
      }
      return best;
    }
    return evaluate(game, checkWeight);
  }

  const moves = (game.moves({ verbose: true }) as Move[]).sort(captureOrder);

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move(m);
      const val = minimax(
        game,
        depth - 1,
        alpha,
        beta,
        false,
        checkWeight,
        quiescence,
      );
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
    const val = minimax(
      game,
      depth - 1,
      alpha,
      beta,
      true,
      checkWeight,
      quiescence,
    );
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

  const maxDepth = searchDepth(difficulty);
  const checkWeight = checkBias(difficulty);
  const q = usesQuiescence(difficulty);
  const budget = timeBudgetMs(difficulty);
  const maximizing = game.turn() === "w";
  const ordered = [...moves].sort(captureOrder);
  const t0 = Date.now();

  let bestSan = ordered[0].san;

  // Iterative deepening — keep last completed depth; abort when over budget.
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (depth > 1 && Date.now() - t0 > budget) break;

    let bestScore = maximizing ? -Infinity : Infinity;
    let depthBest = bestSan;
    let aborted = false;

    for (const m of ordered) {
      if (depth > 1 && Date.now() - t0 > budget) {
        aborted = true;
        break;
      }
      game.move(m);
      const score = minimax(
        game,
        depth - 1,
        -Infinity,
        Infinity,
        !maximizing,
        checkWeight,
        depth === maxDepth && q,
      );
      game.undo();
      if (maximizing ? score > bestScore : score < bestScore) {
        bestScore = score;
        depthBest = m.san;
      }
    }

    if (!aborted) bestSan = depthBest;
    else break;
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
