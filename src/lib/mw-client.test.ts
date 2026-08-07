/** @vitest-environment node */

import { describe, expect, it } from "vitest";
import { parseMwCollegiate, parseMwSpanish } from "./mw-client";

describe("parseMwCollegiate", () => {
  const sampleEntry = {
    meta: { id: "hello:1", uuid: "abc", stems: ["hello"] },
    hwi: { hw: "hel*lo", prs: [{ mw: "hə-ˈlō", sound: { audio: "hello001" } }] },
    fl: "interjection",
    shortdef: ["Used as a greeting"],
    date: "before 12th century",
  };

  it("parses a basic collegiate entry", () => {
    const entries = parseMwCollegiate([sampleEntry], "hello");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.headword).toBe("hello");
    expect(entries[0]!.pronunciation).toBe("hə-ˈlō");
    expect(entries[0]!.partOfSpeech).toBe("interjection");
    expect(entries[0]!.senses).toHaveLength(1);
    expect(entries[0]!.senses[0]!.definition).toBe("Used as a greeting");
    expect(entries[0]!.source).toBe("merriam-webster");
  });

  it("generates correct audio URL", () => {
    const entries = parseMwCollegiate([sampleEntry], "hello");
    expect(entries[0]!.audioUrl).toContain("media.merriam-webster.com");
    expect(entries[0]!.audioUrl).toContain("hello001.mp3");
  });

  it("strips asterisks from headword", () => {
    const entry = { ...sampleEntry, hwi: { hw: "dic*tio*nary", prs: [] } };
    const entries = parseMwCollegiate([entry], "dictionary");
    expect(entries[0]!.headword).toBe("dictionary");
  });

  it("filters out suggestion strings", () => {
    const mixed = [sampleEntry, "suggestion" as unknown as never, sampleEntry];
    const entries = parseMwCollegiate(mixed, "hello");
    expect(entries).toHaveLength(2);
  });
});

describe("parseMwSpanish", () => {
  const sampleEntry = {
    meta: { id: "hola", uuid: "def" },
    src: "español",
    hwi: { hw: "hola", prs: [{ mw: "ˈō-lä", sound: { audio: "ses00001" } }] },
    fl: "interjección",
    shortdef: ["hello"],
  };

  it("parses Spanish-English entry", () => {
    const entries = parseMwSpanish([sampleEntry], "hola");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.headword).toBe("hola");
    expect(entries[0]!.senses[0]!.definition).toBe("hello");
    expect(entries[0]!.senses[0]!.translations![0]!.text).toBe("hello");
  });

  it("generates Spanish audio URL", () => {
    const entries = parseMwSpanish([sampleEntry], "hola");
    expect(entries[0]!.audioUrl).toContain("/es/me/mp3/");
  });
});
