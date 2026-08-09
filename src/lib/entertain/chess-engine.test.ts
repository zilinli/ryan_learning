import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

describe("Chess engine (chess.js)", () => {
  it("C1: start position has 20 legal moves", () => {
    const g = new Chess();
    expect(g.moves()).toHaveLength(20);
  });

  it("C2: e4 then e5 updates FEN", () => {
    const g = new Chess();
    g.move("e4");
    g.move("e5");
    expect(g.fen()).toContain("4p3/4P3");
    expect(g.turn()).toBe("w");
  });

  it("C3: scholar mate is checkmate", () => {
    const g = new Chess();
    g.move("e4");
    g.move("e5");
    g.move("Qh5");
    g.move("Nc6");
    g.move("Bc4");
    g.move("Nf6");
    g.move("Qxf7");
    expect(g.isCheckmate()).toBe(true);
  });

  it("C4: illegal move throws", () => {
    const g = new Chess();
    expect(() => g.move("e5")).toThrow();
  });
});
