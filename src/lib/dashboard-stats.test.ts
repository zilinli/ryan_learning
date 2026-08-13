import { describe, expect, it } from "vitest";
import {
  buildDashboardExtras,
  buildDashboardModel,
  buildSubjectRadar,
  radarPolygonPoints,
} from "./dashboard-stats";
import { normalizeMemory, weekKeyOf, type LearningMemory } from "./learning-memory";

function mem(): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.4,
        mastery: 40,
        attempts: 4,
        correct: 1,
        incorrect: 3,
        lastSeen: now,
        sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: now - 3 * 86400000 },
        eloState: { rating: 1200, n: 4, lastUpdate: now },
        misconceptionHits: [{ id: "frac-add-denom", count: 2, lastSeen: now }],
      },
      {
        id: "reading-evidence",
        label: "Reading evidence",
        topicId: "ela",
        pKnown: 0.7,
        mastery: 70,
        attempts: 3,
        correct: 2,
        incorrect: 1,
        lastSeen: now - 86400000,
        sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now },
        eloState: { rating: 1400, n: 3, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

describe("dashboard-stats (Report-v3 R1)", () => {
  it("builds subject radar with math and ela", () => {
    const radar = buildSubjectRadar(mem());
    expect(radar.some((r) => r.subject === "math" && r.value === 40)).toBe(true);
    expect(radar.some((r) => r.subject === "ela" && r.value === 70)).toBe(true);
  });

  it("builds full dashboard model with heat and trend", () => {
    const m = buildDashboardModel(mem());
    expect(m.skillCount).toBe(2);
    expect(m.misconceptionHeat[0]?.id).toBe("frac-add-denom");
    expect(m.trend30).toHaveLength(30);
    expect(radarPolygonPoints([40, 70], 100, 100, 80)).toMatch(/,/);
  });
});

describe("buildDashboardExtras (P1-5 knowledge map)", () => {
  it("surfaces this week's source attribution and sorts by count", () => {
    const now = Date.now();
    const wk = weekKeyOf(now);
    const m = normalizeMemory({
      skills: [
        {
          id: "fractions-concepts",
          label: "Fraction concepts",
          topicId: "fractions",
          pKnown: 0.4,
          mastery: 40,
          attempts: 4,
          correct: 1,
          incorrect: 3,
          lastSeen: now,
          sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: now },
          eloState: { rating: 1200, n: 4, lastUpdate: now },
          sourceCountsWeek: { homework: 5, explore: 2 },
          sourceWeekKey: wk,
        },
        {
          id: "reading-evidence",
          label: "Reading evidence",
          topicId: "ela",
          pKnown: 0.7,
          mastery: 70,
          attempts: 3,
          correct: 2,
          incorrect: 1,
          lastSeen: now,
          sm2State: { ef: 2.5, interval: 4, reps: 2, prevReview: now },
          eloState: { rating: 1400, n: 3, lastUpdate: now },
          sourceCountsWeek: { deepDive: 3 },
          sourceWeekKey: wk,
        },
      ],
      updatedAt: now,
    });
    const extras = buildDashboardExtras(m, now);
    expect(extras.sourceAttribution[0]).toMatchObject({
      source: "homework",
      count: 5,
    });
    expect(extras.sourceAttribution.map((a) => a.source)).toEqual([
      "homework",
      "deepDive",
      "explore",
    ]);
    // A skill in a past week is excluded from the source dimension.
    const oldWk = new Date(now - 8 * 86_400_000);
    const stale = normalizeMemory({
      skills: [
        {
          id: "stale-skill",
          label: "Stale",
          topicId: "fractions",
          pKnown: 0.9,
          mastery: 90,
          attempts: 9,
          correct: 9,
          incorrect: 0,
          lastSeen: now - 8 * 86_400_000,
          sm2State: { ef: 2.5, interval: 10, reps: 3, prevReview: oldWk.getTime() },
          eloState: { rating: 1500, n: 9, lastUpdate: oldWk.getTime() },
          sourceCountsWeek: { homework: 99 },
          sourceWeekKey: weekKeyOf(oldWk.getTime()),
        },
      ],
      updatedAt: now,
    });
    expect(buildDashboardExtras(stale, now).sourceAttribution).toEqual([]);
  });

  it("recommends the adjacent skill of a mastered one (next-door)", () => {
    const now = Date.now();
    const m = normalizeMemory({
      skills: [
        {
          id: "division-basics",
          label: "Division",
          topicId: "division",
          pKnown: 0.92,
          mastery: 92,
          attempts: 9,
          correct: 9,
          incorrect: 0,
          lastSeen: now,
          sm2State: { ef: 2.6, interval: 8, reps: 5, prevReview: now },
          eloState: { rating: 1650, n: 9, lastUpdate: now },
        },
      ],
      updatedAt: now,
    });
    const extras = buildDashboardExtras(m, now);
    expect(extras.adjacent).not.toBeNull();
    expect(extras.adjacent?.fromSkillId).toBe("division-basics");
    expect(extras.adjacent?.label).toBe("ratios & proportions");
  });

  it("returns empty source + null adjacent when there are no skills", () => {
    const extras = buildDashboardExtras(null, Date.now());
    expect(extras.sourceAttribution).toEqual([]);
    expect(extras.adjacent).toBeNull();
  });
});
