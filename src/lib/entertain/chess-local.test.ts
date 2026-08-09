import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  assertBoardMapping,
  chooseChessAiMove,
  isLightSquare,
  legalTargets,
  pieceAtVisual,
  squareFromVisual,
  statusText,
  tryPlayerMove,
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

describe("Chess local AI", () => {
  it("replies with legal SAN after e4 under 300ms", () => {
    const g = new Chess();
    g.move("e4");
    const t0 = Date.now();
    const san = chooseChessAiMove(g.fen(), "medium");
    expect(Date.now() - t0).toBeLessThan(300);
    expect(() => new Chess(g.fen()).move(san)).not.toThrow();
  });

  it("easy/medium/hard all legal from start as black", () => {
    const g = new Chess();
    g.move("d4");
    for (const d of ["easy", "medium", "hard"] as const) {
      const san = chooseChessAiMove(g.fen(), d);
      expect(() => new Chess(g.fen()).move(san)).not.toThrow();
    }
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
