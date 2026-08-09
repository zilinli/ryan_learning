/**
 * Local Gomoku AI — pattern heuristics + shallow search (ZoliQua-style).
 */

import {
  getLegalGomokuMoves,
  initGomoku,
  isWinAt,
  placeGomoku,
  type GomokuState,
  type Stone,
} from "./gomoku";

export type AiDifficulty = "easy" | "medium" | "hard" | "expert" | "master";

export const AI_DIFFICULTIES: AiDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
];

function defendWeight(difficulty: AiDifficulty): number {
  switch (difficulty) {
    case "medium":
      return 0.9;
    case "hard":
      return 0.95;
    case "expert":
      return 1.05;
    case "master":
      return 1.15;
    default:
      return 0.9;
  }
}

function replyLookahead(difficulty: AiDifficulty): { count: number; weight: number } {
  switch (difficulty) {
    case "hard":
      return { count: 20, weight: 0.5 };
    case "expert":
      return { count: 28, weight: 0.65 };
    case "master":
      return { count: 36, weight: 0.8 };
    default:
      return { count: 0, weight: 0 };
  }
}

function countOpen(
  board: (Stone | null)[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
  size: number,
): { len: number; open: number } {
  let len = 1;
  let open = 0;
  for (const sign of [1, -1]) {
    let r = row + dr * sign;
    let c = col + dc * sign;
    let run = 0;
    while (r >= 0 && c >= 0 && r < size && c < size && board[r][c] === stone) {
      run++;
      r += dr * sign;
      c += dc * sign;
    }
    len += run;
    if (r >= 0 && c >= 0 && r < size && c < size && board[r][c] === null) open++;
  }
  return { len, open };
}

function scorePoint(
  board: (Stone | null)[][],
  row: number,
  col: number,
  stone: Stone,
  size: number,
): number {
  if (board[row][col] !== null) return -1;
  // Temporary place
  board[row][col] = stone;
  if (isWinAt(board, row, col, size)) {
    board[row][col] = null;
    return 100000;
  }
  let score = 0;
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of dirs) {
    const { len, open } = countOpen(board, row, col, dr, dc, stone, size);
    if (len >= 5) score += 100000;
    else if (len === 4 && open === 2) score += 10000;
    else if (len === 4 && open === 1) score += 1000;
    else if (len === 3 && open === 2) score += 500;
    else if (len === 3 && open === 1) score += 100;
    else if (len === 2 && open === 2) score += 50;
    else score += len * 2 + open;
  }
  // Center bias
  const mid = (size - 1) / 2;
  score += Math.max(0, 8 - (Math.abs(row - mid) + Math.abs(col - mid)));
  board[row][col] = null;
  return score;
}

/** Candidates near existing stones (speed). */
function candidateMoves(state: GomokuState): string[] {
  const { board, size } = state;
  const hasAny = state.moveCount > 0;
  if (!hasAny) {
    const m = Math.floor(size / 2);
    return [`${m},${m}`];
  }
  const set = new Set<string>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
          if (board[nr][nc] === null) set.add(`${nr},${nc}`);
        }
      }
    }
  }
  return set.size > 0 ? [...set] : getLegalGomokuMoves(state);
}

export function chooseGomokuAiMove(
  state: GomokuState,
  difficulty: AiDifficulty = "medium",
): string {
  const legal = getLegalGomokuMoves(state);
  if (legal.length === 0) return "";

  if (difficulty === "easy") {
    const pool = candidateMoves(state);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const me = state.turn;
  const opp: Stone = me === "black" ? "white" : "black";
  const board = state.board.map((r) => [...r]);
  const cands = candidateMoves(state);
  const dWeight = defendWeight(difficulty);
  const look = replyLookahead(difficulty);

  let best = cands[0];
  let bestScore = -Infinity;

  for (const m of cands) {
    const [r, c] = m.split(",").map(Number);
    const attack = scorePoint(board, r, c, me, state.size);
    const defend = scorePoint(board, r, c, opp, state.size);
    let score = attack + defend * dWeight;

    if (look.count > 0 && attack < 100000) {
      // One-ply opponent reply penalty
      board[r][c] = me;
      let worst = 0;
      const replies = candidateMoves({
        ...state,
        board,
        turn: opp,
        moveCount: state.moveCount + 1,
      }).slice(0, look.count);
      for (const rm of replies) {
        const [rr, rc] = rm.split(",").map(Number);
        worst = Math.max(worst, scorePoint(board, rr, rc, opp, state.size));
      }
      board[r][c] = null;
      score -= worst * look.weight;
    }

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export { placeGomoku, initGomoku };
