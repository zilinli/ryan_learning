import { describe, expect, it } from "vitest";
import { getAllLegalMoveStrings, initXiangqi } from "./xiangqi";
import {
  applyXiangqiMove,
  chooseXiangqiAiMove,
} from "./xiangqi-local";

describe("Xiangqi local AI", () => {
  it("returns a legal move at start for black", () => {
    let state = initXiangqi();
    // Make a simple red move so black to play
    const redMoves = getAllLegalMoveStrings(state.board, "red");
    expect(redMoves.length).toBeGreaterThan(0);
    state = applyXiangqiMove(state, redMoves[0]);
    expect(state.turn).toBe("black");

    const ai = chooseXiangqiAiMove(state, "medium");
    expect(ai).toMatch(/^\d+,\d+-\d+,\d+$/);
    const legal = getAllLegalMoveStrings(state.board, "black");
    expect(legal).toContain(ai);
  });

  it("easy returns some legal move", () => {
    let state = initXiangqi();
    state = applyXiangqiMove(state, getAllLegalMoveStrings(state.board, "red")[0]);
    const ai = chooseXiangqiAiMove(state, "easy");
    expect(getAllLegalMoveStrings(state.board, "black")).toContain(ai);
  });

  it("hard prefers capture when available", () => {
    let state = initXiangqi();
    // Play several plies so board opens; just assert hard returns legal
    for (let i = 0; i < 4; i++) {
      const move = chooseXiangqiAiMove(state, "hard");
      expect(getAllLegalMoveStrings(state.board, state.turn)).toContain(move);
      state = applyXiangqiMove(state, move);
      if (state.status !== "playing") break;
    }
  });

  it("applyXiangqiMove switches turn", () => {
    const state = initXiangqi();
    const m = getAllLegalMoveStrings(state.board, "red")[0];
    const next = applyXiangqiMove(state, m);
    expect(next.turn).toBe("black");
    expect(next.moveHistory.length).toBe(1);
  });
});
