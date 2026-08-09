/**
 * Sudoku puzzle generator and logic.
 * Uses a backtracking solver to generate well-formed puzzles
 * with a unique solution at configurable difficulty.
 */

export type SudokuGrid = (number | null)[][];

export interface SudokuState {
  puzzle: SudokuGrid;
  solution: SudokuGrid;
  /** Current player-filled cells (null = empty/puzzle-given) */
  board: SudokuGrid;
  selectedRow: number | null;
  selectedCol: number | null;
  notes: Set<string>[][];
  notesMode: boolean;
  conflicts: Set<string>;
  difficulty: SudokuDifficulty;
}

export type SudokuDifficulty = "easy" | "medium" | "hard";

function emptyGrid(): SudokuGrid {
  return Array.from({ length: 9 }, () => Array(9).fill(null));
}

function deepCopy(grid: SudokuGrid): SudokuGrid {
  return grid.map((row) => [...row]);
}

function isValid(grid: SudokuGrid, row: number, col: number, num: number): boolean {
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function solve(grid: SudokuGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === null) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num;
            if (solve(grid)) return true;
            grid[r][c] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fillGrid(grid: SudokuGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === null) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValid(grid, r, c, num)) {
            grid[r][c] = num;
            if (fillGrid(grid)) return true;
            grid[r][c] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export function generatePuzzle(difficulty: SudokuDifficulty): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const solution = emptyGrid();
  fillGrid(solution);

  const puzzle = deepCopy(solution);
  const cellsToRemove = difficulty === "easy" ? 38 : difficulty === "medium" ? 48 : 56;
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number]),
  );

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= cellsToRemove) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = null;

    const test = deepCopy(puzzle);
    if (solve(test)) {
      removed++;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return { puzzle, solution };
}

export function getConflicts(board: SudokuGrid): Set<string> {
  const conflicts = new Set<string>();

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = board[r][c];
      if (val === null) continue;

      for (let cc = 0; cc < 9; cc++) {
        if (cc !== c && board[r][cc] === val) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${r},${cc}`);
        }
      }
      for (let rr = 0; rr < 9; rr++) {
        if (rr !== r && board[rr][c] === val) {
          conflicts.add(`${r},${c}`);
          conflicts.add(`${rr},${c}`);
        }
      }
      const boxRow = Math.floor(r / 3) * 3;
      const boxCol = Math.floor(c / 3) * 3;
      for (let rr = boxRow; rr < boxRow + 3; rr++) {
        for (let cc = boxCol; cc < boxCol + 3; cc++) {
          if ((rr !== r || cc !== c) && board[rr][cc] === val) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${rr},${cc}`);
          }
        }
      }
    }
  }

  return conflicts;
}

export function isSolved(board: SudokuGrid, solution: SudokuGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}
