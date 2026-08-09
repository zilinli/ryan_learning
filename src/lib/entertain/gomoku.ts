/**
 * Gomoku (五子棋) — 15×15 freestyle, five-in-a-row wins.
 */

export type Stone = "black" | "white";

export interface GomokuState {
  size: number;
  board: (Stone | null)[][];
  turn: Stone;
  status: "playing" | "black_win" | "white_win" | "draw";
  lastMove: { row: number; col: number } | null;
  moveCount: number;
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function initGomoku(size = 15): GomokuState {
  return {
    size,
    board: Array.from({ length: size }, () => Array(size).fill(null)),
    turn: "black",
    status: "playing",
    lastMove: null,
    moveCount: 0,
  };
}

function countDir(
  board: (Stone | null)[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
  size: number,
): number {
  let n = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && c >= 0 && r < size && c < size && board[r][c] === stone) {
    n++;
    r += dr;
    c += dc;
  }
  return n;
}

export function isWinAt(
  board: (Stone | null)[][],
  row: number,
  col: number,
  size: number,
): boolean {
  const stone = board[row][col];
  if (!stone) return false;
  for (const [dr, dc] of DIRS) {
    const total =
      1 +
      countDir(board, row, col, dr, dc, stone, size) +
      countDir(board, row, col, -dr, -dc, stone, size);
    if (total >= 5) return true;
  }
  return false;
}

export function placeGomoku(
  state: GomokuState,
  row: number,
  col: number,
): GomokuState {
  if (state.status !== "playing") return state;
  if (row < 0 || col < 0 || row >= state.size || col >= state.size) return state;
  if (state.board[row][col] !== null) return state;

  const board = state.board.map((r) => [...r]);
  board[row][col] = state.turn;
  const moveCount = state.moveCount + 1;

  if (isWinAt(board, row, col, state.size)) {
    return {
      ...state,
      board,
      lastMove: { row, col },
      moveCount,
      status: state.turn === "black" ? "black_win" : "white_win",
    };
  }

  if (moveCount >= state.size * state.size) {
    return {
      ...state,
      board,
      lastMove: { row, col },
      moveCount,
      status: "draw",
    };
  }

  return {
    ...state,
    board,
    lastMove: { row, col },
    moveCount,
    turn: state.turn === "black" ? "white" : "black",
  };
}

export function getLegalGomokuMoves(state: GomokuState): string[] {
  if (state.status !== "playing") return [];
  const out: string[] = [];
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.board[r][c] === null) out.push(`${r},${c}`);
    }
  }
  return out;
}
