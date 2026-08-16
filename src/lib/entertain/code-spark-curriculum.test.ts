import { describe, expect, it } from "vitest";
import {
  availableOps,
  runProgram,
  type CodeSnapshot,
} from "./code-spark";
import {
  conceptSkillSeed,
  generateMicroLevel,
  getCurriculum,
  hintLadder,
  narrateStep,
  nodeForConcept,
} from "./code-spark-curriculum";
import { inferSkillsFromText } from "../skill-catalog";
import { emptyLearningMemory, prerequisitesSatisfied } from "../learning-memory";

describe("code-spark-curriculum graph", () => {
  it("has exactly 5 ordered concept nodes", () => {
    const nodes = getCurriculum();
    expect(nodes.map((n) => n.id)).toEqual([
      "cs-sequence",
      "cs-loop",
      "cs-conditional",
      "cs-compose",
      "cs-python",
    ]);
  });

  it("every prerequisite resolves to a real node", () => {
    const ids = new Set(getCurriculum().map((n) => n.id));
    for (const n of getCurriculum()) {
      for (const req of n.prereqs) {
        expect(ids.has(req), `${n.id} → ${req}`).toBe(true);
      }
    }
  });

  it("prerequisite graph is acyclic", () => {
    const nodes = getCurriculum();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const seen = new Set<string>();
    const visit = (id: string, path: Set<string>): void => {
      if (path.has(id)) throw new Error(`cycle at ${id}`);
      if (seen.has(id)) return;
      seen.add(id);
      const node = byId.get(id);
      for (const req of node?.prereqs ?? []) visit(req, new Set([...path, id]));
    };
    for (const n of nodes) expect(() => visit(n.id, new Set())).not.toThrow();
  });

  it("each node has a non-empty Learn narration and worked example", () => {
    for (const n of getCurriculum()) {
      expect(n.learn.narration.length).toBeGreaterThan(0);
      expect(n.learn.worked.length).toBeGreaterThan(0);
      expect(n.learn.explanation.length).toBeGreaterThan(10);
    }
  });

  it("prereqs mirror the skill-catalog requires", () => {
    // cs-compose and cs-python both require loop + conditional
    const compose = getCurriculum().find((n) => n.id === "cs-compose")!;
    expect(compose.prereqs).toEqual(["cs-loop", "cs-conditional"]);
  });
});

describe("code-spark-curriculum lesson solvability", () => {
  it("every Learn worked example reaches the goal", () => {
    for (const n of getCurriculum()) {
      const run = runProgram(n.learn.level, n.learn.worked);
      expect(run.success, `${n.id} learn`).toBe(true);
      expect(run.reason).toBe("goal");
    }
  });

  it("every Parsons solution reaches the goal", () => {
    for (const n of getCurriculum()) {
      const run = runProgram(n.parsons.level, n.parsons.solution);
      expect(run.success, `${n.id} parsons`).toBe(true);
    }
  });

  it("a wrong Parsons order for sequence does not reach the goal", () => {
    const n = nodeForConcept("sequence");
    const wrong = [n.parsons.solution[0]!, n.parsons.solution[1]!, n.parsons.solution[3]!, n.parsons.solution[2]!];
    const run = runProgram(n.parsons.level, wrong);
    expect(run.success).toBe(false);
  });

  it("every Apply level is a valid CodeLevel with solvable ops available", () => {
    for (const n of getCurriculum()) {
      for (const lvl of n.apply) {
        expect(lvl.grid.length).toBeGreaterThan(0);
        expect(lvl.start.r).toBeGreaterThanOrEqual(0);
        expect(lvl.goal.r).toBeGreaterThanOrEqual(0);
        expect(availableOps(lvl.band).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("hintLadder", () => {
  it("walks L1 concept → L2 structure → L3 Parsons fallback", () => {
    const node = nodeForConcept("loop");
    const l1 = hintLadder(node, "apply", 1);
    const l2 = hintLadder(node, "apply", 2);
    const l3 = hintLadder(node, "apply", 3);
    expect(l1).not.toBe(l2);
    expect(l2).not.toBe(l3);
    expect(l1).toMatch(/Repeat|loop/i);
    expect(l3).toMatch(/reorder/i);
  });

  it("stays on the Parsons fallback for repeated attempts", () => {
    const node = nodeForConcept("conditional");
    const l4 = hintLadder(node, "apply", 5);
    expect(l4).toMatch(/reorder/i);
  });
});

describe("narrateStep", () => {
  it("narrates a forward bump", () => {
    const snap: CodeSnapshot = { r: 2, c: 0, facing: 0, status: "bump" };
    expect(narrateStep({ type: "forward" }, snap)).toMatch(/Bump|wall/i);
  });

  it("narrates a turn", () => {
    const snap: CodeSnapshot = { r: 0, c: 0, facing: 1, status: "ok" };
    expect(narrateStep({ type: "right" }, snap)).toMatch(/right/i);
    expect(narrateStep({ type: "left" }, snap)).toMatch(/left/i);
  });

  it("narrates a goal step", () => {
    const snap: CodeSnapshot = { r: 0, c: 1, facing: 0, status: "goal" };
    expect(narrateStep({ type: "forward" }, snap)).toMatch(/star|reaches/i);
  });
});

describe("conceptSkillSeed", () => {
  it("latches the right cs-* skill for each concept", () => {
    expect(inferSkillsFromText(conceptSkillSeed("sequence")).map((s) => s.id)).toContain("cs-sequence");
    expect(inferSkillsFromText(conceptSkillSeed("loop")).map((s) => s.id)).toContain("cs-loop");
    expect(inferSkillsFromText(conceptSkillSeed("conditional")).map((s) => s.id)).toContain("cs-conditional");
    expect(inferSkillsFromText(conceptSkillSeed("compose")).map((s) => s.id)).toContain("cs-compose");
    expect(inferSkillsFromText(conceptSkillSeed("python")).map((s) => s.id)).toContain("cs-python");
  });
});

describe("generateMicroLevel (curriculum-backed)", () => {
  it("pulls the Nth Apply level from the node", () => {
    const node = nodeForConcept("loop");
    expect(generateMicroLevel("loop", 2)).toBe(node.apply[1]);
  });

  it("clamps difficulty to the available Apply levels", () => {
    const node = nodeForConcept("sequence");
    expect(generateMicroLevel("sequence", 99)).toBe(node.apply[node.apply.length - 1]);
    expect(generateMicroLevel("sequence", -5)).toBe(node.apply[0]);
  });

  it("keeps the on-topic titles from the old micro levels", () => {
    expect(generateMicroLevel("loop", 2).title).toBe("Repeat It");
    expect(generateMicroLevel("conditional", 2).title).toBe("Decide It");
    expect(generateMicroLevel("sequence", 2).title).toBe("Order It");
  });
});

describe("cs-* mastery gating", () => {
  it("unlocks cs-sequence (no prereqs) but gates cs-loop", () => {
    const mem = emptyLearningMemory();
    expect(prerequisitesSatisfied(mem, "cs-sequence")).toBe(true);
    expect(prerequisitesSatisfied(mem, "cs-loop")).toBe(false);
    expect(prerequisitesSatisfied(mem, "cs-compose")).toBe(false);
  });
});
