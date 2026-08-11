import { describe, expect, it } from "vitest";
import { buildFamilyReport } from "./family-report";
import {
  buildLearningPortfolioHtml,
  learningPortfolioFilename,
} from "./learning-portfolio";
import { normalizeMemory, type LearningMemory } from "./learning-memory";

function mem(): LearningMemory {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fractions",
        topicId: "fractions",
        pKnown: 0.55,
        mastery: 55,
        attempts: 4,
        correct: 2,
        incorrect: 1,
        lastSeen: now,
        sm2State: {
          ef: 2.5,
          interval: 1,
          reps: 1,
          prevReview: now,
        },
        eloState: { rating: 1000, n: 2, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

describe("learning-portfolio", () => {
  it("builds printable HTML with narrative and no secrets", () => {
    const report = buildFamilyReport(mem(), { accountLabel: "Ryan" });
    const html = buildLearningPortfolioHtml(report, {
      schoolYear: "2025–2026",
      now: Date.parse("2026-08-11T12:00:00Z"),
    });
    expect(html).toMatch(/Learning Portfolio/);
    expect(html).toMatch(/Ryan/);
    expect(html).toMatch(/Parent narrative/);
    expect(html).toMatch(/2025–2026/);
    expect(html).not.toMatch(/CURSOR_API|api[_-]?key|sk-/i);
    expect(report.kpis.effortAttempts).toBe(4);
  });

  it("filename is safe", () => {
    expect(
      learningPortfolioFilename("Ryan / test!", Date.parse("2026-08-11")),
    ).toMatch(/^spark-portfolio-Ryan_test_-2026-08-11\.html$/);
  });

  it("empty report still renders", () => {
    const report = buildFamilyReport(null, { accountLabel: "Kid" });
    const html = buildLearningPortfolioHtml(report);
    expect(html).toMatch(/Kid/);
    expect(html).toMatch(/No subject radar|No learning data/i);
    expect(report.kpis.effortAttempts).toBe(0);
  });
});
