import { describe, expect, it } from "vitest";
import { extractMove, pickHeuristicMove } from "./game-ai";

describe("Game AI helpers", () => {
  it("A1: extractMove chess SAN", () => {
    expect(extractMove("I play Nf3", "chess")).toBe("Nf3");
    expect(extractMove("e4!", "chess")).toBe("e4");
    expect(extractMove("O-O", "chess")).toBe("O-O");
  });

  it("A2: extractMove xiangqi coords", () => {
    expect(extractMove("6,4-5,4", "xiangqi")).toBe("6,4-5,4");
    expect(extractMove("Best: 0,0-1,0 thanks", "xiangqi")).toBe("0,0-1,0");
  });

  it("A3: extractMove go coords / pass", () => {
    expect(extractMove("4,4", "go")).toBe("4,4");
    expect(extractMove("I pass", "go")).toBe("pass");
  });

  it("A4: heuristic always returns member of legalMoves", () => {
    const legal = ["e4", "d4", "Nf3", "Nc3"];
    for (let i = 0; i < 20; i++) {
      const m = pickHeuristicMove("chess", legal);
      expect(legal).toContain(m);
    }
  });

  it("A5: chess heuristic prefers captures when present", () => {
    const legal = ["e4", "Nxe5", "d3"];
    // Run many times — should pick capture most of the time
    let captures = 0;
    for (let i = 0; i < 30; i++) {
      if (pickHeuristicMove("chess", legal) === "Nxe5") captures++;
    }
    expect(captures).toBeGreaterThan(20);
  });
});
