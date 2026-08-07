import { beforeEach, describe, expect, it } from "vitest";
import {
  BASIS_G4_CURRICULUM,
  createAccount,
  DEFAULT_STUDENT_PROFILE,
  getActiveAccount,
  loadAccounts,
  RYAN_ACCOUNT_ID,
  saveRyanAccount,
  studentProfilePromptLines,
  switchAccount,
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

describe("student profile", () => {
  it("defaults to Ryan at BASIS G4", () => {
    expect(DEFAULT_STUDENT_PROFILE.name).toBe("Ryan");
    expect(DEFAULT_STUDENT_PROFILE.preferredChinese).toBe("yue");
    expect(BASIS_G4_CURRICULUM).toMatch(/fraction/i);
  });

  it("renders prompt lines with name and curriculum", () => {
    const lines = studentProfilePromptLines().join("\n");
    expect(lines).toContain("Ryan");
    expect(lines).toContain("BASIS");
    expect(lines).toMatch(/粤语|Cantonese/);
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
  });

  it("creates a named account and can switch back to Ryan", () => {
    let store = createAccount("Alex");
    expect(getActiveAccount(store).profile.name).toBe("Alex");
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
