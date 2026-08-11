import { describe, expect, it } from "vitest";
import {
  WAIT_PHASE_AT_MS,
  initialWaitStatus,
  isGenericWaitStatus,
  waitPhaseIndex,
  waitPhases,
  waitStatusAt,
} from "./tutor-wait-status";

describe("tutor-wait-status", () => {
  it("uses photo-aware first label", () => {
    expect(initialWaitStatus({ hasMedia: true })).toMatch(/photo/i);
    expect(initialWaitStatus({ hasMedia: false })).toMatch(/Thinking/i);
  });

  it("advances phases by wall clock", () => {
    expect(waitPhaseIndex(0)).toBe(0);
    expect(waitPhaseIndex(WAIT_PHASE_AT_MS[1]!)).toBe(1);
    expect(waitPhaseIndex(WAIT_PHASE_AT_MS[2]!)).toBe(2);
    expect(waitPhaseIndex(WAIT_PHASE_AT_MS[3]!)).toBe(3);
    expect(waitPhaseIndex(60_000)).toBe(3);
  });

  it("returns taking-longer copy after 12s", () => {
    expect(waitStatusAt({ hasMedia: false }, 12_000)).toMatch(/bit longer/i);
    expect(waitStatusAt({ hasMedia: true }, 25_000)).toMatch(/hang tight/i);
  });

  it("exposes four phases for both contexts", () => {
    expect(waitPhases({ hasMedia: true })).toHaveLength(4);
    expect(waitPhases({ hasMedia: false })).toHaveLength(4);
  });

  it("treats tool labels as non-generic", () => {
    expect(isGenericWaitStatus("Thinking…")).toBe(true);
    expect(isGenericWaitStatus("Looking at your photo…")).toBe(true);
    expect(isGenericWaitStatus("Drawing a diagram…")).toBe(false);
    expect(isGenericWaitStatus("Searching the web…")).toBe(false);
  });
});
