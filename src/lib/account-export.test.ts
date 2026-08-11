import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EXPORT_VERSION,
  accountExportFilename,
  buildAccountLearningExport,
} from "./account-export";
import { normalizeMemory } from "./learning-memory";

function sampleMem(now = Date.now()) {
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
        sm2State: { ef: 2.2, interval: 2, reps: 1, prevReview: now },
        eloState: { rating: 1200, n: 4, lastUpdate: now },
        misconceptionHits: [{ id: "frac-add-denom", count: 2, lastSeen: now }],
      },
    ],
    recentWins: ["got equivalent fractions"],
    recentStruggles: ["stuck on denominators"],
  });
}

describe("buildAccountLearningExport", () => {
  it("returns null for empty accountId", () => {
    expect(buildAccountLearningExport("", sampleMem())).toBeNull();
    expect(buildAccountLearningExport("   ", sampleMem())).toBeNull();
  });

  it("builds a stable portable snapshot without sm2/elo internals", () => {
    const now = Date.UTC(2026, 7, 11, 12, 0, 0);
    const out = buildAccountLearningExport("acct_ryan", sampleMem(now), now);
    expect(out).not.toBeNull();
    expect(out!.version).toBe(ACCOUNT_EXPORT_VERSION);
    expect(out!.accountId).toBe("acct_ryan");
    expect(out!.exportedAt).toBe(new Date(now).toISOString());
    expect(out!.skillCount).toBe(1);
    expect(out!.skills[0]).toMatchObject({
      id: "fractions-concepts",
      mastery: 40,
      misconceptionHits: [{ id: "frac-add-denom", count: 2 }],
    });
    expect(out!.skills[0]).not.toHaveProperty("sm2State");
    expect(out!.skills[0]).not.toHaveProperty("eloState");
    expect(out!.recentWins).toEqual(["got equivalent fractions"]);
    expect(out!.dailyDigest.length).toBeGreaterThan(0);
    expect(out!.weeklyDigest).toContain("Week of");
  });

  it("handles null memory", () => {
    const out = buildAccountLearningExport("acct_amy", null);
    expect(out!.skillCount).toBe(0);
    expect(out!.skills).toEqual([]);
    expect(out!.dailyDigest).toMatch(/no skill activity/i);
  });
});

describe("accountExportFilename", () => {
  it("sanitizes account id and date-stamps", () => {
    const now = Date.UTC(2026, 7, 11);
    expect(accountExportFilename("acct_ryan", now)).toBe(
      "spark-learning-ryan-2026-08-11.json",
    );
    expect(accountExportFilename("acct_weird/../x", now)).toMatch(
      /^spark-learning-weird.*2026-08-11\.json$/,
    );
  });
});
