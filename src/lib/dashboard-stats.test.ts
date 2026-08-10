import { describe, expect, it } from "vitest";
import {
  buildDashboardModel,
  buildSubjectRadar,
  radarPolygonPoints,
} from "./dashboard-stats";
import { normalizeMemory, type LearningMemory } from "./learning-memory";

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
