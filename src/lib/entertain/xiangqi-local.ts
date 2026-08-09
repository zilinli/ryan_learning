/**
 * Local Xiangqi AI — client-side only (no network).
 * Research: yingwang/chinese_chess depth ladder + PST eval (Tencent Cloud tutorials).
 * Levels: easy | medium | hard | expert | master
 */

import {
  applyBoardMove,
  getAllLegalMoveStrings,
  getAllPseudoLegalMoveStrings,
  getLegalMoves,
  initXiangqi,
  isInCheck,
  selectCell,
  type XiangqiBoard,
  type XiangqiColor,
  type XiangqiPiece,
  type XiangqiState,
} from "./xiangqi";

export type AiDifficulty = "easy" | "medium" | "hard" | "expert" | "master";

export const AI_DIFFICULTIES: AiDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
];

/** Search depth by level (yingwang / js-chess-engine ladder, v0.6). */
export function searchDepth(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "easy":
      return 1;
    case "medium":
      return 2;
    case "hard":
      return 3;
    case "expert":
      return 4;
    case "master":
      return 5;
  }
}

export function usesQuiescence(difficulty: AiDifficulty): boolean {
  return difficulty === "expert" || difficulty === "master";
}

/** Soft time budget (ms) for iterative deepening. */
export function timeBudgetMs(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "easy":
      return 0;
    case "medium":
      return 120;
    case "hard":
      return 280;
    case "expert":
      return 500;
    case "master":
      return 700;
  }
}

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

/** Red-perspective PST, index = row * 9 + col (row0 = black back rank). */
const PST_PAWN = [
  9, 9, 9, 11, 13, 11, 9, 9, 9, 19, 24, 34, 40, 40, 40, 34, 24, 19, 7, 12, 16, 18,
  18, 18, 16, 12, 7, 7, 10, 13, 15, 15, 15, 13, 10, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const PST_ROOK = [
  14, 14, 12, 18, 16, 18, 12, 14, 14, 16, 20, 18, 24, 26, 24, 18, 20, 16, 12, 12,
  12, 18, 18, 18, 12, 12, 12, 12, 18, 16, 22, 22, 22, 16, 18, 12, 12, 14, 12, 18,
  18, 18, 12, 14, 12, 12, 16, 14, 20, 20, 20, 14, 16, 12, 6, 10, 8, 14, 14, 14, 8,
  10, 6, 4, 8, 6, 14, 12, 14, 6, 8, 4, 8, 4, 8, 16, 8, 16, 8, 4, 8, -2, 10, 6, 14,
  12, 14, 6, 10, -2,
];
const PST_HORSE = [
  4, 8, 16, 12, 4, 12, 16, 8, 4, 4, 10, 28, 16, 8, 16, 28, 10, 4, 12, 14, 16, 20,
  18, 20, 16, 14, 12, 8, 24, 18, 24, 20, 24, 18, 24, 8, 6, 16, 14, 18, 16, 18, 14,
  16, 6, 4, 12, 16, 14, 12, 14, 16, 12, 4, 2, 6, 8, 6, 10, 6, 8, 6, 2, 4, 2, 6, 4,
  4, 4, 6, 2, 4, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, -4, 0, 0, 0, 0, 0, -4, 0,
];
const PST_CANNON = [
  6, 4, 0, -10, -12, -10, 0, 4, 6, 2, 2, 0, -4, -14, -4, 0, 2, 2, 2, 2, 0, -10, -8,
  -10, 0, 2, 2, 0, 0, -2, 4, 10, 4, -2, 0, 0, 0, 0, 0, 2, 4, 2, 0, 0, 0, -2, 0, 4,
  2, 6, 2, 4, 0, -2, 0, 0, 0, 2, 4, 2, 0, 0, 0, 4, 0, 8, 6, 10, 6, 8, 0, 4, 0, 2,
  4, 6, 6, 6, 4, 2, 0, 0, 0, 2, 6, 6, 6, 2, 0, 0,
];

function pstBonus(piece: XiangqiPiece, row: number, col: number): number {
  const idx = row * 9 + col;
  const redIdx = piece === piece.toUpperCase() ? idx : 89 - idx;
  const t = piece.toUpperCase();
  if (t === "P") return PST_PAWN[redIdx] ?? 0;
  if (t === "R") return PST_ROOK[redIdx] ?? 0;
  if (t === "N") return PST_HORSE[redIdx] ?? 0;
  if (t === "C") return PST_CANNON[redIdx] ?? 0;
  if (t === "A" || t === "B") return 8;
  if (t === "K") return 4;
  return 0;
}

function pieceSide(p: XiangqiPiece): XiangqiColor {
  return "RNBAKCP".includes(p) ? "red" : "black";
}

function evaluate(board: XiangqiBoard, perspective: XiangqiColor): number {
  let score = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = (PIECE_VALUE[p] ?? 0) + pstBonus(p, r, c);
      score += pieceSide(p) === "red" ? v : -v;
    }
  }
  if (isInCheck(board, "red")) score -= 120;
  if (isInCheck(board, "black")) score += 120;
  return perspective === "red" ? score : -score;
}

function findKing(board: XiangqiBoard, color: XiangqiColor): boolean {
  const target = color === "red" ? "K" : "k";
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === target) return true;
    }
  }
  return false;
}

interface SearchNode {
  board: XiangqiBoard;
  turn: XiangqiColor;
  status: XiangqiState["status"];
}

