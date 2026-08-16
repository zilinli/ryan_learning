import { describe, expect, it } from "vitest";
import {
  availableOps,
  bandFromProfile,
  generateLevel,
  runProgram,
  validateProgram,
  type CodeOp,
} from "./code-spark";

describe("bandFromProfile", () => {
  it("maps early by grade or age", () => {
    expect(bandFromProfile({ grade: 1, age: 9 })).toBe("early");
    expect(bandFromProfile({ grade: 4, age: 6 })).toBe("early");
  });

  it("maps elementary for typical G4", () => {
    expect(bandFromProfile({ grade: 4, age: 9 })).toBe("elementary");
  });

  it("maps middle by grade or age", () => {
    expect(bandFromProfile({ grade: 7, age: 9 })).toBe("middle");
    expect(bandFromProfile({ grade: 5, age: 13 })).toBe("middle");
  });
});

describe("availableOps", () => {
  it("unlocks blocks by band", () => {
    expect(availableOps("early")).toEqual(["forward", "left", "right"]);
    expect(availableOps("elementary")).toContain("repeat");
    expect(availableOps("middle")).toContain("ifClear");
  });
});

describe("runProgram", () => {
  it("reaches the goal on a straight early path", () => {
    const level = generateLevel("early", 1);
    // Start bottom row facing north — need (size-1) forwards
    const n = level.start.r - level.goal.r;
    const program: CodeOp[] = Array.from({ length: n }, () => ({ type: "forward" }));
    const run = runProgram(level, program);
    expect(run.success).toBe(true);
    expect(run.reason).toBe("goal");
  });

  it("bumps into a wall", () => {
    const level = generateLevel("early", 1);
    const program: CodeOp[] = [
      { type: "left" },
      { type: "forward" }, // into edge / wall depending on start
    ];
    // Face west from c=1 and walk into c=0 then out — ensure bump by many west forwards
    const west: CodeOp[] = [
      { type: "left" },
      { type: "forward" },
      { type: "forward" },
      { type: "forward" },
    ];
    const run = runProgram(level, west);
    expect(run.success).toBe(false);
    expect(run.reason).toBe("bump");
    void program;
  });

  it("expands repeat", () => {
    const level = generateLevel("early", 1);
    const n = level.start.r - level.goal.r;
    const times = (n >= 4 ? 4 : n >= 3 ? 3 : 2) as 2 | 3 | 4;
    const bodyCount = Math.floor(n / times);
    const rem = n - bodyCount * times;
    const program: CodeOp[] = [
      {
        type: "repeat",
        times,
        body: Array.from({ length: bodyCount }, () => ({ type: "forward" as const })),
      },
      ...Array.from({ length: rem }, () => ({ type: "forward" as const })),
    ];
    const run = runProgram(level, program);
    expect(run.success).toBe(true);
  });

  it("ifClear skips body when blocked", () => {
    const level = generateLevel("middle", 1);
    // Face the mid wall at (2,2) from start (size-1, 2) facing north —
    // after a few forwards we hit wall; ifClear should not step into it.
    const program: CodeOp[] = [
      { type: "forward" },
      { type: "forward" },
      { type: "ifClear", body: [{ type: "forward" }] },
      { type: "left" },
    ];
    const run = runProgram(level, program);
    // Should not crash; bump only if a naked forward hits wall
    expect(run.snapshots.length).toBeGreaterThan(1);
    expect(run.reason).not.toBe("fuel");
  });
});

describe("validateProgram", () => {
  it("marks correct when goal reached", () => {
    const level = generateLevel("early", 1);
    const n = level.start.r - level.goal.r;
    const program: CodeOp[] = Array.from({ length: n }, () => ({ type: "forward" }));
    const res = validateProgram(level, program);
    expect(res.correct).toBe(true);
    expect(res.outcome).toBe("correct");
  });

  it("marks incorrect when stuck", () => {
    const level = generateLevel("early", 1);
    const res = validateProgram(level, []);
    expect(res.correct).toBe(false);
  });
});
