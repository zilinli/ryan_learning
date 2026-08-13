import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import { normalizeMemory } from "./learning-memory";
import {
  bumpChallengeStreak,
  buildChallengeKickoffMessage,
  challengeGauge,
  challengeLevelForStreak,
  challengeStreakStorageKey,
  endChallengeSession,
  getChallengeStreak,
  pickChallengeSkills,
  recordChallengeOutcome,
  resetChallengeStreak,
  startChallengeSession,
} from "./challenge-mode";

const ACCT = "acct_challenge";

function masteredMem() {
  const now = Date.now();
  return normalizeMemory({
    skills: [
      {
        id: "algebra-equations",
        label: "Algebra equations",
        topicId: "algebra",
        pKnown: 0.92,
        mastery: 92,
        attempts: 12,
        correct: 11,
        incorrect: 1,
        lastSeen: now,
        sm2State: { ef: 2.5, interval: 8, reps: 6, prevReview: now - 3 * 86_400_000 },
        eloState: { rating: 1750, n: 12, lastUpdate: now },
      },
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.45,
        mastery: 45,
        attempts: 5,
        correct: 2,
        incorrect: 3,
        lastSeen: now,
        sm2State: { ef: 2.3, interval: 2, reps: 2, prevReview: now - 10 * 86_400_000 },
        eloState: { rating: 1300, n: 5, lastUpdate: now },
      },
    ],
    updatedAt: now,
  });
}

afterEach(() => {
  kvClearMemory();
  kvRemove(challengeStreakStorageKey(ACCT, "algebra-equations"));
  endChallengeSession();
});

describe("challenge-mode", () => {
  it("picks only mastered skills", () => {
    const skills = pickChallengeSkills(masteredMem());
    expect(skills).toHaveLength(1);
    expect(skills[0]?.id).toBe("algebra-equations");
  });

  it("level ramps with consecutive-correct streak", () => {
    expect(challengeLevelForStreak(0)).toBe(1);
    expect(challengeLevelForStreak(2)).toBe(1);
    expect(challengeLevelForStreak(3)).toBe(2);
    expect(challengeLevelForStreak(5)).toBe(2);
    expect(challengeLevelForStreak(6)).toBe(3);
  });

  it("streak persists, bumps, and resets", () => {
    expect(getChallengeStreak(ACCT, "algebra-equations")).toBe(0);
    expect(bumpChallengeStreak(ACCT, "algebra-equations")).toBe(1);
    expect(bumpChallengeStreak(ACCT, "algebra-equations")).toBe(2);
    expect(getChallengeStreak(ACCT, "algebra-equations")).toBe(2);
    resetChallengeStreak(ACCT, "algebra-equations");
    expect(getChallengeStreak(ACCT, "algebra-equations")).toBe(0);
  });

  it("recordChallengeOutcome bumps on correct when active", () => {
    startChallengeSession({ accountId: ACCT, skillId: "algebra-equations", label: "Algebra", startedAt: Date.now() });
    expect(recordChallengeOutcome(ACCT, "correct")).toBe(1);
    expect(recordChallengeOutcome(ACCT, "correct")).toBe(2);
    expect(getChallengeStreak(ACCT, "algebra-equations")).toBe(2);
  });

  it("recordChallengeOutcome resets on incorrect", () => {
    startChallengeSession({ accountId: ACCT, skillId: "algebra-equations", label: "Algebra", startedAt: Date.now() });
    bumpChallengeStreak(ACCT, "algebra-equations");
    bumpChallengeStreak(ACCT, "algebra-equations");
    recordChallengeOutcome(ACCT, "incorrect");
    expect(getChallengeStreak(ACCT, "algebra-equations")).toBe(0);
  });

  it("recordChallengeOutcome ignores non-active accounts", () => {
    startChallengeSession({ accountId: ACCT, skillId: "algebra-equations", label: "Algebra", startedAt: Date.now() });
    expect(recordChallengeOutcome("acct_other", "correct")).toBeNull();
  });

  it("builds a kickoff message with level hint", () => {
    const mem = masteredMem();
    const msg = buildChallengeKickoffMessage(mem.skills[0]!, 4);
    expect(msg).toMatch(/Algebra equations/);
    expect(msg).toMatch(/harder — multi-step/i);
    expect(msg).toMatch(/transfer/);
  });

  it("fast correct answers climb the band twice as fast (P0 flow)", () => {
    startChallengeSession({ accountId: ACCT, skillId: "algebra-equations", label: "Algebra", startedAt: Date.now() });
    expect(recordChallengeOutcome(ACCT, "correct", { fast: true })).toBe(2);
    expect(getChallengeStreak(ACCT, "algebra-equations")).toBe(2);
    expect(recordChallengeOutcome(ACCT, "correct", { fast: true })).toBe(4);
    expect(challengeLevelForStreak(4)).toBe(2);
  });

  it("slow flag doesn't change correct outcomes (still +1)", () => {
    startChallengeSession({ accountId: ACCT, skillId: "algebra-equations", label: "Algebra", startedAt: Date.now() });
    expect(recordChallengeOutcome(ACCT, "correct", { slow: true })).toBe(1);
  });

  it("challengeGauge reports level, progress and growth moment", () => {
    startChallengeSession({ accountId: ACCT, skillId: "algebra-equations", label: "Algebra", startedAt: Date.now() });
    bumpChallengeStreak(ACCT, "algebra-equations"); // streak 1
    const g1 = challengeGauge(ACCT, "algebra-equations", 1);
    expect(g1.level).toBe(1);
    expect(g1.toNext).toBe(2);
    expect(g1.progress).toBeCloseTo(1 / 3);
    expect(g1.growthLine).toBeNull();
    // Reach level 2 (streak >= 3)
    bumpChallengeStreak(ACCT, "algebra-equations");
    bumpChallengeStreak(ACCT, "algebra-equations");
    const g2 = challengeGauge(ACCT, "algebra-equations", 1);
    expect(g2.level).toBe(2);
    expect(g2.growthLine).toMatch(/level-up/i);
  });
});
