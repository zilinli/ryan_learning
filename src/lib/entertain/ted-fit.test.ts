import { describe, expect, it } from "vitest";
import { TED_CATALOG, type TedTalk } from "./ted-catalog";
import {
  effectiveFitGrade,
  formatTedFitSortCaption,
  inferTedAudience,
  mergeTedBrowseForLearner,
  searchTedCatalogForLearner,
  sortTedTalksByLearnerFit,
  tedFitScore,
  uniqueTedTalks,
} from "./ted-fit";

function talk(
  slug: string,
  extra: Partial<TedTalk> = {},
): TedTalk {
  return {
    slug,
    title: slug.replace(/_/g, " "),
    speaker: "Speaker",
    durationSec: 600,
    topics: ["ideas"],
    blurb: "A talk",
    ...extra,
  };
}

describe("ted-fit", () => {
  const g4 = { grade: 4, age: 9 };
  const g11 = { grade: 11, age: 16 };

  it("TF1: G4 ranks TED-Ed / classroom shorts above mature talks", () => {
    const ordered = searchTedCatalogForLearner("", "all", g4);
    expect(ordered.length).toBe(TED_CATALOG.length);
    const idx = (part: string) =>
      ordered.findIndex((t) => t.slug.includes(part));
    expect(idx("gendler")).toBeGreaterThanOrEqual(0);
    expect(idx("gendler")).toBeLessThan(idx("lewinsky"));
    expect(idx("dweck")).toBeLessThan(idx("lewinsky"));
    expect(idx("treasure")).toBeLessThan(idx("ronson"));
    expect(idx("pierson")).toBeLessThan(idx("kahneman"));
    expect(idx("gendler")).toBeLessThan(5);
  });

  it("TF2: G11 does not bury mature / long talks", () => {
    const g4Order = searchTedCatalogForLearner("", "all", g4);
    const g11Order = searchTedCatalogForLearner("", "all", g11);
    const g4Lew = g4Order.findIndex((t) => t.slug.includes("lewinsky"));
    const g11Lew = g11Order.findIndex((t) => t.slug.includes("lewinsky"));
    expect(g11Lew).toBeGreaterThanOrEqual(0);
    expect(g11Lew).toBeLessThan(g4Lew);
    const g11Riddle = g11Order.findIndex((t) => t.slug.includes("gendler"));
    expect(g11Riddle).toBeGreaterThan(8);
  });

  it("TF3: young-for-grade age prefers even shorter talks", () => {
    const young = effectiveFitGrade({ grade: 4, age: 7 });
    expect(young).toBe(3);
    const riddle = TED_CATALOG.find((t) => t.slug.includes("gendler"))!;
    const ken = TED_CATALOG.find((t) => t.slug.includes("robinson"))!;
    expect(tedFitScore(riddle, { grade: 4, age: 7 })).toBeGreaterThan(
      tedFitScore(ken, { grade: 4, age: 7 }),
    );
    const gapYoung =
      tedFitScore(riddle, { grade: 4, age: 7 }) -
      tedFitScore(ken, { grade: 4, age: 7 });
    const gapTypical =
      tedFitScore(riddle, { grade: 4, age: 9 }) -
      tedFitScore(ken, { grade: 4, age: 9 });
    expect(gapYoung).toBeGreaterThanOrEqual(gapTypical);
  });

  it("TF4: infer marks mature titles; short riddle stays all", () => {
    expect(
      inferTedAudience(
        talk("jon_ronson_strange_answers_to_the_psychopath_test", {
          title: "Strange answers to the psychopath test",
          durationSec: 1068,
        }),
      ).maturity,
    ).toBe("mature");
    expect(
      inferTedAudience(
        talk("someone_the_price_of_shame", {
          title: "The price of shame",
          durationSec: 1200,
        }),
      ).maturity,
    ).toBe("mature");
    expect(
      inferTedAudience(
        talk("alex_gendler_can_you_solve_the_prisoner_hat_riddle", {
          title: "Can you solve the prisoner hat riddle?",
          durationSec: 272,
          topics: ["ideas", "education"],
        }),
      ),
    ).toMatchObject({ maturity: "all", gradeMin: 3, gradeMax: 8 });
  });

  it("TF5: equal scores keep original order (stable)", () => {
    const a = talk("aaa_equal", { durationSec: 500 });
    const b = talk("bbb_equal", { durationSec: 500 });
    const sorted = sortTedTalksByLearnerFit([a, b], g4);
    expect(sorted.map((t) => t.slug)).toEqual(["aaa_equal", "bbb_equal"]);
  });

  it("TF6: empty-query merge puts curated fit before unmatched live hit", () => {
    const live: TedTalk[] = [
      talk("brand_new_adult_conference_talk", {
        title: "A dense policy lecture",
        durationSec: 1400,
        topics: ["society"],
      }),
    ];
    const merged = mergeTedBrowseForLearner(live, g4, "all");
    expect(merged[0]?.slug).toContain("gendler");
    expect(merged.some((t) => t.slug === "brand_new_adult_conference_talk")).toBe(
      true,
    );
    expect(merged.findIndex((t) => t.slug.includes("gendler"))).toBeLessThan(
      merged.findIndex((t) => t.slug === "brand_new_adult_conference_talk"),
    );
  });

  it("TF7: topic filter still applies under learner sort", () => {
    const science = searchTedCatalogForLearner("", "science", g4);
    expect(science.length).toBeGreaterThan(0);
    expect(science.every((t) => t.topics.includes("science"))).toBe(true);
    const grit = searchTedCatalogForLearner("grit", "all", g4);
    expect(grit.some((t) => t.slug.includes("grit"))).toBe(true);
  });

  it("TF8: missing learner defaults to G4", () => {
    const withDefault = searchTedCatalogForLearner("", "all", null);
    const withG4 = searchTedCatalogForLearner("", "all", g4);
    expect(withDefault.map((t) => t.slug)).toEqual(withG4.map((t) => t.slug));
    expect(formatTedFitSortCaption(undefined)).toMatch(/G4/);
    expect(effectiveFitGrade({})).toBe(4);
  });

  it("uniqueTedTalks drops duplicate slugs", () => {
    const a = talk("same_slug", { title: "First" });
    const b = talk("same_slug", { title: "Second" });
    expect(uniqueTedTalks([a, b])).toHaveLength(1);
    expect(uniqueTedTalks([a, b])[0]?.title).toBe("First");
  });
});
