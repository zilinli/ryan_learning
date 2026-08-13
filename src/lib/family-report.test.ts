import { describe, expect, it } from "vitest";
import {
  buildFamilyReport,
  buildMistakePatterns,
  parentTipForMisconception,
} from "./family-report";
import {
  normalizeMemory,
  weekKeyOf,
  type LearningMemory,
} from "./learning-memory";

function mem(): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.32,
        mastery: 32,
        attempts: 8,
        correct: 2,
        incorrect: 6,
        lastSeen: now,
        sm2State: {
          ef: 2.2,
          interval: 2,
          reps: 1,
          prevReview: now - 3 * 86400000,
        },
        eloState: { rating: 1200, n: 8, lastUpdate: now },
        misconceptionHits: [
          { id: "frac-add-denom", count: 4, lastSeen: now },
        ],
        sourceCounts: { deepDive: 3, wrongbook: 2 },
        sourceCountsWeek: { deepDive: 3, wrongbook: 2 },
        sourceWeekKey: weekKeyOf(now),
        lastSource: "deepDive",
      },
      {
        id: "reading-evidence",
        label: "Reading evidence",
        topicId: "ela",
        pKnown: 0.7,
        mastery: 70,
        attempts: 4,
        correct: 3,
        incorrect: 1,
        lastSeen: now - 86400000,
        sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now },
        eloState: { rating: 1400, n: 4, lastUpdate: now },
        sourceCounts: { explore: 1 },
        sourceCountsWeek: { explore: 1 },
        sourceWeekKey: weekKeyOf(now),
      },
    ],
    updatedAt: now,
  });
}

describe("family-report", () => {
  it("builds narrative KPIs radar and persistent mistake pattern", () => {
    const r = buildFamilyReport(mem(), { accountLabel: "Ryan" });
    expect(r.accountLabel).toBe("Ryan");
    expect(r.kpis.skillsTracked).toBe(2);
    expect(r.kpis.effortAttempts).toBe(12);
    expect(r.narrative).toMatch(/Fraction|sticky|pizza|week/i);
    expect(r.radar.some((x) => x.subject === "math")).toBe(true);
    expect(r.patterns[0]?.id).toBe("frac-add-denom");
    expect(r.patterns[0]?.severity).toBe("persistent");
    expect(r.patterns[0]?.parentTip).toMatch(/pizza|same-size/i);
  });

  it("parent tips cover known ids", () => {
    expect(parentTipForMisconception("frac-bigger-denom")).toMatch(/1\/4|1\/8/);
  });

  it("V3 — weekly sourceAttribution is a top-3 label+count list", () => {
    const r = buildFamilyReport(mem(), { accountLabel: "Ryan" });
    const attr = r.weekly.sourceAttribution;
    expect(attr.length).toBeGreaterThan(0);
    expect(attr.length).toBeLessThanOrEqual(3);
    // sorted desc by count; top source is deepDive (3)
    expect(attr[0]?.source).toBe("deepDive");
    expect(attr[0]?.count).toBeGreaterThanOrEqual(attr[1]?.count ?? 0);
    for (const row of attr) {
      expect(typeof row.label).toBe("string");
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.count).toBeGreaterThan(0);
    }
    // the weekly text mentions the top driver
    expect(r.weekly.text).toContain("deep dives");
  });

  it("buildMistakePatterns sorts by count", () => {
    const p = buildMistakePatterns(mem());
    expect(p[0]?.count).toBeGreaterThanOrEqual(p[1]?.count ?? 0);
  });
});
