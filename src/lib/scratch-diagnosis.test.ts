import { describe, expect, it } from "vitest";
import {
  parseScratchDiagnosisFence,
  scratchDiagnosisPromptLines,
  stripScratchDiagnosisFence,
} from "./scratch-diagnosis";

describe("scratch-diagnosis (CA-5)", () => {
  it("SD1: parse + strip", () => {
    const text = `Look here.\n~~~scratch-diagnosis\n{"badStep":2,"totalSteps":4,"hint":"Check tenths"}\n~~~\nWhat next?`;
    const d = parseScratchDiagnosisFence(text);
    expect(d).toEqual({
      badStep: 2,
      totalSteps: 4,
      hint: "Check tenths",
    });
    const stripped = stripScratchDiagnosisFence(text);
    expect(stripped).toContain("Look here");
    expect(stripped).not.toContain("scratch-diagnosis");
  });

  it("SD2: prompt includes fence contract when images present", () => {
    const withImg = scratchDiagnosisPromptLines(true).join("\n");
    expect(withImg).toContain("scratch-diagnosis");
    expect(withImg).toContain("badStep");
    const noImg = scratchDiagnosisPromptLines(false).join("\n");
    expect(noImg).toMatch(/scratch|notebook/i);
  });
});
