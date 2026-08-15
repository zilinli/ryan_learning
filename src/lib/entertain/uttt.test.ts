import { describe, expect, it } from "vitest";
import {
  applyMove,
  getLegalMoves,
  initUttt,
  lineWinner,
  parseMove,
  type UtttState,
} from "./uttt";

describe("Ultimate Tic-Tac-Toe engine", () => {
  it("U1: init empty, free choice, X to move", () => {
    const s = initUttt();
    expect(s.boards).toHaveLength(9);
    expect(s.boards.every((b) => b.every((c) => c === null))).toBe(true);
    expect(s.activeBoard).toBeNull();
    expect(s.turn).toBe("X");
    expect(s.status).toBe("playing");
    expect(getLegalMoves(s)).toHaveLength(81);
  });

  it("U2: first move anywhere; out-of-range rejected", () => {
    const s0 = initUttt();
    const s1 = applyMove(s0, "4,4");
    expect(s1.boards[4][4]).toBe("X");
    expect(s1.moveCount).toBe(1);
    expect(applyMove(s0, "9,0")).toBe(s0);
    expect(applyMove(s0, "-1,0")).toBe(s0);
    expect(parseMove("a,b")).toBeNull();
  });

  it("U3: playing cell c sets next activeBoard=c", () => {
    const s = applyMove(initUttt(), "0,5");
    expect(s.activeBoard).toBe(5);
    expect(s.turn).toBe("O");
  });

  it("U4: sent to finished board → free choice", () => {
    // Construct: board 4 already won by X; O just played sending next to 4
    let s = initUttt();
    s = {
      ...s,
      boards: s.boards.map((b, i) =>
        i === 4 ? (["X", "X", "X", null, null, null, null, null, null] as UtttState["boards"][0]) : [...b],
      ),
      winners: s.winners.map((w, i) => (i === 4 ? "X" : w)),
      activeBoard: 4,
      turn: "O",
      moveCount: 3,
    };
    expect(getLegalMoves(s).every((m) => !m.startsWith("4,"))).toBe(true);
    expect(getLegalMoves(s).length).toBeGreaterThan(0);
    // After O plays elsewhere in cell that points to finished board 4
    const move = getLegalMoves(s).find((m) => m.endsWith(",4"));
    expect(move).toBeTruthy();
    const next = applyMove(s, move!);
    expect(next.activeBoard).toBeNull();
  });

  it("U5: cannot place in occupied or finished board", () => {
    let s = applyMove(initUttt(), "1,1");
    expect(applyMove(s, "1,1")).toBe(s); // wrong board anyway (active=1) / occupied
    s = applyMove(s, "1,0"); // O plays board 1
    // Finish board 0 as fixture
    s = {
      ...s,
      boards: s.boards.map((b, i) =>
        i === 0 ? (["X", "X", "X", "O", "O", null, null, null, null] as UtttState["boards"][0]) : b,
      ),
      winners: s.winners.map((w, i) => (i === 0 ? "X" : w)),
      activeBoard: null,
      turn: "X",
    };
    expect(getLegalMoves(s).some((m) => m.startsWith("0,"))).toBe(false);
    expect(applyMove(s, "0,5")).toBe(s);
  });

  it("U6: small-board three-in-row sets winners[b]", () => {
    // Routing makes natural sequences long; fixture: X needs cell 2 to complete top row
    let s: UtttState = {
      ...initUttt(),
      boards: initUttt().boards.map((b, i) =>
        i === 0 ? (["X", "X", null, "O", "O", null, null, null, null] as UtttState["boards"][0]) : b,
      ),
      activeBoard: 0,
      turn: "X",
      moveCount: 4,
    };
    s = applyMove(s, "0,2");
    expect(s.winners[0]).toBe("X");
    expect(s.activeBoard).toBe(2);
  });

  it("U7: full small board with no winner → draw", () => {
    // Classic draw pattern on board 8 via fixture + one applyMove to trigger detect
    let s = initUttt();
    // X O X / X O O / O X X — draw
    const drawBoard = ["X", "O", "X", "X", "O", "O", "O", "X", null] as UtttState["boards"][0];
    s = {
      ...s,
      boards: s.boards.map((b, i) => (i === 8 ? [...drawBoard] : b)),
      activeBoard: 8,
      turn: "O",
      moveCount: 8,
    };
    s = applyMove(s, "8,8");
    expect(s.winners[8]).toBe("draw");
  });

  it("U8: meta three-in-row → win", () => {
    let s = initUttt();
    s = {
      ...s,
      winners: ["X", "X", null, null, null, null, null, null, null],
      boards: s.boards.map((b, i) => {
        if (i === 2) return Array(9).fill(null);
        if (i === 0 || i === 1) return ["X", "X", "X", null, null, null, null, null, null];
        return b;
      }),
      activeBoard: 2,
      turn: "X",
    };
    // X completes board 2 top row
    s = applyMove(s, "2,0");
    // Need two more — use fixture for board 2 win in one move via almost-done
    s = {
      ...initUttt(),
      winners: ["X", "X", null, null, null, null, null, null, null],
      boards: initUttt().boards.map((b, i) => {
        if (i === 2) return ["X", "X", null, null, null, null, null, null, null];
        if (i === 0 || i === 1) return ["X", "X", "X", null, null, null, null, null, null];
        return b;
      }),
      activeBoard: 2,
      turn: "X",
      moveCount: 10,
    };
    s = applyMove(s, "2,2");
    expect(s.winners[2]).toBe("X");
    expect(s.status).toBe("X_win");
  });

  it("U9: move that leaves no legal replies → draw", () => {
    // Eight boards drawn/full; board 8 has one empty cell; filling it without meta win → draw
    let s = initUttt();
    const fullDraw = ["X", "O", "X", "X", "O", "O", "O", "X", "X"] as UtttState["boards"][0];
    s = {
      ...s,
      boards: Array.from({ length: 9 }, (_, i) =>
        i === 8 ? (["X", "O", "X", "X", "O", "O", "O", "X", null] as UtttState["boards"][0]) : [...fullDraw],
      ),
      winners: [0, 1, 2, 3, 4, 5, 6, 7].reduce(
        (w, i) => {
          w[i] = "draw";
          return w;
        },
        Array(9).fill(null) as UtttState["winners"],
      ),
      activeBoard: 8,
      turn: "O",
      moveCount: 80,
    };
    s = applyMove(s, "8,8");
    expect(s.winners[8]).toBe("draw");
    expect(s.status).toBe("draw");
    expect(getLegalMoves(s)).toHaveLength(0);
  });

  it("U10: legal moves only on allowed boards", () => {
    let s = applyMove(initUttt(), "3,7");
    expect(s.activeBoard).toBe(7);
    const legal = getLegalMoves(s);
    expect(legal.every((m) => m.startsWith("7,"))).toBe(true);
    expect(legal).toHaveLength(9);
  });

  it("U13: applyMove increments moveCount and flips turn", () => {
    const s0 = initUttt();
    const s1 = applyMove(s0, "2,2");
    expect(s1.moveCount).toBe(1);
    expect(s1.turn).toBe("O");
    const s2 = applyMove(s1, "2,0");
    expect(s2.moveCount).toBe(2);
    expect(s2.turn).toBe("X");
  });

  it("lineWinner helper", () => {
    expect(lineWinner(["X", "X", "X", null, null, null, null, null, null])).toBe("X");
    expect(lineWinner(["O", null, null, "O", null, null, "O", null, null])).toBe("O");
    expect(lineWinner(Array(9).fill(null))).toBeNull();
  });
});
