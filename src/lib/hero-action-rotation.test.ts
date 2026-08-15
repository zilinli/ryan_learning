import { beforeEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  cycleHeroAction,
  noteHeroShown,
  pickHeroAction,
  type HeroCandidate,
} from "./hero-action-rotation";

const ACCOUNT = "acct_hero_test";

beforeEach(() => {
  kvClearMemory();
});

describe("hero-action-rotation", () => {
  const all: HeroCandidate[] = [
    { kind: "explore" },
    { kind: "deepDive" },
    { kind: "connection" },
    { kind: "practice" },
  ];

  it("returns null for empty candidates", () => {
    expect(pickHeroAction([], ACCOUNT)).toBeNull();
  });

  it("picks highest priority when no last shown", () => {
    expect(pickHeroAction(all, ACCOUNT)?.kind).toBe("deepDive");
  });

  it("avoids last-shown kind when alternatives exist", () => {
    noteHeroShown(ACCOUNT, "deepDive");
    expect(pickHeroAction(all, ACCOUNT)?.kind).toBe("practice");
  });

  it("falls back to only candidate even if it was last", () => {
    noteHeroShown(ACCOUNT, "explore");
    expect(pickHeroAction([{ kind: "explore" }], ACCOUNT)?.kind).toBe("explore");
  });

  it("respects preferKind override", () => {
    expect(
      pickHeroAction(all, ACCOUNT, { preferKind: "connection" })?.kind,
    ).toBe("connection");
  });

  it("cycles in priority order and wraps", () => {
    const first = cycleHeroAction(all, null);
    expect(first?.kind).toBe("deepDive");
    const second = cycleHeroAction(all, "deepDive");
    expect(second?.kind).toBe("practice");
    const afterLast = cycleHeroAction(all, "connection");
    expect(afterLast?.kind).toBe("deepDive");
  });
});
