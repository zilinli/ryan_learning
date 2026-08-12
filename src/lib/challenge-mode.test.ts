import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import { normalizeMemory } from "./learning-memory";
import {
  bumpChallengeStreak,
  buildChallengeKickoffMessage,
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
});