function applyMoveString(state: SearchNode, move: string): SearchNode | null {
  const [fromS, toS] = move.split("-");
  if (!fromS || !toS) return null;
  const [fr, fc] = fromS.split(",").map(Number);
  const [tr, tc] = toS.split(",").map(Number);
  const board = applyBoardMove(state.board, { row: fr, col: fc }, { row: tr, col: tc });
  const nextTurn: XiangqiColor = state.turn === "red" ? "black" : "red";
  let status: XiangqiState["status"] = "playing";
  // King capture only here — full mate detection deferred to search (no legal replies).
  if (!findKing(board, nextTurn)) {
    status = state.turn === "red" ? "red_win" : "black_win";
  }
  return { board, turn: nextTurn, status };
}

function captureValue(board: XiangqiBoard, move: string): number {
  const [, toS] = move.split("-");
  const [tr, tc] = toS.split(",").map(Number);
  const cap = board[tr][tc];
  return cap ? PIECE_VALUE[cap] ?? 0 : 0;
}

function orderMoves(board: XiangqiBoard, moves: string[]): string[] {
  return [...moves].sort(
    (a, b) => captureValue(board, b) - captureValue(board, a),
  );
}

function minimax(
  state: SearchNode,
  depth: number,
  alpha: number,
  beta: number,
  perspective: XiangqiColor,
  quiescence: boolean,
): number {
  if (state.status !== "playing") {
    if (state.status === "red_win") return perspective === "red" ? 50000 : -50000;
    if (state.status === "black_win") return perspective === "black" ? 50000 : -50000;
    return 0;
  }

  const moves = getAllPseudoLegalMoveStrings(state.board, state.turn);
  if (moves.length === 0) {
    return evaluate(state.board, perspective);
  }

  if (depth <= 0) {
    if (quiescence) {
      // Legal captures only — pseudo-legal can “eat the king” and inflate leaves.
      const legal = getAllLegalMoveStrings(state.board, state.turn);
      const captures = legal.filter((m) => captureValue(state.board, m) > 0);
      if (captures.length === 0) return evaluate(state.board, perspective);
      const maximizing = state.turn === perspective;
      let best = evaluate(state.board, perspective);
      for (const m of orderMoves(state.board, captures).slice(0, 12)) {
        const next = applyMoveString(state, m);
        if (!next) continue;
        if (next.status !== "playing") {
          const mate =
            next.status === "red_win"
              ? perspective === "red"
                ? 50000
                : -50000
              : next.status === "black_win"
                ? perspective === "black"
                  ? 50000
                  : -50000
                : 0;
          best = maximizing ? Math.max(best, mate) : Math.min(best, mate);
          continue;
        }
        const val = evaluate(next.board, perspective);
        best = maximizing ? Math.max(best, val) : Math.min(best, val);
      }
      return best;
    }
    return evaluate(state.board, perspective);
  }

  const maximizing = state.turn === perspective;
  const ordered = orderMoves(state.board, moves);

  if (maximizing) {
    let best = -Infinity;
    for (const m of ordered) {
      const next = applyMoveString(state, m);
      if (!next) continue;
      const val = minimax(next, depth - 1, alpha, beta, perspective, quiescence);
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
    const val = minimax(next, depth - 1, alpha, beta, perspective, quiescence);
    best = Math.min(best, val);
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best === Infinity ? evaluate(state.board, perspective) : best;
}

function toSearchNode(state: XiangqiState): SearchNode {
  return { board: state.board, turn: state.turn, status: state.status };
}

/** Returns move as "r,c-r,c". */
export function chooseXiangqiAiMove(
  state: XiangqiState,
  difficulty: AiDifficulty = "medium",
): string {
  const moves = getAllLegalMoveStrings(state.board, state.turn);
  if (moves.length === 0) return "";

  const node = toSearchNode(state);
  const perspective = state.turn;

  if (difficulty === "easy") {
    const scored = moves.map((m) => {
      const next = applyMoveString(node, m);
      return { m, s: next ? evaluate(next.board, perspective) : -Infinity };
    });
    scored.sort((a, b) => b.s - a.s);
    const pool = scored.slice(0, Math.max(3, Math.ceil(scored.length / 2)));
    return pool[Math.floor(Math.random() * pool.length)].m;
  }

  const depthCap = searchDepth(difficulty);
  const q = usesQuiescence(difficulty);
  const budget = timeBudgetMs(difficulty);
  const t0 = Date.now();
  let best = moves[0];

  for (let depth = 1; depth <= depthCap; depth++) {
    if (depth > 1 && Date.now() - t0 > budget) break;

    let bestScore = -Infinity;
    let depthBest = best;
    let aborted = false;

    for (const m of orderMoves(state.board, moves)) {
      if (depth > 1 && Date.now() - t0 > budget) {
        aborted = true;
        break;
      }
      const next = applyMoveString(node, m);
      if (!next) continue;
      const score = minimax(
        next,
        depth - 1,
        -Infinity,
        Infinity,
        perspective,
        depth === depthCap && q,
      );
      if (score > bestScore) {
        bestScore = score;
        depthBest = m;
      }
    }

    if (!aborted) best = depthBest;
    else break;
  }
  return best;
}

export function applyXiangqiMove(
  state: XiangqiState,
  move: string,
): XiangqiState {
  const [fromS, toS] = move.split("-");
  if (!fromS || !toS) return state;
  const [fr, fc] = fromS.split(",").map(Number);
  const [tr, tc] = toS.split(",").map(Number);
  let next = selectCell(state, { row: fr, col: fc });
  next = selectCell(next, { row: tr, col: tc });
  if (next.moveHistory.length === state.moveHistory.length) return state;
  return next;
}

export { initXiangqi, getLegalMoves, selectCell };
