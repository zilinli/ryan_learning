import { afterEach, describe, expect, it } from "vitest";
import { kvClearMemory } from "./browser-kv";
import {
  buildCuriosityMap,
  interestStorageKey,
  loadInterests,
  mergeInterests,
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

  it("V3 — mergeInterests unions by topic and keeps max count + newest label", () => {
    const local = [
      {
        topicId: "space",
        label: "Space & planets",
        emoji: "🚀",
        exploredAt: 1000,
        count: 2,
      },
    ];
    const remote = [
      {
        topicId: "space",
        label: "Space & planets",
        emoji: "🚀",
        exploredAt: 3000,
        count: 5,
      },
      {
        topicId: "music",
        label: "Music",
        emoji: "🎵",
        exploredAt: 2000,
        count: 1,
      },
    ];
    const merged = mergeInterests(local, remote);
    expect(merged).toHaveLength(2);
    const space = merged.find((i) => i.topicId === "space");
    expect(space?.count).toBe(5);
    expect(space?.exploredAt).toBe(3000);
    expect(merged[0]?.topicId).toBe("space"); // newest first
  });
});

describe("buildCuriosityMap (P1-3 好奇心地图)", () => {
  const now = Date.now();
  const day = 86_400_000;
  const rec = (
    topicId: string,
    label: string,
    count: number,
    exploredAt: number,
  ) => ({ topicId, label, emoji: "✨", count, exploredAt });

  it("ranks this week's interests by count and yields a headline", () => {
    const map = buildCuriosityMap(
      [
        rec("space", "Space", 4, now - day),
        rec("music", "Music", 2, now - 2 * day),
        rec("art", "Art", 3, now - 3 * day),
      ],
      now,
    );
    expect(map?.words).toEqual(["Space", "Art", "Music"]);
    expect(map?.headline).toMatch(/Space/);
    expect(map?.headline).toMatch(/curiosity thread/);
  });

  it("falls back to the overall profile when nothing was explored this week", () => {
    const map = buildCuriosityMap(
      [rec("music", "Music", 2, now - 30 * day)],
      now,
    );
    expect(map?.words).toEqual(["Music"]);
    expect(map?.headline).toMatch(/return to most/);
  });

  it("returns null with no interests", () => {
    expect(buildCuriosityMap([], now)).toBeNull();
    expect(buildCuriosityMap(null as never, now)).toBeNull();
  });
});
