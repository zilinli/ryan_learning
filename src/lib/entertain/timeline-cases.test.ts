import { describe, expect, it } from "vitest";
import { TIMELINE_CASES } from "./timeline-cases";

describe("timeline-cases", () => {
  it("has at least 8 cases", () => {
    expect(TIMELINE_CASES.length).toBeGreaterThanOrEqual(8);
  });

  it("every case has a valid correctOrder", () => {
    for (const c of TIMELINE_CASES) {
      const eventIds = c.events.map((e) => e.id);
      expect(c.correctOrder.length).toBe(eventIds.length);
      for (const id of c.correctOrder) {
        expect(eventIds).toContain(id);
      }
    }
  });

  it("every case has a passage with at least 80 characters", () => {
    for (const c of TIMELINE_CASES) {
      expect(c.passage.length).toBeGreaterThanOrEqual(80);
    }
  });

  it("every case has evidence sentences", () => {
    for (const c of TIMELINE_CASES) {
      expect(c.evidenceSentenceIndices.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate case ids", () => {
    const ids = TIMELINE_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
