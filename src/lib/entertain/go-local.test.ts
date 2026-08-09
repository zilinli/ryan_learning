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

  it("easy / hard / master return legal moves", () => {
    let state = initGo(9);
    state = placeStone(state, { row: 2, col: 2 });
    for (const d of ["easy", "hard", "master"] as const) {
      const ai = chooseGoAiMove(state, d);
      expect(getLegalGoMoves(state)).toContain(ai);
    }
  });

  it("D8: expert/master legal; prefer capturing a single liberty stone", () => {
    // Black stone at (0,1) with liberties (0,0)/(0,2)/(1,1). Fill two; AI should take last.
    let state = initGo(9);
    state = {
      ...state,
      board: state.board.map((row, r) =>
        row.map((_, c) => {
          if (r === 0 && c === 1) return "black";
          if (r === 0 && c === 0) return "white";
          if (r === 0 && c === 2) return "white";
          return null;
        }),
      ),
      turn: "white",
      moveHistory: [
        { row: 0, col: 1 },
        { row: 0, col: 0 },
        { row: 0, col: 2 },
      ],
    };
    for (const d of ["expert", "master"] as const) {
      const ai = chooseGoAiMove(state, d);
      expect(getLegalGoMoves(state)).toContain(ai);
      expect(ai).toBe("1,1");
    }
  });
});
