import { describe, expect, it } from "vitest";
import {
  buildSelfDescription,
  selfDescriptionKey,
  type SelfDescription,
} from "./direction-report";
import type { InterestRecord } from "./interest-store";
import type { CreationItem } from "./entertain/creations-store";

function interest(partial: Partial<InterestRecord>): InterestRecord {
  return {
    topicId: "space",
    label: "Space",
    emoji: "🚀",
    exploredAt: Date.now(),
    count: 3,
    ...partial,
  };
}

function creation(partial: Partial<CreationItem>): CreationItem {
  return {
    id: "c1",
    type: "video",
    title: "Rocket launch",
    createdAt: Date.now(),
    accountId: "acct_ryan",
    ...partial,
  };
}

describe("buildSelfDescription (P2-3 direction report)", () => {
  it("nicknames from the top interest and becoming from the latest creation", () => {
    const d: SelfDescription = buildSelfDescription("Ryan", [
      interest({ topicId: "space", label: "Space", count: 6 }),
      interest({ topicId: "music", label: "Music", count: 2 }),
    ], [
      creation({ type: "video", title: "Rocket launch" }),
    ]);
    expect(d.nickname).toBe("Space explorer");
    expect(d.becoming).toBe("a filmmaker");
    expect(d.line).toMatch(/^Ryan · Space explorer · becoming a filmmaker$/);
    expect(d.blurb).toContain("Space");
    expect(d.blurb).toContain("Rocket launch");
  });

  it("becoming falls back to the top interest when no creations exist", () => {
    const d = buildSelfDescription("Ryan", [
      interest({ label: "Ocean", count: 4 }),
    ], []);
    expect(d.becoming).toBe("a Ocean explorer");
    expect(d.line).toContain("becoming a Ocean explorer");
  });

  it("empty profile still yields a friendly description", () => {
    const d = buildSelfDescription("Ryan", [], []);
    expect(d.nickname).toBe("curious mind");
    expect(d.becoming).toBe("a builder of ideas");
    expect(d.line.length).toBeGreaterThan(0);
  });

  it("storage key is per-account", () => {
    expect(selfDescriptionKey("acct_a")).toBe("spark.selfDescription.acct_a");
    expect(selfDescriptionKey("")).toBe("spark.selfDescription.default");
  });
});
