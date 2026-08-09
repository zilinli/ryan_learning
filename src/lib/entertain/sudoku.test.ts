import { describe, expect, it } from "vitest";
import {
  generatePuzzle,
  getConflicts,
  isSolved,
  type SudokuGrid,
} from "./sudoku";

function isValidComplete(grid: SudokuGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      if (v === null || v < 1 || v > 9) return false;
    }
  }
  return getConflicts(grid).size === 0;
}

describe("Sudoku engine", () => {
  it("S1: generated solution is full valid 1-9", () => {
    const { solution } = generatePuzzle("easy");
    expect(isValidComplete(solution)).toBe(true);
  });

  it("S2: puzzle is subset of solution; empties in band", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      const { puzzle, solution } = generatePuzzle(diff);
      let empty = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r][c] === null) empty++;
          else expect(puzzle[r][c]).toBe(solution[r][c]);
        }
      }
      expect(empty).toBeGreaterThan(20);
      expect(empty).toBeLessThan(65);
    }
  });

  it("S3: isSolved only when board equals solution", () => {
    const { puzzle, solution } = generatePuzzle("easy");
    expect(isSolved(puzzle, solution)).toBe(false);
    expect(isSolved(solution, solution)).toBe(true);
  });

  it("S4: conflict detection finds duplicate in row", () => {
    const board: SudokuGrid = Array.from({ length: 9 }, () =>
      Array(9).fill(null),
    );
    board[0][0] = 5;
    board[0][1] = 5;
    const conflicts = getConflicts(board);
    expect(conflicts.has("0,0")).toBe(true);
    expect(conflicts.has("0,1")).toBe(true);
  });
});
