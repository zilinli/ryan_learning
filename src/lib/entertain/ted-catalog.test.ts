import { describe, expect, it } from "vitest";
import {
  findTedTalk,
  parseTedSlug,
  searchTedCatalog,
  TED_CATALOG,
  tedEmbedUrl,
  tedTalkUrl,
} from "./ted-catalog";

describe("ted-catalog", () => {
  it("has a curated set of talks", () => {
    expect(TED_CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it("parseTedSlug accepts slug and TED URLs", () => {
    expect(parseTedSlug("sir_ken_robinson_do_schools_kill_creativity")).toBe(
      "sir_ken_robinson_do_schools_kill_creativity",
    );
    expect(
      parseTedSlug(
        "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity",
      ),
    ).toBe("sir_ken_robinson_do_schools_kill_creativity");
    expect(parseTedSlug("https://example.com/x")).toBeNull();
  });

  it("findTedTalk + embed URLs", () => {
    const t = findTedTalk("susan_cain_the_power_of_introverts");
    expect(t?.speaker).toMatch(/Cain/i);
    expect(tedEmbedUrl(t!.slug)).toContain("embed.ted.com/talks/");
    expect(tedTalkUrl(t!.slug)).toContain("ted.com/talks/");
  });

  it("search filters by query and topic", () => {
    const grit = searchTedCatalog("grit");
    expect(grit.some((t) => t.slug.includes("grit"))).toBe(true);
    const science = searchTedCatalog("", "science");
    expect(science.every((t) => t.topics.includes("science"))).toBe(true);
  });

  it("has ~40 curated talks for V1", () => {
    expect(TED_CATALOG.length).toBeGreaterThanOrEqual(35);
    expect(TED_CATALOG.length).toBeLessThanOrEqual(80);
  });
});
