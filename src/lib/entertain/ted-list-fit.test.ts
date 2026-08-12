import { describe, expect, it } from "vitest";
import { TED_CATALOG, type TedTalk } from "./ted-catalog";
import {
  sortTedTalksForLearner,
  tedListFitScore,
  typicalAgeForGrade,
} from "./ted-list-fit";

function talk(partial: Partial<TedTalk> & Pick<TedTalk, "slug" | "title">): TedTalk {
  return {
    speaker: "Speaker",
    durationSec: 600,
    topics: ["ideas"],
    blurb: "A talk",
    ...partial,
  };
}

function indexOf(talks: TedTalk[], slugPart: string): number {
  return talks.findIndex((t) => t.slug.includes(slugPart));
}

describe("ted-list-fit", () => {
  it("TL7 typicalAgeForGrade G4 is 9", () => {
    expect(typicalAgeForGrade(4)).toBe(9);
    expect(typicalAgeForGrade(1)).toBe(6);
    expect(typicalAgeForGrade(12)).toBe(17);
  });

  it("TL1 G4 ranks classroom shorts above Kahneman / Lewinsky", () => {
    const sorted = sortTedTalksForLearner(TED_CATALOG, { grade: 4, age: 9 });
    expect(sorted.length).toBe(TED_CATALOG.length);
    const grit = indexOf(sorted, "duckworth_grit");
    const riddle = indexOf(sorted, "prisoner_hat_riddle");
    const dweck = indexOf(sorted, "carol_dweck");
    const kahneman = indexOf(sorted, "kahneman");
    const lewinsky = indexOf(sorted, "lewinsky");
    expect(grit).toBeGreaterThanOrEqual(0);
    expect(riddle).toBeGreaterThanOrEqual(0);
    expect(dweck).toBeGreaterThanOrEqual(0);
    expect(Math.min(grit, riddle, dweck)).toBeLessThan(kahneman);
    expect(Math.min(grit, riddle, dweck)).toBeLessThan(lewinsky);
  });

  it("TL2 G11 ranks Kahneman / Harari above TED-Ed riddle", () => {
    const sorted = sortTedTalksForLearner(TED_CATALOG, { grade: 11, age: 16 });
    const riddle = indexOf(sorted, "prisoner_hat_riddle");
    const kahneman = indexOf(sorted, "kahneman");
    const harari = indexOf(sorted, "harari");
    expect(kahneman).toBeLessThan(riddle);
    expect(harari).toBeLessThan(riddle);
  });

  it("TL3 mature slug penalized for young learners", () => {
    const mature = talk({
      slug: "jon_ronson_strange_answers_to_the_psychopath_test",
      title: "Strange answers to the psychopath test",
      durationSec: 1068,
    });
    const grit = talk({
      slug: "angela_lee_duckworth_grit_the_power_of_passion_and_perseverance",
      title: "Grit",
      durationSec: 365,
    });
    const young = tedListFitScore(mature, { grade: 4, age: 9 });
    const teen = tedListFitScore(mature, { grade: 11, age: 16 });
    expect(young).toBeLessThan(tedListFitScore(grit, { grade: 4, age: 9 }));
    expect(young).toBeLessThan(teen);
  });

  it("TL4 sort never drops talks", () => {
    const sorted = sortTedTalksForLearner(TED_CATALOG, { grade: 7, age: 12 });
    const slugs = new Set(sorted.map((t) => t.slug));
    expect(slugs.size).toBe(TED_CATALOG.length);
    for (const t of TED_CATALOG) expect(slugs.has(t.slug)).toBe(true);
  });

  it("TL5 unknown short live hit ranks above 20min hit for G3", () => {
    const short = talk({
      slug: "fresh_unknown_short_talk",
      title: "A tiny idea",
      durationSec: 240,
    });
    const long = talk({
      slug: "fresh_unknown_long_talk",
      title: "A dense lecture",
      durationSec: 1200,
    });
    const sorted = sortTedTalksForLearner([long, short], { grade: 3, age: 8 });
    expect(sorted[0]?.slug).toBe(short.slug);
    expect(sorted[0]?.gradeMin).toBeDefined();
    expect(sorted[0]?.gradeMax).toBeDefined();
  });

  it("TL6 older-than-grade student lifts a slightly-harder talk", () => {
    const hard = talk({
      slug: "yuval_noah_harari_what_explains_the_rise_of_humans",
      title: "What explains the rise of humans?",
      durationSec: 1032,
    });
    const young = tedListFitScore(hard, { grade: 6, age: 11 });
    const older = tedListFitScore(hard, { grade: 6, age: 14 });
    expect(older).toBeGreaterThan(young);
  });
});
