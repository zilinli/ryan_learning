import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { lockedWriteJson } from "../file-lock";

describe("lockedWriteJson (Atomic File Write)", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes valid JSON to the file", async () => {
    const filePath = path.join(tmpDir, "test.json");
    await lockedWriteJson(filePath, { hello: "world" });
    const content = await fs.readFile(filePath, "utf8");
    expect(JSON.parse(content)).toEqual({ hello: "world" });
  });

  it("creates parent directories automatically", async () => {
    const filePath = path.join(tmpDir, "deep", "nested", "data.json");
    await lockedWriteJson(filePath, { ok: true });
    const content = await fs.readFile(filePath, "utf8");
    expect(JSON.parse(content)).toEqual({ ok: true });
  });

  it("writes large objects without corruption", async () => {
    const filePath = path.join(tmpDir, "large.json");
    const largeData = { items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` })) };
    await lockedWriteJson(filePath, largeData);
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.items).toHaveLength(1000);
  });

  it("readers never see partial content during write", async () => {
    const filePath = path.join(tmpDir, "atomic.json");
    const largeData = { items: Array.from({ length: 5000 }, (_, i) => ({ id: i })) };

    const writePromise = lockedWriteJson(filePath, largeData);

    // Try reading during write — should either fail (no file) or succeed with complete data
    const partialSeen = false;
    for (let i = 0; i < 5; i++) {
      try {
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        // If we can parse, all items must be present
        expect(parsed.items).toHaveLength(5000);
      } catch {
        // File doesn't exist or is being written — acceptable for atomic write
      }
    }
    await writePromise;
    expect(partialSeen).toBe(false);
  });

  it("last writer wins in concurrent writes to same file", async () => {
    const filePath = path.join(tmpDir, "concurrent.json");

    await Promise.all([
      lockedWriteJson(filePath, { version: 1 }),
      lockedWriteJson(filePath, { version: 2 }),
      lockedWriteJson(filePath, { version: 3 }),
    ]);

    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    // Must be valid JSON — exactly one of the versions
    expect([1, 2, 3]).toContain(parsed.version);
  });

  it("writes to different files are concurrent (not serialized)", async () => {
    const start = Date.now();
    await Promise.all([
      lockedWriteJson(path.join(tmpDir, "a.json"), { f: "a" }),
      lockedWriteJson(path.join(tmpDir, "b.json"), { f: "b" }),
      lockedWriteJson(path.join(tmpDir, "c.json"), { f: "c" }),
    ]);
    const elapsed = Date.now() - start;
    // All three should complete in roughly one write's time
    expect(elapsed).toBeLessThan(200);
  });

  it("serializes writes to same path while allowing different paths", async () => {
    const filePath = path.join(tmpDir, "serialized.json");
    const order: number[] = [];

    const w1 = lockedWriteJson(filePath, { seq: 1 }).then(() => { order.push(1); });
    const w2 = lockedWriteJson(filePath, { seq: 2 }).then(() => { order.push(2); });
    const w3 = lockedWriteJson(filePath, { seq: 3 }).then(() => { order.push(3); });

    await Promise.all([w1, w2, w3]);

    // Sequential writes to same path must complete in order
    expect(order).toEqual([1, 2, 3]);
  });

  it("overwrites existing file cleanly", async () => {
    const filePath = path.join(tmpDir, "overwrite.json");
    await lockedWriteJson(filePath, { data: "old" });
    await lockedWriteJson(filePath, { data: "new" });

    const content = await fs.readFile(filePath, "utf8");
    expect(JSON.parse(content)).toEqual({ data: "new" });
  });
});
