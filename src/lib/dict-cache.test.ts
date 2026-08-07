/** @vitest-environment node */

import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readFromCache, writeToCache } from "./dict-cache";

const CACHE_ROOT = path.join(process.cwd(), "data", "dict-cache");

describe("dict-cache", () => {
  afterAll(() => {
    try {
      fs.rmSync(CACHE_ROOT, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("writeToCache creates a cache file", () => {
    const data = { word: "hello", lang: "en" as const, entries: [] };
    writeToCache("mw", "en", "hello", data);
    const p = path.join(CACHE_ROOT, "mw", "en", "hello.json");
    expect(fs.existsSync(p)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    expect(raw.word).toBe("hello");
  });

  it("readFromCache returns cached data", () => {
    const data = { word: "world", lang: "en" as const, entries: [{ headword: "world", partOfSpeech: "noun", senses: [], source: "freedict" as const }] };
    writeToCache("freedict", "en", "world", data);
    const cached = readFromCache("freedict", "en", "world");
    expect(cached).not.toBeNull();
    expect(cached!.word).toBe("world");
  });

  it("readFromCache returns null for missing key", () => {
    expect(readFromCache("nonexistent", "en", "nonexistent")).toBeNull();
  });

  it("handles special characters and Chinese", () => {
    const data = { word: "你好", lang: "zh" as const, entries: [] };
    writeToCache("freedict", "zh", "你好", data);
    const cached = readFromCache("freedict", "zh", "你好");
    expect(cached).not.toBeNull();
  });

  it("handles invalid paths gracefully", () => {
    // Should not throw on invalid paths
    writeToCache("x", "en", "/", { word: "/", lang: "en" as const, entries: [] });
  });
});
