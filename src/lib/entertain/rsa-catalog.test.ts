import { describe, expect, it } from "vitest";
import {
  RSA_CATALOG,
  findRsaVideo,
  searchRsaCatalog,
  RSA_TOPICS,
  RSA_TOPIC_LABELS,
  rsaVideoUrl,
} from "./rsa-catalog";

describe("rsa-catalog", () => {
  it("has at least 20 videos", () => {
    expect(RSA_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it("every video has required fields", () => {
    for (const v of RSA_CATALOG) {
      expect(v.videoId).toBeTruthy();
      expect(v.videoId.length).toBe(11);
      expect(v.title).toBeTruthy();
      expect(v.speaker).toBeTruthy();
      expect(["Animate", "Shorts", "Minimate"]).toContain(v.series);
      expect(RSA_TOPICS).toContain(v.topic);
      expect(v.durationSec).toBeGreaterThan(60);
      expect(v.gradeMin).toBeGreaterThanOrEqual(1);
      expect(v.gradeMax).toBeLessThanOrEqual(12);
      expect(v.gradeMin).toBeLessThanOrEqual(v.gradeMax);
      expect(v.blurb.length).toBeGreaterThan(20);
    }
  });

  it("findRsaVideo returns video by videoId", () => {
    const v = findRsaVideo("zDZFcDGpL4U");
    expect(v).toBeTruthy();
    expect(v!.title).toContain("Drive");
  });

  it("findRsaVideo returns undefined for unknown id", () => {
    expect(findRsaVideo("nonexistent")).toBeUndefined();
  });

  it("searchRsaCatalog filters by topic", () => {
    const results = searchRsaCatalog("", "education");
    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const r of results) {
      expect(r.topic).toBe("education");
    }
  });

  it("searchRsaCatalog filters by speaker", () => {
    const results = searchRsaCatalog("Pink", undefined);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("searchRsaCatalog filters by query", () => {
    const results = searchRsaCatalog("creativity", undefined);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("rsaVideoUrl generates YouTube URL", () => {
    expect(rsaVideoUrl("abcdefghijk")).toContain("youtube.com");
  });

  it("RSA_TOPIC_LABELS has labels for all topics", () => {
    for (const t of RSA_TOPICS) {
      expect(RSA_TOPIC_LABELS[t]).toBeTruthy();
    }
  });
});
