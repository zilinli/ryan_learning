/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  buildSentenceTranslatePrompt,
  parseSentenceTranslateJson,
} from "./dict-sentence";

describe("buildSentenceTranslatePrompt", () => {
  it("asks for JSON and names the target language", () => {
    const p = buildSentenceTranslatePrompt({
      text: "Hola, ¿cómo estás?",
      from: "es",
      to: "en",
      hasImages: false,
    });
    expect(p).toContain("Spanish");
    expect(p).toContain("English");
    expect(p).toContain("Hola");
    expect(p).toContain('"translation"');
  });

  it("mentions photos when attached", () => {
    const p = buildSentenceTranslatePrompt({
      text: "",
      from: "auto",
      to: "zh",
      hasImages: true,
    });
    expect(p).toMatch(/photo/i);
    expect(p).toMatch(/Auto-detect|Detect the source/i);
  });

  it("names dialect target languages", () => {
    const teo = buildSentenceTranslatePrompt({
      text: "hello",
      from: "en",
      to: "teo",
      hasImages: false,
    });
    expect(teo).toMatch(/Hokkien/);

    const hak = buildSentenceTranslatePrompt({
      text: "hello",
      from: "en",
      to: "hak",
      hasImages: false,
    });
    expect(hak).toMatch(/Hakka/);
  });
});

describe("parseSentenceTranslateJson", () => {
  it("parses clean JSON", () => {
    const out = parseSentenceTranslateJson(
      JSON.stringify({
        detectedSourceLang: "es",
        sourceText: "Hola",
        translation: "Hello",
        notes: "",
      }),
      "es",
      "en",
    );
    expect(out?.translation).toBe("Hello");
    expect(out?.sourceText).toBe("Hola");
    expect(out?.to).toBe("en");
  });

  it("parses fenced JSON", () => {
    const out = parseSentenceTranslateJson(
      'Here you go:\n```json\n{"sourceText":"Bonjour","translation":"你好","detectedSourceLang":"fr"}\n```\n',
      "auto",
      "zh",
    );
    expect(out?.translation).toBe("你好");
    expect(out?.detectedSourceLang).toBe("fr");
  });

  it("returns null for empty garbage", () => {
    expect(parseSentenceTranslateJson("", "auto", "en")).toBeNull();
  });
});
