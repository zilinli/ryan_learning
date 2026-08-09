import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  AI_DIFFICULTIES,
  assertBoardMapping,
  chooseChessAiMove,
  isLightSquare,
  legalTargets,
  pieceAtVisual,
  searchDepth,
  squareFromVisual,
  statusText,
  tryPlayerMove,
  usesQuiescence,
} from "./chess-local";

describe("Chess board mapping (must match chess.js)", () => {
  it("squareFromVisual: a8 top-left, a1 bottom-left, e2 above a1-file", () => {
    expect(squareFromVisual(0, 0)).toBe("a8");
    expect(squareFromVisual(7, 0)).toBe("a1");
    expect(squareFromVisual(6, 4)).toBe("e2");
    expect(squareFromVisual(7, 4)).toBe("e1");
  });

  it("assertBoardMapping holds on start and after e4", () => {
    const g = new Chess();
    expect(assertBoardMapping(g)).toBe(true);
    g.move("e4");
    expect(assertBoardMapping(g)).toBe(true);
    expect(pieceAtVisual(g, 6, 4)).toBeNull(); // e2 empty
    expect(pieceAtVisual(g, 4, 4)).toMatchObject({ type: "p", color: "w" }); // e4
  });

  it("visual piece equals game.get(square) for every cell", () => {
    const g = new Chess();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = squareFromVisual(row, col);
        const a = pieceAtVisual(g, row, col);
        const b = g.get(sq);
        expect(a?.type ?? null).toBe(b?.type ?? null);
        expect(a?.color ?? null).toBe(b?.color ?? null);
      }
    }
  });

  it("a1 is dark; white king sits on e1 at visual bottom", () => {
    expect(isLightSquare(7, 0)).toBe(false);
    const g = new Chess();
    expect(pieceAtVisual(g, 7, 4)).toMatchObject({ type: "k", color: "w" });
    expect(pieceAtVisual(g, 0, 4)).toMatchObject({ type: "k", color: "b" });
  });

  it("click path: select e2 → targets include e4 → move", () => {
    let fen = new Chess().fen();
    const from = squareFromVisual(6, 4);
    expect(from).toBe("e2");
    const dests = legalTargets(fen, from);
    expect(dests).toEqual(expect.arrayContaining(["e3", "e4"]));
    const result = tryPlayerMove(fen, from, "e4");
    expect(result?.san).toBe("e4");
    fen = result!.fen;
    expect(new Chess(fen).turn()).toBe("b");
    expect(assertBoardMapping(new Chess(fen))).toBe(true);
  });
});

describe("Chess local AI — difficulty upgrade D1–D6", () => {
  it("D1: all 5 levels return legal SAN after d4", () => {
    const g = new Chess();
    g.move("d4");
    for (const d of AI_DIFFICULTIES) {
      const san = chooseChessAiMove(g.fen(), d);
      expect(() => new Chess(g.fen()).move(san)).not.toThrow();
    }
  }, 15000);

  it("D3: hard/expert/master capture hanging queen", () => {
    // White to move — black queen unprotected on d5, white rook on d1
    const fen = "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1";
    const g = new Chess(fen);
    expect(g.moves()).toContain("Rxd5");
    for (const d of ["hard", "expert", "master"] as const) {
      expect(chooseChessAiMove(fen, d)).toBe("Rxd5");
    }
  }, 10000);

  it("D4: medium move under 400ms after e4", () => {
    const g = new Chess();
    g.move("e4");
    const t0 = Date.now();
    const san = chooseChessAiMove(g.fen(), "medium");
    expect(Date.now() - t0).toBeLessThan(400);
    expect(() => new Chess(g.fen()).move(san)).not.toThrow();
  });

  it("D5: searchDepth monotonicity easy < medium ≤ hard < expert ≤ master", () => {
    expect(searchDepth("easy")).toBeLessThan(searchDepth("medium"));
    expect(searchDepth("medium")).toBeLessThanOrEqual(searchDepth("hard"));
    expect(searchDepth("hard")).toBeLessThan(searchDepth("expert"));
    expect(searchDepth("expert")).toBeLessThanOrEqual(searchDepth("master"));
  });

  it("D6: only master uses quiescence", () => {
    expect(usesQuiescence("master")).toBe(true);
    expect(usesQuiescence("hard")).toBe(false);
    expect(usesQuiescence("expert")).toBe(false);
  });

  it("play 8 plies white first-legal + black AI without throw", () => {
    let fen = new Chess().fen();
    for (let i = 0; i < 8; i++) {
      const g = new Chess(fen);
      if (g.isGameOver()) break;
      if (g.turn() === "w") {
        g.move(g.moves()[0]);
      } else {
        g.move(chooseChessAiMove(fen, "easy"));
      }
      fen = g.fen();
      expect(assertBoardMapping(g)).toBe(true);
    }
  });
});

describe("Chess status helper", () => {
  it("shows your turn for white in AI mode", () => {
    expect(statusText(new Chess().fen(), "ai")).toMatch(/Your turn/);
  });
});
