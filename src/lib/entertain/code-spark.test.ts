import { describe, expect, it } from "vitest";
import {
  availableOps,
  bandForConcept,
  bandFromProfile,
  coachFeedback,
  codingResultPromptNote,
  conceptFocusForBand,
  conceptFromText,
  defaultEditorMode,
  generateLevel,
  opsToPython,
  parsePythonProgram,
  rateStars,
  runProgram,
  trackFromBand,
  trackLabel,
  validateProgram,
  type CodeOp,
  type CodingResultNote,
} from "./code-spark";
import { generateMicroLevel } from "./code-spark-curriculum";

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

  it("maps advanced for high school / teens", () => {
    expect(bandFromProfile({ grade: 9, age: 12 })).toBe("advanced");
    expect(bandFromProfile({ grade: 7, age: 15 })).toBe("advanced");
  });
});

describe("tracks and editor default", () => {
  it("maps bands to Brilliant-style tracks", () => {
    expect(trackFromBand("early")).toBe("foundations");
    expect(trackFromBand("elementary")).toBe("loops");
    expect(trackFromBand("middle")).toBe("branching");
    expect(trackFromBand("advanced")).toBe("text-bridge");
  });

  it("labels tracks with Brilliant path names", () => {
    expect(trackLabel("foundations")).toBe("Thinking in Code");
    expect(trackLabel("loops")).toBe("Loops & Patterns");
    expect(trackLabel("branching")).toBe("Algorithmic Thinking");
    expect(trackLabel("text-bridge")).toBe("Python Bridge");
  });

  it("always defaults to Blocks (blocks-first)", () => {
    expect(defaultEditorMode("early")).toBe("blocks");
    expect(defaultEditorMode("elementary")).toBe("blocks");
    expect(defaultEditorMode("middle")).toBe("blocks");
    expect(defaultEditorMode("advanced")).toBe("blocks");
  });
});

describe("availableOps", () => {
  it("unlocks blocks by band", () => {
    expect(availableOps("early")).toEqual(["forward", "left", "right"]);
    expect(availableOps("elementary")).toContain("repeat");
    expect(availableOps("middle")).toContain("ifClear");
    expect(availableOps("advanced")).toContain("ifClear");
  });
});

describe("runProgram", () => {
  it("reaches the goal on a straight early path", () => {
    const level = generateLevel("early", 1);
    const n = level.start.r - level.goal.r;
    const program: CodeOp[] = Array.from({ length: n }, () => ({ type: "forward" }));
    const run = runProgram(level, program);
    expect(run.success).toBe(true);
    expect(run.reason).toBe("goal");
  });

  it("bumps into a wall", () => {
    const level = generateLevel("early", 1);
    const west: CodeOp[] = [
      { type: "left" },
      { type: "forward" },
      { type: "forward" },
      { type: "forward" },
    ];
    const run = runProgram(level, west);
    expect(run.success).toBe(false);
    expect(run.reason).toBe("bump");
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
    const program: CodeOp[] = [
      { type: "forward" },
      { type: "forward" },
      { type: "ifClear", body: [{ type: "forward" }] },
      { type: "left" },
    ];
    const run = runProgram(level, program);
    expect(run.snapshots.length).toBeGreaterThan(1);
    expect(run.reason).not.toBe("fuel");
  });

  it("advanced levels include RPG title", () => {
    const level = generateLevel("advanced", 2);
    expect(level.title.length).toBeGreaterThan(3);
    expect(level.parSteps).toBeGreaterThan(0);
  });
});

describe("validateProgram + stars", () => {
  it("marks correct when goal reached with stars", () => {
    const level = generateLevel("early", 1);
    const n = level.start.r - level.goal.r;
    const program: CodeOp[] = Array.from({ length: n }, () => ({ type: "forward" }));
    const res = validateProgram(level, program);
    expect(res.correct).toBe(true);
    expect(res.outcome).toBe("correct");
    expect(res.stars).toBe(3);
  });

  it("marks incorrect when stuck", () => {
    const level = generateLevel("early", 1);
    const res = validateProgram(level, []);
    expect(res.correct).toBe(false);
    expect(res.stars).toBe(0);
  });

  it("rateStars returns 0 on failure", () => {
    const level = generateLevel("early", 1);
    const run = runProgram(level, []);
    expect(rateStars(level, run)).toBe(0);
  });

  it("levels carry Brilliant conceptFocus", () => {
    for (const band of ["early", "elementary", "middle", "advanced"] as const) {
      const level = generateLevel(band, 2);
      expect(level.conceptFocus).toBe(conceptFocusForBand(band));
      expect(level.conceptFocus.length).toBeGreaterThan(8);
    }
  });

  it("coachFeedback coaches in plain English", () => {
    const level = generateLevel("early", 1);
    const n = level.start.r - level.goal.r;
    const win = runProgram(
      level,
      Array.from({ length: n }, () => ({ type: "forward" as const })),
    );
    expect(coachFeedback(level, win)).toMatch(/Goal!/);
    expect(coachFeedback(level, win)).toMatch(/Sequence/);

    const bump = runProgram(level, [
      { type: "left" },
      { type: "forward" },
      { type: "forward" },
      { type: "forward" },
    ]);
    expect(coachFeedback(level, bump)).toMatch(/Bump|Wall/);

    const stuck = runProgram(level, []);
    expect(coachFeedback(level, stuck)).toMatch(/Stopped short|plain words/);
  });
});

