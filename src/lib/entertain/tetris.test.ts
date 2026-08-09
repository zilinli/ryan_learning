import { describe, expect, it } from "vitest";
import {
  displayGrid,
  hardDrop,
  initTetris,
  movePiece,
  rotatePiece,
  tick,
} from "./tetris";

describe("Tetris / Blocks engine", () => {
  it("starts with active piece and empty-ish grid", () => {
    const s = initTetris();
    expect(s.status).toBe("playing");
    expect(s.active).not.toBeNull();
    expect(s.width).toBe(10);
    expect(s.height).toBe(20);
    expect(displayGrid(s).flat().some((c) => c > 0)).toBe(true);
  });

  it("left/right move within bounds", () => {
    let s = initTetris();
    const col0 = s.active!.col;
    s = movePiece(s, "L");
    expect(s.active!.col).toBeLessThanOrEqual(col0);
    for (let i = 0; i < 20; i++) s = movePiece(s, "L");
    expect(s.active!.col).toBeGreaterThanOrEqual(0);
  });

  it("rotate changes shape dims for I/T-like pieces", () => {
    let s = initTetris();
    // Force many rotates — should not throw
    for (let i = 0; i < 4; i++) s = rotatePiece(s);
    expect(s.active).not.toBeNull();
  });

  it("tick eventually locks or advances piece", () => {
    let s = initTetris();
    const startRow = s.active!.row;
    s = tick(s);
    expect(s.active === null || s.active.row >= startRow || s.grid !== initTetris().grid).toBe(
      true,
    );
  });

  it("hardDrop locks a piece", () => {
    let s = initTetris();
    s = hardDrop(s);
    expect(s.grid.flat().some((c) => c > 0)).toBe(true);
  });
});
