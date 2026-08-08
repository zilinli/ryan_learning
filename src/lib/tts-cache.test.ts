import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCachedTts,
  pruneTtsCache,
  setCachedTts,
  ttsCacheDir,
  ttsCacheKey,
  ttsCachePath,
  ttsCacheStats,
} from "./tts-cache";

let tmpDir: string;
const OLD_ENV = { ...process.env };

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "tts-cache-test-"));
  process.env.SPARK_DATA_DIR = tmpDir;
});

afterEach(async () => {
  process.env = { ...OLD_ENV };
  await rm(tmpDir, { recursive: true, force: true });
});

describe("ttsCacheKey / ttsCachePath", () => {
  it("is stable for same text+voice and differs on change", () => {
    const a = ttsCacheKey("你好世界", "zh-HK-WanLungNeural");
    const b = ttsCacheKey("你好世界", "zh-HK-WanLungNeural");
    const c = ttsCacheKey("你好世界", "en-GB-RyanNeural");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("scopes the cache under the injected data dir", () => {
    const p = ttsCachePath("hi", "v");
    expect(p.startsWith(path.join(tmpDir, "tts-cache"))).toBe(true);
  });
});

describe("setCachedTts / getCachedTts", () => {
  it("round-trips audio through the cache", async () => {
    const audio = Buffer.alloc(200, 0x44);
    audio[0] = 0x49;
    audio[1] = 0x44;
    audio[2] = 0x33;
    await setCachedTts("你好", "zh-HK-WanLungNeural", audio);
    const got = await getCachedTts("你好", "zh-HK-WanLungNeural");
    expect(got).not.toBeNull();
    expect(Buffer.compare(got!, audio)).toBe(0);
  });

  it("returns null for a miss", async () => {
    expect(await getCachedTts("nope", "nope")).toBeNull();
  });

  it("refuses to cache tiny/invalid audio", async () => {
    await setCachedTts("你好", "v", Buffer.from([1, 2, 3]));
    expect(await getCachedTts("你好", "v")).toBeNull();
  });

  it("creates the cache dir on demand", async () => {
    expect(await fs.readdir(ttsCacheDir()).catch(() => null)).toBeNull();
    await setCachedTts("a", "b", Buffer.alloc(200, 1));
    const entries = await fs.readdir(ttsCacheDir());
    expect(entries.length).toBe(1);
  });
});

describe("pruneTtsCache", () => {
  async function writeCache(text: string, voice: string, size: number): Promise<void> {
    const data = Buffer.alloc(size, 0x61);
    await setCachedTts(text, voice, data);
  }

  it("deletes oldest files first when over maxBytes", async () => {
    await writeCache("one", "v1", 300);
    await writeCache("two", "v2", 300);
    await writeCache("three", "v3", 300);

    // Make "one" the oldest
    const files = await fs.readdir(ttsCacheDir());
    expect(files.length).toBe(3);
    await new Promise((r) => setTimeout(r, 20));
    await writeCache("four", "v4", 300); // 4th file, newest
    await new Promise((r) => setTimeout(r, 20));
    await writeCache("five", "v5", 300); // 5th file, newest

    const result = await pruneTtsCache({ maxBytes: 900, maxAgeMs: 0 });
    expect(result.files).toBeGreaterThan(0);

    const stats = await ttsCacheStats();
    expect(stats.bytes).toBeLessThanOrEqual(900);
    expect(stats.files).toBe(3);
  });

  it("deletes files older than maxAgeMs", async () => {
    await writeCache("old", "v1", 100);
    await new Promise((r) => setTimeout(r, 30));
    await writeCache("new", "v2", 100);
    const result = await pruneTtsCache({ maxBytes: 0, maxAgeMs: 10 });
    expect(result.files).toBe(1);
    const remaining = await fs.readdir(ttsCacheDir());
    expect(remaining.length).toBe(1);
    // "new" was written after "old" → survives
    expect(await getCachedTts("new", "v2")).not.toBeNull();
  });

  it("keeps everything when under limits", async () => {
    await writeCache("a", "v1", 150);
    await writeCache("b", "v2", 150);
    const result = await pruneTtsCache({ maxBytes: 10_000, maxAgeMs: 0 });
    expect(result.files).toBe(0);
    expect(result.kept).toBe(2);
  });

  it("is a no-op when cache dir is missing", async () => {
    const result = await pruneTtsCache({ maxBytes: 1, maxAgeMs: 0 });
    expect(result.files).toBe(0);
    expect(result.kept).toBe(0);
  });
});

describe("ttsCacheStats", () => {
  it("reports zeros when cache dir missing", async () => {
    expect(await ttsCacheStats()).toEqual({ bytes: 0, files: 0 });
  });

  it("reports total bytes and count", async () => {
    await setCachedTts("a", "b", Buffer.alloc(150, 1));
    await setCachedTts("c", "d", Buffer.alloc(100, 1));
    const stats = await ttsCacheStats();
    expect(stats.files).toBe(2);
    expect(stats.bytes).toBe(250);
  });
});
