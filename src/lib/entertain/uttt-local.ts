/**
 * Local Ultimate TTT AI — heuristic + shallow α-β (jacobcohn / thehav0k style).
 * No network. Difficulty: easy | medium | hard | expert | master.
 */

import {
  applyMove,
  getLegalMoves,
  lineWinner,
  type BoardWinner,
  type Cell,
  type Player,
  type UtttState,
} from "./uttt";

export type AiDifficulty = "easy" | "medium" | "hard" | "expert" | "master";

export const AI_DIFFICULTIES: AiDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
];

export function searchDepth(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "easy":
      return 2;
    case "medium":
      return 3;
    case "hard":
      return 4;
    case "expert":
      return 5;
    case "master":
      return 6;
  }
}

const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function opp(p: Player): Player {
  return p === "X" ? "O" : "X";
}

function scoreLine(a: Cell, b: Cell, c: Cell, me: Player): number {
  const cells = [a, b, c];
  const mine = cells.filter((x) => x === me).length;
  const theirs = cells.filter((x) => x === opp(me)).length;
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 3) return 100;
  if (mine === 2) return 10;
  if (mine === 1) return 1;
  if (theirs === 3) return -100;
  if (theirs === 2) return -10;
  if (theirs === 1) return -1;
  return 0;
}

function scoreSmallBoard(cells: Cell[], me: Player): number {
  let s = 0;
  for (const [i, j, k] of LINES) {
    s += scoreLine(cells[i], cells[j], cells[k], me);
  }
  // Center / corner bias inside board
  if (cells[4] === me) s += 2;
  if (cells[4] === opp(me)) s -= 2;
  return s;
}

function scoreMeta(winners: BoardWinner[], me: Player): number {
  const asCells: Cell[] = winners.map((w) => (w === "X" || w === "O" ? w : null));
  let s = 0;
  for (const [i, j, k] of LINES) {
    s += scoreLine(asCells[i], asCells[j], asCells[k], me) * 50;
  }
  if (winners[4] === me) s += 30;
  if (winners[4] === opp(me)) s -= 30;
  return s;
}

/** Evaluate from `perspective` (positive = good for them). */
export function evaluate(state: UtttState, perspective: Player): number {
  if (state.status === "X_win") return perspective === "X" ? 100000 : -100000;
  if (state.status === "O_win") return perspective === "O" ? 100000 : -100000;
  if (state.status === "draw") return 0;

  let score = scoreMeta(state.winners, perspective);
  for (let b = 0; b < 9; b++) {
    if (state.winners[b] === perspective) score += 80;
    else if (state.winners[b] === opp(perspective)) score -= 80;
    else if (state.winners[b] === null) {
      score += scoreSmallBoard(state.boards[b], perspective);
    }
  }
  return score;
}

function minimax(
  state: UtttState,
  depth: number,
  alpha: number,
  beta: number,
  perspective: Player,
): number {
  if (depth === 0 || state.status !== "playing") {
    return evaluate(state, perspective);
  }
  const moves = getLegalMoves(state);
  if (moves.length === 0) return evaluate(state, perspective);

  const maximizing = state.turn === perspective;
  // Prefer center cell / center board / winning looks
  const ordered = [...moves].sort((a, b) => movePriority(state, b) - movePriority(state, a));

  if (maximizing) {
    let best = -Infinity;
    for (const m of ordered) {
      const val = minimax(applyMove(state, m), depth - 1, alpha, beta, perspective);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of ordered) {
    const val = minimax(applyMove(state, m), depth - 1, alpha, beta, perspective);
    best = Math.min(best, val);
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best;
}

function movePriority(state: UtttState, move: string): number {
  const [board, cell] = move.split(",").map(Number);
  let p = 0;
  if (cell === 4) p += 3;
  if (board === 4) p += 2;
  if ([0, 2, 6, 8].includes(cell)) p += 1;
  const next = applyMove(state, move);
  if (next.status === "X_win" || next.status === "O_win") p += 1000;
  if (next.winners[board] === state.turn && state.winners[board] === null) p += 40;
  return p;
}

export function chooseUtttAiMove(
  state: UtttState,
  difficulty: AiDifficulty = "medium",
): string {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return "";

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = searchDepth(difficulty);
  const perspective = state.turn;
  let best = moves[0];
  let bestScore = -Infinity;

  const ordered = [...moves].sort((a, b) => movePriority(state, b) - movePriority(state, a));

  for (const m of ordered) {
    const next = applyMove(state, m);
    // Immediate win
    if (
      (perspective === "X" && next.status === "X_win") ||
      (perspective === "O" && next.status === "O_win")
    ) {
      return m;
    }
    const score = minimax(next, depth - 1, -Infinity, Infinity, perspective);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export { lineWinner };
