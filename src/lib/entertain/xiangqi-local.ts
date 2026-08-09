/**
 * Local Xiangqi AI — same pattern as chess-local (no network).
 * Reference: elephantops / xiangqi.js style material + shallow α-β.
 */

import {
  getAllLegalMoveStrings,
  getLegalMoves,
  initXiangqi,
  isInCheck,
  selectCell,
  type XiangqiBoard,
  type XiangqiColor,
  type XiangqiPiece,
  type XiangqiState,
} from "./xiangqi";

export type AiDifficulty = "easy" | "medium" | "hard";

const PIECE_VALUE: Record<string, number> = {
  K: 10000,
  k: 10000,
  R: 900,
  r: 900,
  C: 450,
  c: 450,
  N: 400,
  n: 400,
  B: 200,
  b: 200,
  A: 200,
  a: 200,
  P: 100,
  p: 100,
};

function pieceSide(p: XiangqiPiece): XiangqiColor {
  return "RNBAKCP".includes(p) ? "red" : "black";
}

function evaluate(board: XiangqiBoard, perspective: XiangqiColor): number {
  let score = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p] ?? 0;
      score += pieceSide(p) === "red" ? v : -v;
      // Encourage advanced pawns
      if (p === "P") score += (9 - r) * 4;
      if (p === "p") score -= r * 4;
    }
  }
  if (isInCheck(board, "red")) score -= 80;
  if (isInCheck(board, "black")) score += 80;
  return perspective === "red" ? score : -score;
}

function applyMoveString(state: XiangqiState, move: string): XiangqiState | null {
  const [fromS, toS] = move.split("-");
  if (!fromS || !toS) return null;
  const [fr, fc] = fromS.split(",").map(Number);
  const [tr, tc] = toS.split(",").map(Number);
  let next = selectCell(state, { row: fr, col: fc });
  next = selectCell(next, { row: tr, col: tc });
  if (next.moveHistory.length === state.moveHistory.length) return null;
  return next;
}

function minimax(
  state: XiangqiState,
  depth: number,
  alpha: number,
  beta: number,
  perspective: XiangqiColor,
): number {
  if (depth === 0 || state.status !== "playing") {
    if (state.status === "red_win") return perspective === "red" ? 50000 : -50000;
    if (state.status === "black_win") return perspective === "black" ? 50000 : -50000;
    return evaluate(state.board, perspective);
  }

  const moves = getAllLegalMoveStrings(state.board, state.turn);
  if (moves.length === 0) {
    return evaluate(state.board, perspective);
  }

  const maximizing = state.turn === perspective;
  // Capture-first ordering
  const ordered = [...moves].sort((a, b) => {
    const [, toA] = a.split("-");
    const [, toB] = b.split("-");
    const [ar, ac] = toA.split(",").map(Number);
    const [br, bc] = toB.split(",").map(Number);
    const capA = state.board[ar][ac] ? 1 : 0;
    const capB = state.board[br][bc] ? 1 : 0;
    return capB - capA;
  });

  if (maximizing) {
    let best = -Infinity;
    for (const m of ordered) {
      const next = applyMoveString(state, m);
      if (!next) continue;
      const val = minimax(next, depth - 1, alpha, beta, perspective);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best === -Infinity ? evaluate(state.board, perspective) : best;
  }

  let best = Infinity;
  for (const m of ordered) {
    const next = applyMoveString(state, m);
    if (!next) continue;
    const val = minimax(next, depth - 1, alpha, beta, perspective);
    best = Math.min(best, val);
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best === Infinity ? evaluate(state.board, perspective) : best;
}

/** Returns move as "r,c-r,c". */
export function chooseXiangqiAiMove(
  state: XiangqiState,
  difficulty: AiDifficulty = "medium",
): string {
  const moves = getAllLegalMoveStrings(state.board, state.turn);
  if (moves.length === 0) return "";

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === "hard" ? 2 : 1;
  const perspective = state.turn;
  let best = moves[0];
  let bestScore = -Infinity;

  const ordered = [...moves].sort((a, b) => {
    const [, toA] = a.split("-");
    const [, toB] = b.split("-");
    const [ar, ac] = toA.split(",").map(Number);
    const [br, bc] = toB.split(",").map(Number);
    return (state.board[br][bc] ? 1 : 0) - (state.board[ar][ac] ? 1 : 0);
  });

  for (const m of ordered) {
    const next = applyMoveString(state, m);
    if (!next) continue;
    const score = minimax(next, depth - 1, -Infinity, Infinity, perspective);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function applyXiangqiMove(
  state: XiangqiState,
  move: string,
): XiangqiState {
  return applyMoveString(state, move) ?? state;
}

export { initXiangqi, getLegalMoves, selectCell };
