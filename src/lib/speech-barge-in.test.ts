import { describe, expect, it } from "vitest";
import {
  interruptHint,
  planBargeIn,
  shouldBargeIn,
} from "./speech-barge-in";

describe("speech-barge-in (CA-4)", () => {
  it("BI1: shouldBargeIn(true) → true", () => {
    expect(shouldBargeIn(true)).toBe(true);
  });

  it("BI2: interruptHint when speaking is non-empty", () => {
    expect(interruptHint(true).length).toBeGreaterThan(0);
    expect(interruptHint(true).toLowerCase()).toMatch(/interrupt/);
  });

  it("BI3: planBargeIn order stop then listen", () => {
    const plan = planBargeIn();
    expect(plan.stopSpeech).toBe(true);
    expect(plan.thenListen).toBe(true);
  });

  it("BI4: not speaking → no interrupt hint", () => {
    expect(shouldBargeIn(false)).toBe(false);
    expect(interruptHint(false)).toBe("");
  });
});
