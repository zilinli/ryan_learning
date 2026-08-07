/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  enrichDictResponse,
  localTranslate,
  needsTranslationEnrichment,
  primaryGloss,
  translateFallbackLookup,
} from "./dict-translate";
import type { DictResponse } from "./dict-types";

describe("dict-translate helpers", () => {
  it("primaryGloss takes the first clause", () => {
    expect(primaryGloss("hello, hi")).toBe("hello");
    expect(primaryGloss("to eat / learning")).toBe("to eat");
  });

  it("localTranslate maps ES/FR seeds to English", () => {
    expect(localTranslate("hola", "es", "en")?.toLowerCase()).toContain("hello");
    expect(localTranslate("bonjour", "fr", "en")?.toLowerCase()).toMatch(/hello|good/);
  });

  it("localTranslate maps English to other languages", () => {
    expect(localTranslate("hello", "en", "es")?.toLowerCase()).toBe("hola");
    expect(localTranslate("hello", "en", "fr")?.toLowerCase()).toBe("bonjour");
    expect(localTranslate("water", "en", "zh")).toBe("水");
    expect(localTranslate("water", "en", "yue")).toBe("水");
  });
});

describe("enrichDictResponse", () => {
  it("adds EN/ES/FR/ZH/Yue cross translations for English lookups", async () => {
    const input: DictResponse = {
      word: "hello",
      lang: "en",
      entries: [
        {
          headword: "hello",
          partOfSpeech: "interjection",
          senses: [{ definition: "Used as a greeting." }],
          source: "freedict",
        },
      ],
    };
    expect(needsTranslationEnrichment(input)).toBe(true);
    const out = await enrichDictResponse(input);
    expect(out.crossTranslations?.length).toBeGreaterThanOrEqual(3);
    const langs = new Set(out.crossTranslations!.map((t) => t.lang));
    expect(langs.has("es")).toBe(true);
    expect(langs.has("fr")).toBe(true);
    expect(out.entries[0]!.senses[0]!.translations?.some((t) => t.lang === "es")).toBe(
      true,
    );
    expect(needsTranslationEnrichment(out)).toBe(false);
  });

  it("adds English translation for Spanish lookups", async () => {
    const input: DictResponse = {
      word: "hola",
      lang: "es",
      entries: [
        {
          headword: "hola",
          partOfSpeech: "interjection",
          senses: [{ definition: "hello, hi" }],
          source: "freedict",
        },
      ],
    };
    const out = await enrichDictResponse(input);
    expect(out.crossTranslations?.some((t) => t.lang === "en")).toBe(true);
    expect(out.crossTranslations![0]!.text.toLowerCase()).toContain("hello");
  });
});

describe("translateFallbackLookup", () => {
  it("skips English (FreeDict covers it)", async () => {
    expect(await translateFallbackLookup("window", "en")).toBeNull();
  });

  it("builds an ES entry for standard vocabulary outside seeds", async () => {
    const out = await translateFallbackLookup("ventana", "es");
    expect(out).not.toBeNull();
    expect(out!.entries.length).toBeGreaterThan(0);
    expect(out!.entries[0]!.source).toBe("translate");
    expect(out!.crossTranslations?.[0]?.lang).toBe("en");
    expect(out!.crossTranslations?.[0]?.text.toLowerCase()).toMatch(/window/);
  }, 15_000);

  it("builds a FR entry for standard vocabulary outside seeds", async () => {
    const out = await translateFallbackLookup("fenêtre", "fr");
    expect(out).not.toBeNull();
    expect(out!.crossTranslations?.[0]?.text.toLowerCase()).toMatch(/window/);
  }, 15_000);

  it("builds a ZH entry for standard vocabulary outside seeds", async () => {
    const out = await translateFallbackLookup("窗户", "zh");
    expect(out).not.toBeNull();
    expect(out!.crossTranslations?.[0]?.text.toLowerCase()).toMatch(/window/);
  }, 15_000);
});
