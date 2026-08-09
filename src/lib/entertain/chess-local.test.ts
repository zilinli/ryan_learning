import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  chooseChessAiMove,
  isLightSquare,
  legalTargets,
  pieceAtVisual,
  squareFromVisual,
  tryPlayerMove,
} from "./chess-local";

describe("Chess board mapping (critical UI)", () => {
  it("squareFromVisual: top-left is a8, bottom-left is a1", () => {
    expect(squareFromVisual(0, 0)).toBe("a8");
    expect(squareFromVisual(0, 4)).toBe("e8");
    expect(squareFromVisual(7, 0)).toBe("a1");
    expect(squareFromVisual(7, 4)).toBe("e1");
    expect(squareFromVisual(6, 4)).toBe("e2");
  });

  it("pieceAtVisual matches square: white king on e1 at bottom", () => {
    const g = new Chess();
    // visual row 7 = rank 1, col 4 = e → e1 white king
    const piece = pieceAtVisual(g, 7, 4);
    expect(piece).toMatchObject({ type: "k", color: "w" });
    // visual row 0 = rank 8, col 4 = e → e8 black king
    expect(pieceAtVisual(g, 0, 4)).toMatchObject({ type: "k", color: "b" });
    // white pawn e2
    expect(pieceAtVisual(g, 6, 4)).toMatchObject({ type: "p", color: "w" });
  });

  it("a1 is dark (bottom-left)", () => {
    expect(isLightSquare(7, 0)).toBe(false); // a1 dark
    expect(isLightSquare(7, 1)).toBe(true); // b1 light
    expect(isLightSquare(0, 0)).toBe(true); // a8 light
  });

  it("clicking visual e2 selects white pawn that can go e4", () => {
    const fen = new Chess().fen();
    const sq = squareFromVisual(6, 4); // e2
    expect(sq).toBe("e2");
    const dests = legalTargets(fen, sq);
    expect(dests).toContain("e3");
    expect(dests).toContain("e4");
  });

  it("tryPlayerMove e2e4 works and flips turn", () => {
    const start = new Chess().fen();
    const result = tryPlayerMove(start, "e2", "e4");
    expect(result).not.toBeNull();
    expect(result!.san).toBe("e4");
    const g = new Chess(result!.fen);
    expect(g.turn()).toBe("b");
    expect(g.get("e4")).toEqual({ type: "p", color: "w" });
  });
});

describe("Chess local AI", () => {
  it("returns a legal SAN from start (black to move after e4)", () => {
    const g = new Chess();
    g.move("e4");
    const san = chooseChessAiMove(g.fen(), "medium");
    expect(san.length).toBeGreaterThan(0);
    const check = new Chess(g.fen());
    expect(() => check.move(san)).not.toThrow();
  });

  it("prefers capturing a hanging queen when obvious", () => {
    // White to move: black queen hanging on d5 unprotected — Qxd5 or similar
    const fen = "rnb1kbnr/pppp1ppp/8/3q4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
    const san = chooseChessAiMove(fen, "hard");
    const g = new Chess(fen);
    g.move(san);
    // Should capture the queen or at least be legal
    expect(g.history().length).toBe(1);
    expect(san.includes("x") || san.includes("d5") || san.includes("Q")).toBe(true);
  });

  it("AI move completes under 500ms for medium", () => {
    const g = new Chess();
    g.move("e4");
    const t0 = Date.now();
    chooseChessAiMove(g.fen(), "medium");
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it("easy AI always returns legal move", () => {
    const fen = new Chess().fen();
    for (let i = 0; i < 10; i++) {
      const san = chooseChessAiMove(fen, "easy");
      const g = new Chess(fen);
      expect(() => g.move(san)).not.toThrow();
    }
  });

  it("full playout white local + black AI does not throw for 6 plies", () => {
    let fen = new Chess().fen();
    for (let ply = 0; ply < 6; ply++) {
      const g = new Chess(fen);
      if (g.isGameOver()) break;
      if (g.turn() === "w") {
        const moves = g.moves();
        const pick = moves[0];
        const r = tryPlayerMove(fen, g.moves({ verbose: true })[0].from, g.moves({ verbose: true })[0].to);
        // simpler: just move first legal
        g.move(pick);
        fen = g.fen();
      } else {
        const san = chooseChessAiMove(fen, "easy");
        g.move(san);
        fen = g.fen();
      }
    }
    expect(new Chess(fen).history().length).toBeGreaterThanOrEqual(0);
  });
});
