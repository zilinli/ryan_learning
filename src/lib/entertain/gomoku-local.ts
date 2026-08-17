/**
 * Local Gomoku AI — pattern heuristics + shallow search (ZoliQua-style).
 */

import {
  getLegalGomokuMoves,
  isWinAt,
  placeGomoku,
  type GomokuState,
  type Stone,
} from "./gomoku";

export type AiDifficulty = "easy" | "medium" | "hard";

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

/** Search radius around existing stones, scaled by difficulty. */
function candidateRadius(difficulty: AiDifficulty): number {
  return difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;
}

/** Candidates near existing stones (speed). */
function candidateMoves(state: GomokuState, difficulty: AiDifficulty = "medium"): string[] {
  const { board, size } = state;
  const hasAny = state.moveCount > 0;
  if (!hasAny) {
    const m = Math.floor(size / 2);
    return [`${m},${m}`];
  }
  const rad = candidateRadius(difficulty);
  const set = new Set<string>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) continue;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
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
    const pool = candidateMoves(state, difficulty);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const me = state.turn;
  const opp: Stone = me === "black" ? "white" : "black";
  const board = state.board.map((r) => [...r]);
  const cands = candidateMoves(state, difficulty);

  let best = cands[0];
  let bestScore = -Infinity;

  for (const m of cands) {
    const [r, c] = m.split(",").map(Number);
    const attack = scorePoint(board, r, c, me, state.size);
    const defend = scorePoint(board, r, c, opp, state.size);
    let score = attack + defend * 0.9;

    if (difficulty === "hard" && attack < 100000) {
      // One-ply opponent reply penalty
      board[r][c] = me;
      let worst = 0;
      const replies = candidateMoves({
        ...state,
        board,
        turn: opp,
        moveCount: state.moveCount + 1,
      }).slice(0, 20);
      for (const rm of replies) {
        const [rr, rc] = rm.split(",").map(Number);
        worst = Math.max(worst, scorePoint(board, rr, rc, opp, state.size));
      }
      board[r][c] = null;
      score -= worst * 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export { placeGomoku, initGomoku };
