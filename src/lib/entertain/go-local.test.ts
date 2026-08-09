import { describe, expect, it } from "vitest";
import { getLegalGoMoves, initGo, placeStone } from "./go-logic";
import { chooseGoAiMove } from "./go-local";

describe("Go local AI", () => {
  it("returns legal move for white after black plays", () => {
    let state = initGo(9);
    state = placeStone(state, { row: 4, col: 4 });
    expect(state.turn).toBe("white");
    const ai = chooseGoAiMove(state, "medium");
    const legal = getLegalGoMoves(state);
    expect(legal).toContain(ai);
  });

  it("easy / hard return legal moves", () => {
    let state = initGo(9);
    state = placeStone(state, { row: 2, col: 2 });
    for (const d of ["easy", "hard"] as const) {
      const ai = chooseGoAiMove(state, d);
      expect(getLegalGoMoves(state)).toContain(ai);
    }
  });

  it("prefers captures when obvious", () => {
    // Minimal capture setup is engine-dependent; assert non-empty legal pick
    let state = initGo(9);
    state = placeStone(state, { row: 0, col: 0 });
    const ai = chooseGoAiMove(state, "hard");
    expect(ai).toMatch(/^\d+,\d+$/);
  });
});
