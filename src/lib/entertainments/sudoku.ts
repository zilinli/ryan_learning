/** Lightweight Sudoku generator / validator (9×9). */

export type SudokuDifficulty = "easy" | "medium" | "hard";

export type SudokuState = {
  /** 0 = empty; puzzle clues are fixed */
  board: number[];
  given: boolean[];
  solution: number[];
};

function idx(r: number, c: number) {
  return r * 9 + c;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function canPlace(board: number[], r: number, c: number, n: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[idx(r, i)] === n || board[idx(i, c)] === n) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      if (board[idx(br + dr, bc + dc)] === n) return false;
    }
  }
  return true;
}

function solve(board: number[]): boolean {
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!canPlace(board, r, c, n)) continue;
      board[i] = n;
      if (solve(board)) return true;
      board[i] = 0;
    }
    return false;
  }
  return true;
}

function countSolutions(board: number[], limit = 2): number {
  let count = 0;
  const walk = (): boolean => {
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      for (let n = 1; n <= 9; n++) {
        if (!canPlace(board, r, c, n)) continue;
        board[i] = n;
        if (walk()) {
          /* continue */
        }
        board[i] = 0;
        if (count >= limit) return true;
      }
      return false;
    }
    count += 1;
    return count >= limit;
  };
  walk();
  return count;
}

const CLUES: Record<SudokuDifficulty, number> = {
  easy: 40,
  medium: 32,
  hard: 26,
};

export function generateSudoku(diff: SudokuDifficulty = "easy"): SudokuState {
  const solution = Array(81).fill(0) as number[];
  solve(solution);
  const board = [...solution];
  const order = shuffle([...Array(81).keys()]);
  let remaining = 81;
  const target = CLUES[diff];
  for (const i of order) {
    if (remaining <= target) break;
    const keep = board[i]!;
    board[i] = 0;
    const trial = [...board];
    if (countSolutions(trial, 2) !== 1) {
      board[i] = keep;
    } else {
      remaining -= 1;
    }
  }
  const given = board.map((n) => n !== 0);
  return { board, given, solution: [...solution] };
}

export function setSudokuCell(
  state: SudokuState,
  cell: number,
  value: number,
): SudokuState {
  if (state.given[cell]) return state;
  if (value < 0 || value > 9) return state;
  const board = [...state.board];
  board[cell] = value;
  return { ...state, board };
}

export function isSudokuComplete(state: SudokuState): boolean {
  return state.board.every((n, i) => n === state.solution[i]);
}

export function sudokuConflicts(state: SudokuState): boolean[] {
  const bad = Array(81).fill(false) as boolean[];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const i = idx(r, c);
      const n = state.board[i]!;
      if (!n) continue;
      // temporarily clear and test uniqueness
      const board = [...state.board];
      board[i] = 0;
      if (!canPlace(board, r, c, n)) bad[i] = true;
    }
  }
  return bad;
}
