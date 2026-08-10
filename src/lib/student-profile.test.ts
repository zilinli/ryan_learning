import { beforeEach, describe, expect, it } from "vitest";
import {
  BASIS_G4_CURRICULUM,
  RYAN_PROFILE,
  createAccount,
  DEFAULT_STUDENT_PROFILE,
  curriculumPromptLines,
  getActiveAccount,
  gradeBandForGrade,
  loadAccounts,
  RYAN_ACCOUNT_ID,
  saveRyanAccount,
  studentProfilePromptLines,
  switchAccount,
  type GradeBand,
} from "./student-profile";
import {
  emptyEngagement,
  engagementSummary,
  recordLearningTurn,
} from "./engagement";

function mockLocalStorage() {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
      },
    },
    writable: true,
    configurable: true,
  });
  return map;
}

describe("gradeBandForGrade", () => {
  it("returns early for K-2", () => {
    expect(gradeBandForGrade(1)).toBe("early");
    expect(gradeBandForGrade(2)).toBe("early");
  });

  it("returns elementary for G3-5", () => {
    expect(gradeBandForGrade(3)).toBe("elementary");
    expect(gradeBandForGrade(4)).toBe("elementary");
    expect(gradeBandForGrade(5)).toBe("elementary");
  });

  it("returns middle for G6-8", () => {
    expect(gradeBandForGrade(6)).toBe("middle");
    expect(gradeBandForGrade(7)).toBe("middle");
    expect(gradeBandForGrade(8)).toBe("middle");
  });

  it("returns high for G9-12", () => {
    expect(gradeBandForGrade(9)).toBe("high");
    expect(gradeBandForGrade(10)).toBe("high");
    expect(gradeBandForGrade(12)).toBe("high");
  });
});

describe("student profile", () => {
  it("default profile is grade-agnostic", () => {
    expect(DEFAULT_STUDENT_PROFILE.name).toBe("");
    expect(DEFAULT_STUDENT_PROFILE.grade).toBe(4);
    expect(DEFAULT_STUDENT_PROFILE.gradeBand).toBe("elementary");
    expect(DEFAULT_STUDENT_PROFILE.school).toBe("");
  });

  it("RYAN_PROFILE preserves all G4/BASIS data", () => {
    expect(RYAN_PROFILE.name).toBe("Ryan");
    expect(RYAN_PROFILE.grade).toBe(4);
    expect(RYAN_PROFILE.gradeBand).toBe("elementary");
    expect(RYAN_PROFILE.school).toBe("BASIS International School");
    expect(RYAN_PROFILE.preferredChinese).toBe("yue");
    expect(RYAN_PROFILE.curriculum?.label).toContain("BASIS");
    expect(BASIS_G4_CURRICULUM).toMatch(/fraction/i);
  });

  it("renders prompt lines with Ryan's name and curriculum", () => {
    const lines = studentProfilePromptLines(RYAN_PROFILE).join("\n");
    expect(lines).toContain("Ryan");
    expect(lines).toContain("BASIS");
    expect(lines).toContain("Grade 4");
    expect(lines).toMatch(/粤语|Cantonese/);
    expect(lines).toMatch(/NEVER ask what to call them/);
    expect(lines).not.toMatch(/Ask the student what they'd like to be called/);
  });

  it("renders prompt lines with blank name for new student", () => {
    const lines = studentProfilePromptLines(DEFAULT_STUDENT_PROFILE).join("\n");
    expect(lines).toContain("(new student)");
    expect(lines).toContain("(no school set)");
    expect(lines).toMatch(/Ask the student what they'd like to be called/);
  });

  it("uses account name in prompt so tutor does not re-ask (e.g. Ching)", () => {
    const lines = studentProfilePromptLines({
      ...DEFAULT_STUDENT_PROFILE,
      name: "Ching",
    }).join("\n");
    expect(lines).toContain("account name is Ching");
    expect(lines).toMatch(/NEVER ask what to call them/);
    expect(lines).not.toMatch(/Ask the student what they'd like to be called/);
  });

  it("curriculumPromptLines for Ryan returns BASIS refs", () => {
    const lines = curriculumPromptLines(RYAN_PROFILE).join("\n");
    expect(lines).toContain("BASIS");
    expect(lines).toContain("Envision");
  });

  it("curriculumPromptLines returns grade-band-appropriate hints", () => {
    const earlyProfile = { ...DEFAULT_STUDENT_PROFILE, grade: 1, gradeBand: "early" as GradeBand };
    const earlyLines = curriculumPromptLines(earlyProfile).join("\n");
    expect(earlyLines).toContain("K-2");

    const middleProfile = { ...DEFAULT_STUDENT_PROFILE, grade: 7, gradeBand: "middle" as GradeBand };
    const middleLines = curriculumPromptLines(middleProfile).join("\n");
    expect(middleLines).toContain("G6-8");

    const highProfile = { ...DEFAULT_STUDENT_PROFILE, grade: 11, gradeBand: "high" as GradeBand };
    const highLines = curriculumPromptLines(highProfile).join("\n");
    expect(highLines).toContain("G9-12");
  });
});

describe("multi-account", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("seeds Ryan as a saved account", () => {
    const store = loadAccounts();
    expect(store.accounts.some((a) => a.id === RYAN_ACCOUNT_ID)).toBe(true);
    expect(getActiveAccount(store).profile.name).toBe("Ryan");
    expect(getActiveAccount(store).profile.grade).toBe(4);
    expect(getActiveAccount(store).profile.gradeBand).toBe("elementary");
  });

  it("creates a named account and can switch back to Ryan", () => {
    let store = createAccount("Alex");
    expect(getActiveAccount(store).profile.name).toBe("Alex");
    expect(getActiveAccount(store).profile.grade).toBe(4); // grade-agnostic default
    expect(getActiveAccount(store).profile.school).toBe(""); // not BASIS
    store = saveRyanAccount(false, store);
    expect(store.accounts.some((a) => a.profile.name === "Ryan")).toBe(true);
    store = switchAccount(RYAN_ACCOUNT_ID, store);
    expect(getActiveAccount(store).profile.name).toBe("Ryan");
    store = switchAccount(
      store.accounts.find((a) => a.profile.name === "Alex")!.id,
      store,
    );
    expect(getActiveAccount(store).profile.name).toBe("Alex");
  });

  it("createAccount accepts partial profile with grade", () => {
    const store = createAccount("Emma", { grade: 8, school: "Middle School" });
    const active = getActiveAccount(store);
    expect(active.profile.name).toBe("Emma");
    expect(active.profile.grade).toBe(8);
    expect(active.profile.gradeBand).toBe("middle");
    expect(active.profile.school).toBe("Middle School");
  });

  it("createAccount with just a name uses grade-agnostic defaults (not Ryan's)", () => {
    const store = createAccount("NewKid");
    const active = getActiveAccount(store);
    expect(active.profile.name).toBe("NewKid");
    expect(active.profile.school).toBe("");
    expect(active.profile.curriculum).toBeNull();
    expect(active.profile.stronger).toEqual([]);
  });
});

describe("engagement", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

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