describe("parsePythonProgram", () => {
  it("parses simple calls", () => {
    const r = parsePythonProgram("move_forward()\nturn_left()\nforward()\n");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program).toEqual([
        { type: "forward" },
        { type: "left" },
        { type: "forward" },
      ]);
    }
  });

  it("parses for-range and if clear", () => {
    const src = [
      "for i in range(3):",
      "    move_forward()",
      "if clear():",
      "    turn_right()",
      "",
    ].join("\n");
    const r = parsePythonProgram(src);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program).toEqual([
        {
          type: "repeat",
          times: 3,
          body: [{ type: "forward" }],
        },
        { type: "ifClear", body: [{ type: "right" }] },
      ]);
    }
  });

  it("ignores else body", () => {
    const src = [
      "if clear():",
      "    move_forward()",
      "else:",
      "    turn_left()",
      "move_forward()",
    ].join("\n");
    const r = parsePythonProgram(src);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program).toEqual([
        { type: "ifClear", body: [{ type: "forward" }] },
        { type: "forward" },
      ]);
    }
  });

  it("rejects unknown statements", () => {
    const r = parsePythonProgram("import os\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(1);
  });

  it("runs early path from Python", () => {
    const level = generateLevel("early", 1);
    const n = level.start.r - level.goal.r;
    const src = Array.from({ length: n }, () => "move_forward()").join("\n");
    const parsed = parsePythonProgram(src);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const run = runProgram(level, parsed.program);
      expect(run.success).toBe(true);
    }
  });
});

describe("opsToPython", () => {
  it("round-trips a nested program", () => {
    const ops: CodeOp[] = [
      {
        type: "repeat",
        times: 2,
        body: [{ type: "forward" }],
      },
      { type: "ifClear", body: [{ type: "left" }] },
    ];
    const py = opsToPython(ops);
    const parsed = parsePythonProgram(py);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.program).toEqual(ops);
  });
});

describe("conversational coding concepts", () => {
  it("conceptFromText maps loop / conditional / sequence", () => {
    expect(conceptFromText("how do for loops work")).toBe("loop");
    expect(conceptFromText("循环怎么用 repeat")).toBe("loop");
    expect(conceptFromText("if 条件判断")).toBe("conditional");
    expect(conceptFromText("what is a variable")).toBe("sequence");
    expect(conceptFromText("")).toBe("sequence");
  });

  it("bandForConcept hosts each concept", () => {
    expect(bandForConcept("sequence")).toBe("early");
    expect(bandForConcept("loop")).toBe("elementary");
    expect(bandForConcept("conditional")).toBe("middle");
  });

  it("generateMicroLevel aligns ops with concept", () => {
    const loop = generateMicroLevel("loop", 2);
    expect(loop.title).toBe("Repeat It");
    expect(availableOps(loop.band)).toContain("repeat");
    expect(loop.conceptFocus).toMatch(/Loop/);

    const cond = generateMicroLevel("conditional", 2);
    expect(cond.title).toBe("Decide It");
    expect(availableOps(cond.band)).toContain("ifClear");
    expect(cond.conceptFocus).toMatch(/Conditional/);

    const seq = generateMicroLevel("sequence", 2);
    expect(seq.title).toBe("Order It");
    expect(availableOps(seq.band)).not.toContain("repeat");
  });

  it("micro levels are small and fast", () => {
    const lvl = generateMicroLevel("loop", 2);
    expect(lvl.grid.length).toBeLessThanOrEqual(5);
    expect(lvl.maxSteps).toBeLessThanOrEqual(26);
  });

  it("codingResultPromptNote mentions the concept", () => {
    const note: CodingResultNote = {
      concept: "loop",
      outcome: "correct",
      stars: 3,
      steps: 4,
      mode: "blocks",
      levelTitle: "Repeat It",
    };
    const line = codingResultPromptNote(note);
    expect(line).toMatch(/loops/);
    expect(line).toMatch(/Repeat It/);
    expect(line).toMatch(/outcome=correct/);
  });
});
