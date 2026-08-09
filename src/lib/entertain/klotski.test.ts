import { describe, expect, it } from "vitest";
import { initKlotski, movePiece, undoKlotski } from "./klotski";

describe("Klotski engine", () => {
  it("L1: Cao Cao starts at (0,1) size 2×2", () => {
    const s = initKlotski(0);
    const cao = s.pieces.find((p) => p.id === "caocao");
    expect(cao).toBeDefined();
    expect(cao!.w).toBe(2);
    expect(cao!.h).toBe(2);
    expect(cao!.row).toBe(0);
    expect(cao!.col).toBe(1);
  });

  it("L2: illegal overlap rejected", () => {
    const s = initKlotski(0);
    // Try moving Zhang Fei into Cao Cao
    const next = movePiece(s, "zhangfei", 0, 1);
    expect(next).toBe(s);
    expect(next.moveCount).toBe(0);
  });

  it("L3: legal slide increases moveCount", () => {
    const s = initKlotski(0);
    // Soldier s3 at (4,0) can often move right if empty — try several pieces/dirs
    const ids = s.pieces.map((p) => p.id);
    const dirs: [number, number][] = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    let moved = s;
    outer: for (const id of ids) {
      for (const [dr, dc] of dirs) {
        const next = movePiece(s, id, dr, dc);
        if (next !== s) {
          moved = next;
          break outer;
        }
      }
    }
    expect(moved.moveCount).toBe(1);
    expect(moved.history).toHaveLength(1);
  });

  it("L4: undo works", () => {
    const s = initKlotski(0);
    let next = s;
    for (const id of s.pieces.map((p) => p.id)) {
      for (const [dr, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as [number, number][]) {
        const m = movePiece(s, id, dr, dc);
        if (m !== s) {
          next = m;
          break;
        }
      }
      if (next !== s) break;
    }
    const undone = undoKlotski(next);
    expect(undone.pieces).toEqual(s.pieces);
    expect(undone.solved).toBe(false);
  });

  it("L5: win when Cao Cao at exit (3,1)", () => {
    let s = initKlotski(0);
    // Force Cao Cao to exit by clearing path in test state
    s = {
      ...s,
      pieces: s.pieces.map((p) =>
        p.id === "caocao"
          ? { ...p, row: 3, col: 1 }
          : p.id === "s1" || p.id === "s2"
            ? { ...p, row: 0, col: 0 } // may overlap — rebuild carefully
            : p,
      ),
    };
    // Cleaner: empty board with only Cao Cao just above exit, move down
    s = {
      pieces: [
        { id: "caocao", label: "曹操", w: 2, h: 2, row: 2, col: 1 },
        { id: "s1", label: "兵", w: 1, h: 1, row: 0, col: 0 },
        { id: "s2", label: "兵", w: 1, h: 1, row: 0, col: 3 },
        { id: "s3", label: "兵", w: 1, h: 1, row: 4, col: 0 },
        { id: "s4", label: "兵", w: 1, h: 1, row: 4, col: 3 },
      ],
      moveCount: 0,
      history: [],
      solved: false,
    };
    const won = movePiece(s, "caocao", 1, 0);
    expect(won.solved).toBe(true);
    expect(won.pieces.find((p) => p.id === "caocao")!.row).toBe(3);
  });
});
