import { describe, expect, it } from "vitest";
import {
  getLegalGomokuMoves,
  initGomoku,
  isWinAt,
  placeGomoku,
} from "./gomoku";
import { chooseGomokuAiMove } from "./gomoku-local";

describe("Gomoku engine", () => {
  it("starts empty, black to move", () => {
    const s = initGomoku();
    expect(s.turn).toBe("black");
    expect(getLegalGomokuMoves(s)).toHaveLength(15 * 15);
  });

  it("detects five in a row", () => {
    let s = initGomoku();
    // Alternate: black builds row 7 cols 0..4; white plays elsewhere
    for (let c = 0; c < 4; c++) {
      s = placeGomoku(s, 7, c);
      s = placeGomoku(s, 0, c);
    }
    s = placeGomoku(s, 7, 4);
    expect(s.status).toBe("black_win");
    expect(isWinAt(s.board, 7, 4, 15)).toBe(true);
  });

  it("AI returns legal move", () => {
    let s = initGomoku();
    s = placeGomoku(s, 7, 7);
    const m = chooseGomokuAiMove(s, "medium");
    expect(m).toMatch(/^\d+,\d+$/);
    expect(getLegalGomokuMoves(s)).toContain(m);
  });

  it("AI blocks obvious four", () => {
    let s = initGomoku();
    // Black builds open four horizontally; white should block
    s = placeGomoku(s, 7, 3);
    s = placeGomoku(s, 0, 0); // white
    s = placeGomoku(s, 7, 4);
    s = placeGomoku(s, 0, 1);
    s = placeGomoku(s, 7, 5);
    s = placeGomoku(s, 0, 2);
    s = placeGomoku(s, 7, 6);
    // white to move — should play 7,2 or 7,7
    const m = chooseGomokuAiMove(s, "hard");
    expect(["7,2", "7,7"]).toContain(m);
  });
});
