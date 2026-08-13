import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  interestStorageKey,
  loadInterests,
  recentInterests,
  recordInterest,
} from "./interest-store";

const ACCT = "acct_interests";

afterEach(() => {
  kvClearMemory();
  // Clear any localStorage write in test envs that persist
  const key = interestStorageKey(ACCT);
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
});

describe("interest-store", () => {
  it("starts empty and records a first interest", () => {
    expect(loadInterests(ACCT)).toEqual([]);
    const row = recordInterest(ACCT, { topicId: "space", label: "Space & planets", emoji: "🚀" });
    expect(row.count).toBe(1);
    expect(loadInterests(ACCT)).toHaveLength(1);
  });

  it("upserts the same topic and bumps the count", () => {
    recordInterest(ACCT, { topicId: "space", label: "Space & planets", emoji: "🚀" });
    recordInterest(ACCT, { topicId: "space", label: "Space & planets", emoji: "🚀" });
    const rows = loadInterests(ACCT);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(2);
  });

  it("keeps separate topics distinct and sorts newest-first", () => {
    recordInterest(ACCT, { topicId: "space", label: "Space", emoji: "🚀" });
    recordInterest(ACCT, { topicId: "music", label: "Music", emoji: "🎵" });
    const rows = loadInterests(ACCT);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.topicId).toBe("music");
  });

  it("recentInterests is bounded", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) {
      recordInterest(ACCT, { topicId: id, label: id, emoji: "✨" });
    }
    expect(recentInterests(ACCT, 5)).toHaveLength(5);
  });
});
