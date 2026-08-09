/**
 * Ultimate Tic-Tac-Toe engine — Wikipedia / Math-with-Bad-Drawings rules.
 * Pure TS; no React. Move encoding: "board,cell" (0–8 each, row-major).
 */

export type Player = "X" | "O";
export type Cell = Player | null;
export type BoardWinner = Player | "draw" | null;

export interface UtttMove {
  board: number;
  cell: number;
}

export interface UtttState {
  boards: Cell[][];
  winners: BoardWinner[];
  /** Required small board, or null when player may choose any unfinished board. */
  activeBoard: number | null;
  turn: Player;
  status: "playing" | "X_win" | "O_win" | "draw";
  lastMove: UtttMove | null;
  moveCount: number;
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

export function lineWinner(cells: Cell[]): Player | null {
  for (const [a, b, c] of LINES) {
    const v = cells[a];
    if (v && v === cells[b] && v === cells[c]) return v;
  }
  return null;
}

function boardWinnerFromCells(cells: Cell[]): BoardWinner {
  const w = lineWinner(cells);
  if (w) return w;
  if (cells.every((c) => c !== null)) return "draw";
  return null;
}

function metaWinner(winners: BoardWinner[]): Player | null {
  const asCells = winners.map((w) => (w === "X" || w === "O" ? w : null));
  return lineWinner(asCells);
}

function isBoardPlayable(winners: BoardWinner[], board: number): boolean {
  return winners[board] === null;
}

export function initUttt(): UtttState {
  return {
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    winners: Array(9).fill(null),
    activeBoard: null,
    turn: "X",
    status: "playing",
    lastMove: null,
    moveCount: 0,
  };
}

export function parseMove(s: string): UtttMove | null {
  const parts = s.split(",").map(Number);
  if (parts.length !== 2) return null;
  const [board, cell] = parts;
  if (
    !Number.isInteger(board) ||
    !Number.isInteger(cell) ||
    board < 0 ||
    board > 8 ||
    cell < 0 ||
    cell > 8
  ) {
    return null;
  }
  return { board, cell };
}

export function moveKey(m: UtttMove): string {
  return `${m.board},${m.cell}`;
}

export function getLegalMoves(state: UtttState): string[] {
  if (state.status !== "playing") return [];
  const out: string[] = [];

  const boardsToScan: number[] =
    state.activeBoard !== null && isBoardPlayable(state.winners, state.activeBoard)
      ? [state.activeBoard]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((b) => isBoardPlayable(state.winners, b));

  for (const b of boardsToScan) {
    for (let c = 0; c < 9; c++) {
      if (state.boards[b][c] === null) out.push(`${b},${c}`);
    }
  }
  return out;
}

export function applyMove(state: UtttState, move: string | UtttMove): UtttState {
  if (state.status !== "playing") return state;
  const m = typeof move === "string" ? parseMove(move) : move;
  if (!m) return state;

  const legal = getLegalMoves(state);
  const key = moveKey(m);
  if (!legal.includes(key)) return state;

  const boards = state.boards.map((row) => [...row]);
  boards[m.board][m.cell] = state.turn;

  const winners = [...state.winners];
  if (winners[m.board] === null) {
    winners[m.board] = boardWinnerFromCells(boards[m.board]);
  }

  const meta = metaWinner(winners);
  let status: UtttState["status"] = "playing";
  if (meta === "X") status = "X_win";
  else if (meta === "O") status = "O_win";

  let activeBoard: number | null = m.cell;
  if (!isBoardPlayable(winners, m.cell)) {
    activeBoard = null;
  }

  const nextTurn: Player = state.turn === "X" ? "O" : "X";
  const moveCount = state.moveCount + 1;

  let next: UtttState = {
    boards,
    winners,
    activeBoard,
    turn: nextTurn,
    status,
    lastMove: m,
    moveCount,
  };

  if (status === "playing" && getLegalMoves(next).length === 0) {
    next = { ...next, status: "draw" };
  }

  return next;
}

/** Convenience: clone state with optional overrides (tests / AI). */
export function withUttt(state: UtttState, patch: Partial<UtttState>): UtttState {
  return { ...state, ...patch };
}
