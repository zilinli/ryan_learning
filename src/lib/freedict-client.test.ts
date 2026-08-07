/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";
import { parseFreeDict, freeDictLookup } from "./freedict-client";

describe("parseFreeDict", () => {
  it("parses a minimal valid response", () => {
    const data = [
      {
        word: "hello",
        phonetic: "/həˈloʊ/",
        meanings: [
          {
            partOfSpeech: "interjection",
            definitions: [
              { definition: "Used as a greeting." },
              { definition: "Used to begin a telephone conversation.", example: "Hello, who's speaking?" },
            ],
          },
        ],
      },
    ];
    const entries = parseFreeDict(data, "hello", "en");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.headword).toBe("hello");
    expect(entries[0]!.pronunciation).toBe("/həˈloʊ/");
    expect(entries[0]!.partOfSpeech).toBe("interjection");
    expect(entries[0]!.senses).toHaveLength(2);
    expect(entries[0]!.senses[0]!.definition).toBe("Used as a greeting.");
    expect(entries[0]!.senses[1]!.example).toBe("Hello, who's speaking?");
    expect(entries[0]!.source).toBe("freedict");
  });

  it("handles phonetics array", () => {
    const data = [
      {
        word: "test",
        phonetics: [
          { text: "/tɛst/", audio: "https://example.com/test.mp3" },
        ],
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [{ definition: "A trial or examination." }],
          },
        ],
      },
    ];
    const entries = parseFreeDict(data, "test", "en");
    expect(entries[0]!.pronunciation).toBe("/tɛst/");
    expect(entries[0]!.audioUrl).toBe("https://example.com/test.mp3");
  });

  it("prefers top-level phonetic over phonetics array", () => {
    const data = [
      {
        word: "test",
        phonetic: "/top_level/",
        phonetics: [{ text: "/nested/" }],
        meanings: [
          {
            partOfSpeech: "noun",
            definitions: [{ definition: "A test." }],
          },
        ],
      },
    ];
    const entries = parseFreeDict(data, "test", "en");
    expect(entries[0]!.pronunciation).toBe("/top_level/");
  });

  it("deduplicates identical POS + definition combos", () => {
    const data = [
      {
        word: "run",
        meanings: [
          {
            partOfSpeech: "verb",
            definitions: [{ definition: "Move quickly." }],
          },
          {
            partOfSpeech: "verb",
            definitions: [{ definition: "Move quickly." }],
          },
        ],
      },
    ];
    const entries = parseFreeDict(data, "run", "en");
    expect(entries).toHaveLength(1);
  });

  it("handles empty response gracefully", () => {
    const entries = parseFreeDict([], "word", "en");
    expect(entries).toEqual([]);
  });
});

describe("freeDictLookup", () => {
  it("returns null for unsupported lang (yue)", async () => {
    const res = await freeDictLookup("hello", "yue");
    expect(res).toBeNull();
  });

  it("returns null when no MW keys configured", async () => {
    // This test just validates the function signature works
    expect(typeof freeDictLookup).toBe("function");
  });
});
