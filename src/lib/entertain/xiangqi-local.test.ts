import { describe, expect, it } from "vitest";
import {
  getAllLegalMoveStrings,
  initXiangqi,
  type XiangqiBoard,
  type XiangqiState,
} from "./xiangqi";
import {
  AI_DIFFICULTIES,
  applyXiangqiMove,
  chooseXiangqiAiMove,
  searchDepth,
  usesQuiescence,
} from "./xiangqi-local";

function emptyBoard(): XiangqiBoard {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

/** Red to move — black rook hanging on file 0, capturable by red rook. */
function hangingRookState(): XiangqiState {
  const board = emptyBoard();
  board[9][4] = "K";
  board[0][3] = "k";
  board[9][0] = "R";
  board[5][0] = "r"; // unprotected
  return {
    board,
    turn: "red",
    moveHistory: [],
    selectedCell: null,
    status: "playing",
  };
}

describe("Xiangqi local AI — difficulty upgrade D1–D6", () => {
  it("D1: all 5 levels return a legal move", () => {
    let state = initXiangqi();
    state = applyXiangqiMove(state, getAllLegalMoveStrings(state.board, "red")[0]);
    const legal = getAllLegalMoveStrings(state.board, "black");
    for (const d of AI_DIFFICULTIES) {
      const ai = chooseXiangqiAiMove(state, d);
      expect(legal).toContain(ai);
    }
  }, 20000);

  it("D2: hard/expert/master capture hanging rook", () => {
    const state = hangingRookState();
    const capture = "9,0-5,0";
    expect(getAllLegalMoveStrings(state.board, "red")).toContain(capture);
    for (const d of ["hard", "expert", "master"] as const) {
      expect(chooseXiangqiAiMove(state, d)).toBe(capture);
    }
  });

  it("D4: medium move under 400ms from early midgame", () => {
    let state = initXiangqi();
    state = applyXiangqiMove(state, "6,0-5,0");
    state = applyXiangqiMove(state, "3,0-4,0");
    const t0 = Date.now();
    const ai = chooseXiangqiAiMove(state, "medium");
    expect(Date.now() - t0).toBeLessThan(400);
    expect(getAllLegalMoveStrings(state.board, state.turn)).toContain(ai);
  });

  it("D5: searchDepth monotonicity easy < medium < hard ≤ expert ≤ master", () => {
    expect(searchDepth("easy")).toBeLessThan(searchDepth("medium"));
    expect(searchDepth("medium")).toBeLessThan(searchDepth("hard"));
    expect(searchDepth("hard")).toBeLessThanOrEqual(searchDepth("expert"));
    expect(searchDepth("expert")).toBeLessThanOrEqual(searchDepth("master"));
  });

  it("D6: only master uses quiescence", () => {
    expect(usesQuiescence("master")).toBe(true);
    expect(usesQuiescence("hard")).toBe(false);
    expect(usesQuiescence("expert")).toBe(false);
  });

  it("applyXiangqiMove switches turn", () => {
    const state = initXiangqi();
    const m = getAllLegalMoveStrings(state.board, "red")[0];
    const next = applyXiangqiMove(state, m);
    expect(next.turn).toBe("black");
    expect(next.moveHistory.length).toBe(1);
  });
});
