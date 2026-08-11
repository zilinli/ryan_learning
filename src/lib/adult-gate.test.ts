import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  checkAdultChallenge,
  createAdultChallenge,
} from "./adult-gate";

describe("adult-gate", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0); // always first branch (add)
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates solvable add challenge and checks answer", () => {
    // random 0 → a = 28+0*(51)=28, b = 17+0*32=17 → 45
    const c = createAdultChallenge(1_700_000_000_000);
    expect(c.prompt).toMatch(/What is \d+ \+ \d+/);
    expect(checkAdultChallenge(c, c.answer)).toBe(true);
    expect(checkAdultChallenge(c, "0")).toBe(false);
  });

  it("year challenge uses current year", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // last branch
    const now = Date.UTC(2026, 7, 11);
    const c = createAdultChallenge(now);
    expect(c.prompt).toMatch(/year/i);
    expect(checkAdultChallenge(c, "2026")).toBe(true);
  });
});
