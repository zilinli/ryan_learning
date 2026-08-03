import { describe, expect, it } from "vitest";
import {
  BASIS_G4_CURRICULUM,
  DEFAULT_STUDENT_PROFILE,
  studentProfilePromptLines,
} from "./student-profile";
import {
  emptyEngagement,
  engagementSummary,
  recordLearningTurn,
} from "./engagement";

describe("student profile", () => {
  it("defaults to Ryan at BASIS G4", () => {
    expect(DEFAULT_STUDENT_PROFILE.name).toBe("Ryan");
    expect(DEFAULT_STUDENT_PROFILE.preferredChinese).toBe("zh");
    expect(BASIS_G4_CURRICULUM).toMatch(/fraction/i);
  });

  it("renders prompt lines with name and curriculum", () => {
    const lines = studentProfilePromptLines().join("\n");
    expect(lines).toContain("Ryan");
    expect(lines).toContain("BASIS");
    expect(lines).toMatch(/普通话|Mandarin/);
  });
});

describe("engagement", () => {
  it("starts a streak and unlocks daily goal badge", () => {
    let state = emptyEngagement();
    state = recordLearningTurn(state);
    expect(state.streak).toBe(1);
    expect(state.solvesToday).toBe(1);
    state = recordLearningTurn(state);
    state = recordLearningTurn(state);
    expect(state.solvesToday).toBe(3);
    expect(state.badges).toContain("Daily goal ✓");
    expect(engagementSummary(state)).toMatch(/今日 3\/3/);
  });
});
