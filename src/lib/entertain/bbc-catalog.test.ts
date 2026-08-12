import { describe, expect, it } from "vitest";
import {
  BBC_CATALOG,
  findBbcClip,
  searchBbcCatalog,
  BBC_TOPICS,
  BBC_TOPIC_LABELS,
  bbcVideoUrl,
} from "./bbc-catalog";

describe("bbc-catalog", () => {
  it("has at least 20 clips", () => {
    expect(BBC_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it("every clip has required fields", () => {
    for (const c of BBC_CATALOG) {
      expect(c.videoId).toBeTruthy();
      expect(c.videoId.length).toBe(11);
      expect(c.title).toBeTruthy();
      expect(c.series).toBeTruthy();
      expect(BBC_TOPICS).toContain(c.topic);
      expect(c.durationSec).toBeGreaterThan(60);
      expect(c.gradeMin).toBeGreaterThanOrEqual(1);
      expect(c.gradeMax).toBeLessThanOrEqual(12);
      expect(c.gradeMin).toBeLessThanOrEqual(c.gradeMax);
      expect(c.blurb.length).toBeGreaterThan(20);
      expect(c.channel).toBeTruthy();
    }
  });

  it("findBbcClip returns clip by videoId", () => {
    const c = findBbcClip("cTQ3Ko9ZKg8");
    expect(c).toBeTruthy();
    expect(c!.title).toContain("Penguin");
  });

  it("findBbcClip returns undefined for unknown id", () => {
    expect(findBbcClip("nonexistent")).toBeUndefined();
  });

  it("searchBbcCatalog filters by topic", () => {
    const results = searchBbcCatalog("", "nature");
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const r of results) {
      expect(r.topic).toBe("nature");
    }
  });

  it("searchBbcCatalog filters by query", () => {
    const results = searchBbcCatalog("penguin", undefined);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("bbcVideoUrl generates YouTube URL", () => {
    expect(bbcVideoUrl("abcdefghijk")).toContain("youtube.com");
    expect(bbcVideoUrl("abcdefghijk")).toContain("abcdefghijk");
  });

  it("BBC_TOPIC_LABELS has labels for all topics", () => {
    for (const t of BBC_TOPICS) {
      expect(BBC_TOPIC_LABELS[t]).toBeTruthy();
    }
  });
});
