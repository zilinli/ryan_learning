import { afterEach, describe, expect, it } from "vitest";
import { normalizeMemory, type LearningMemory } from "./learning-memory";
import {
  IDLE_SOFT_DAYS,
  buildPracticeKickoffOpener,
  consumePracticeKickoff,
  daysSinceLastActivity,
  isSoftIdle,
  parentIdleNote,
  softReturnOpenerLine,
  stashPracticeKickoff,
} from "./idle-nudge";

function memAt(lastSeen: number): LearningMemory {
  return normalizeMemory({
    skills: [
      {
        id: "fractions-concepts",
        label: "Fraction concepts",
        topicId: "fractions",
        pKnown: 0.4,
        mastery: 40,
        attempts: 3,
        correct: 1,
        incorrect: 2,
        lastSeen,
        sm2State: { ef: 2.5, interval: 1, reps: 0, prevReview: 0 },
        eloState: { rating: 1200, n: 0, lastUpdate: 0 },
      },
    ],
    updatedAt: lastSeen,
  });
}

afterEach(() => {
  // Ensure one-shot kickoff does not leak across tests (memory or sessionStorage).
  consumePracticeKickoff();
});

describe("idle-nudge (AUD.6a)", () => {
  it("IN1: daysSinceLastActivity floors calendar days", () => {
    const now = Date.parse("2026-08-11T12:00:00Z");
    expect(daysSinceLastActivity(null, now)).toBeNull();
    expect(daysSinceLastActivity(memAt(now), now)).toBe(0);
    expect(
      daysSinceLastActivity(memAt(now - 3 * 86_400_000), now),
    ).toBe(3);
  });

  it("IN2: isSoftIdle at IDLE_SOFT_DAYS threshold", () => {
    const now = Date.parse("2026-08-11T12:00:00Z");
    expect(isSoftIdle(memAt(now - 2 * 86_400_000), now)).toBe(false);
    expect(isSoftIdle(memAt(now - IDLE_SOFT_DAYS * 86_400_000), now)).toBe(
      true,
    );
  });

  it("IN3: soft return copy has no streak language", () => {
    const line = softReturnOpenerLine("Fraction concepts", 5);
    expect(line).toMatch(/Welcome back/i);
    expect(line).toMatch(/Fraction concepts/);
    expect(line.toLowerCase()).not.toMatch(/streak|flame|chain|day\s*\d+/);
  });

  it("IN4: parentIdleNote only when ≥ threshold", () => {
    expect(parentIdleNote(2)).toBeNull();
    expect(parentIdleNote(3)).toBe("Past 3 days unused");
    expect(parentIdleNote(10)).toBe("Past 10 days unused");
  });

  it("IN5: stash/consume practice kickoff is one-shot", () => {
    stashPracticeKickoff({
      skillId: "fractions-concepts",
      label: "Fraction concepts",
      source: "dashboard-misconception",
    });
    const a = consumePracticeKickoff();
    expect(a?.skillId).toBe("fractions-concepts");
    expect(consumePracticeKickoff()).toBeNull();
    const opener = buildPracticeKickoffOpener(a!);
    expect(opener.kind).toBe("practice");
    expect(opener.line).toMatch(/learning map/i);
  });
});
