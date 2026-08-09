import { describe, expect, it } from "vitest";
import {
  getAllLegalMoveStrings,
  getLegalMoves,
  initXiangqi,
  selectCell,
  type XiangqiBoard,
  type XiangqiState,
} from "./xiangqi";

function emptyBoard(): XiangqiBoard {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

describe("Xiangqi engine", () => {
  it("X1: initial board has kings and five pawns each", () => {
    const s = initXiangqi();
    expect(s.board[9][4]).toBe("K");
    expect(s.board[0][4]).toBe("k");
    const redPawns = s.board[6].filter((c) => c === "P").length;
    const blackPawns = s.board[3].filter((c) => c === "p").length;
    expect(redPawns).toBe(5);
    expect(blackPawns).toBe(5);
    expect(s.turn).toBe("red");
  });

  it("X2: red chariot can move along file when clear", () => {
    const board = emptyBoard();
    board[9][0] = "R";
    board[9][4] = "K";
    board[0][3] = "k"; // different file — avoid flying-general check masking rook moves
    const moves = getLegalMoves(board, { row: 9, col: 0 });
    expect(moves.some((m) => m.row === 5 && m.col === 0)).toBe(true);
  });

  it("X3: horse blocked by 蹩马腿 cannot jump", () => {
    const board = emptyBoard();
    board[5][4] = "N";
    board[4][4] = "P"; // block forward leg
    board[9][4] = "K";
    board[0][4] = "k";
    const moves = getLegalMoves(board, { row: 5, col: 4 });
    // Without blocker, N at 5,4 can go to 3,3 / 3,5; with blocker on 4,4 those are illegal
    expect(moves.some((m) => m.row === 3 && m.col === 3)).toBe(false);
    expect(moves.some((m) => m.row === 3 && m.col === 5)).toBe(false);
  });

  it("X4: elephant cannot cross river", () => {
    const board = emptyBoard();
    board[5][2] = "B"; // red elephant just across river attempt from red half
    board[9][4] = "K";
    board[0][4] = "k";
    // Place elephant in black half — should have no legal moves to stay illegal
    board[5][2] = null;
    board[3][2] = "B"; // red elephant on black side (illegal placement) — getRawMoves filters inOwnHalf
    const moves = getLegalMoves(board, { row: 3, col: 2 });
    expect(moves.every((m) => m.row >= 5)).toBe(true);
  });

  it("X5: advisor stays in palace", () => {
    const board = emptyBoard();
    board[9][3] = "A";
    board[9][4] = "K";
    board[0][4] = "k";
    const moves = getLegalMoves(board, { row: 9, col: 3 });
    for (const m of moves) {
      expect(m.col).toBeGreaterThanOrEqual(3);
      expect(m.col).toBeLessThanOrEqual(5);
      expect(m.row).toBeGreaterThanOrEqual(7);
    }
  });

  it("X6: red has legal moves at start", () => {
    const s = initXiangqi();
    const legal = getAllLegalMoveStrings(s.board, "red");
    expect(legal.length).toBeGreaterThan(10);
  });

  it("X7: cannot move king into check (exposed to enemy rook)", () => {
    const board = emptyBoard();
    board[9][4] = "K";
    board[7][4] = "r"; // black rook on same file
    board[0][3] = "k";
    const moves = getLegalMoves(board, { row: 9, col: 4 });
    // King cannot stay on file 4 if that leaves check — moving to 9,3 or 9,5 may be ok
    // Moving to 8,4 still on file with rook unless capture — capture 7,4 should be allowed if adjacent... king only moves 1
    expect(moves.some((m) => m.row === 8 && m.col === 4)).toBe(false);
  });

  it("X8: select + move switches turn to black", () => {
    let s: XiangqiState = initXiangqi();
    // Move red pawn forward: from (6,0) to (5,0)
    s = selectCell(s, { row: 6, col: 0 });
    expect(s.selectedCell).toEqual({ row: 6, col: 0 });
    s = selectCell(s, { row: 5, col: 0 });
    expect(s.board[5][0]).toBe("P");
    expect(s.board[6][0]).toBeNull();
    expect(s.turn).toBe("black");
  });
});
