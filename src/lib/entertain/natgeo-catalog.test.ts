import { describe, expect, it } from "vitest";
import {
  NATGEO_CATALOG,
  findNatGeoArticle,
  searchNatGeoCatalog,
  NATGEO_TOPICS,
  NATGEO_TOPIC_LABELS,
  natgeoArticleUrl,
} from "./natgeo-catalog";

describe("natgeo-catalog", () => {
  it("has at least 25 articles", () => {
    expect(NATGEO_CATALOG.length).toBeGreaterThanOrEqual(25);
  });

  it("every article has required fields with valid values", () => {
    for (const a of NATGEO_CATALOG) {
      expect(a.slug).toBeTruthy();
      expect(typeof a.slug).toBe("string");
      expect(a.title).toBeTruthy();
      expect(typeof a.title).toBe("string");
      expect(a.topic).toBeTruthy();
      expect(NATGEO_TOPICS).toContain(a.topic);
      expect(a.gradeMin).toBeGreaterThanOrEqual(1);
      expect(a.gradeMax).toBeLessThanOrEqual(12);
      expect(a.gradeMin).toBeLessThanOrEqual(a.gradeMax);
      expect(a.readingTimeMin).toBeGreaterThanOrEqual(1);
      expect(a.blurb.length).toBeGreaterThan(20);
      expect(a.body.length).toBeGreaterThan(300);
    }
  });

  it("findNatGeoArticle returns article by slug", () => {
    const a = findNatGeoArticle("african-lion");
    expect(a).toBeTruthy();
    expect(a!.title).toBe("African Lion");
  });

  it("findNatGeoArticle returns undefined for unknown slug", () => {
    expect(findNatGeoArticle("nonexistent-slug")).toBeUndefined();
  });

  it("searchNatGeoCatalog filters by topic", () => {
    const results = searchNatGeoCatalog("", "animals");
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const r of results) {
      expect(r.topic).toBe("animals");
    }
  });

  it("searchNatGeoCatalog filters by query", () => {
    const results = searchNatGeoCatalog("lion", undefined);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.some(
        (r) =>
          r.title.toLowerCase().includes("lion") ||
          r.body.toLowerCase().includes("lion"),
      ),
    ).toBe(true);
  });

  it("searchNatGeoCatalog with both query and topic", () => {
    const results = searchNatGeoCatalog("shark", "animals");
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.topic).toBe("animals");
    }
  });

  it("natgeoArticleUrl generates correct URL", () => {
    expect(natgeoArticleUrl("african-lion")).toContain(
      "kids.nationalgeographic.com",
    );
    expect(natgeoArticleUrl("african-lion")).toContain("african-lion");
  });

  it("NATGEO_TOPIC_LABELS has labels for all topics", () => {
    for (const t of NATGEO_TOPICS) {
      expect(NATGEO_TOPIC_LABELS[t]).toBeTruthy();
      expect(typeof NATGEO_TOPIC_LABELS[t]).toBe("string");
    }
  });
});
