import { describe, expect, it } from "vitest";
import { applyMove, getLegalMoves, initUttt, type UtttState } from "./uttt";
import { chooseUtttAiMove, evaluate } from "./uttt-local";

describe("Ultimate TTT local AI", () => {
  it("U11: easy/medium/hard return legal moves", () => {
    let s = applyMove(initUttt(), "4,4");
    expect(s.turn).toBe("O");
    for (const d of ["easy", "medium", "hard"] as const) {
      const m = chooseUtttAiMove(s, d);
      expect(getLegalMoves(s)).toContain(m);
    }
  });

  it("U12: hard AI takes immediate meta-winning move", () => {
    // O to move; completing board 2 wins meta (boards 0,1 already O)
    let s: UtttState = {
      ...initUttt(),
      winners: ["O", "O", null, null, null, null, null, null, null],
      boards: initUttt().boards.map((b, i) => {
        if (i === 0 || i === 1) return ["O", "O", "O", null, null, null, null, null, null];
        if (i === 2) return ["O", "O", null, null, null, null, null, null, null];
        return b;
      }),
      activeBoard: 2,
      turn: "O",
      moveCount: 20,
    };
    const m = chooseUtttAiMove(s, "hard");
    expect(m).toBe("2,2");
    const next = applyMove(s, m);
    expect(next.status).toBe("O_win");
  });

  it("evaluate prefers own meta threats", () => {
    const empty = initUttt();
    const better: UtttState = {
      ...empty,
      winners: ["X", null, null, null, null, null, null, null, null],
    };
    expect(evaluate(better, "X")).toBeGreaterThan(evaluate(empty, "X"));
  });
});
