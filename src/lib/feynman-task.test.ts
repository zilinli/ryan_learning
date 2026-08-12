import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory, kvRemove } from "./browser-kv";
import { normalizeMemory } from "./learning-memory";
import {
  buildFeynmanTask,
  feynmanDoneKey,
  feynmanTaskLine,
  feynmanWeekKey,
  loadFeynmanDone,
  markFeynmanDone,
} from "./feynman-task";

const ACCT = "acct_feynman";

function mem() {
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
        pKnown: 0.4,
        mastery: 40,
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
  kvRemove(feynmanDoneKey(ACCT, "2026-08-10"));
});

describe("feynman-task", () => {
  it("picks the strongest practiced skill", () => {
    const task = buildFeynmanTask(mem(), Date.parse("2026-08-10T10:00:00"))!;
    expect(task.skillId).toBe("algebra-equations");
    expect(task.weekOf).toBe("2026-08-10");
    expect(task.kidPrompt).toMatch(/Algebra equations/);
    expect(task.parentPrompt).toMatch(/teach you/);
  });

  it("returns null without practiced skills", () => {
    expect(buildFeynmanTask(null)).toBeNull();
    expect(
      buildFeynmanTask(normalizeMemory({ skills: [], updatedAt: 1 })),
    ).toBeNull();
  });

  it("week key lands on Monday", () => {
    expect(feynmanWeekKey(Date.parse("2026-08-12T10:00:00"))).toBe("2026-08-10");
    expect(feynmanWeekKey(Date.parse("2026-08-16T10:00:00"))).toBe("2026-08-10");
  });

  it("done-state persists per week and account", () => {
    const task = buildFeynmanTask(mem(), Date.parse("2026-08-10T10:00:00"))!;
    expect(loadFeynmanDone(ACCT, task.weekOf)).toBe(false);
    markFeynmanDone(ACCT, task);
    expect(loadFeynmanDone(ACCT, task.weekOf)).toBe(true);
    expect(loadFeynmanDone("acct_other", task.weekOf)).toBe(false);
  });

  it("weekly line reflects done state", () => {
    const task = buildFeynmanTask(mem(), Date.parse("2026-08-10T10:00:00"))!;
    expect(feynmanTaskLine(task, false)).toMatch(/explain Algebra equations/);
    expect(feynmanTaskLine(task, true)).toMatch(/explained Algebra equations to the family/);
  });
});
