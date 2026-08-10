import { promises as fs } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendDialectFeedback } from "./dialect-feedback";

describe("dialect-feedback store", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "spark-dialect-fb-"));
    process.env.SPARK_DATA_DIR = tmpDir;
  });

  afterAll(async () => {
    delete process.env.SPARK_DATA_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("appends one JSON line per record", async () => {
    await appendDialectFeedback({
      text: "这句唔係好自然",
      dialect: "hak",
      timestamp: 12345,
      engine: "bailian",
      original: "这句不好自然",
    });
    await appendDialectFeedback({
      text: "这句话唔系好自然",
      dialect: "teo",
      timestamp: 67890,
      engine: "local",
      original: "这句话不好自然",
    });

    const raw = await fs.readFile(
      path.join(tmpDir, "dialect-feedback.jsonl"),
      "utf8",
    );
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]!) as {
      text: string;
      dialect: string;
      timestamp: number;
      engine?: string;
      original?: string;
    };
    expect(first).toEqual({
      text: "这句唔係好自然",
      dialect: "hak",
      timestamp: 12345,
      engine: "bailian",
      original: "这句不好自然",
    });

    const second = JSON.parse(lines[1]!) as {
      text: string;
      dialect: string;
      timestamp: number;
      engine?: string;
      original?: string;
    };
    expect(second).toEqual({
      text: "这句话唔系好自然",
      dialect: "teo",
      timestamp: 67890,
      engine: "local",
      original: "这句话不好自然",
    });
  });

  it("normalizes invalid dialect to teo and missing timestamp to now", async () => {
    const before = Date.now();
    await appendDialectFeedback({
      text: "  你好  ",
      dialect: "other" as "teo" | "hak",
      timestamp: Number.NaN,
    });
    const raw = await fs.readFile(
      path.join(tmpDir, "dialect-feedback.jsonl"),
      "utf8",
    );
    const line = raw.trim().split("\n").at(-1)!;
    const entry = JSON.parse(line) as {
      text: string;
      dialect: string;
      timestamp: number;
    };
    expect(entry.text).toBe("你好");
    expect(entry.dialect).toBe("teo");
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
  });

  it("throws on empty text", async () => {
    await expect(
      appendDialectFeedback({
        text: "   ",
        dialect: "teo",
        timestamp: 1,
      }),
    ).rejects.toThrow(/empty/);
  });

  it("persists engine field when provided", async () => {
    await appendDialectFeedback({
      text: "engine test",
      dialect: "teo",
      timestamp: 1,
      engine: "iflytek",
    });
    const raw = await fs.readFile(
      path.join(tmpDir, "dialect-feedback.jsonl"),
      "utf8",
    );
    const line = raw.trim().split("\n").at(-1)!;
    const entry = JSON.parse(line) as { engine?: string };
    expect(entry.engine).toBe("iflytek");
  });

  it("persists original field when provided", async () => {
    await appendDialectFeedback({
      text: "corrected form",
      dialect: "hak",
      timestamp: 2,
      original: "raw form",
    });
    const raw = await fs.readFile(
      path.join(tmpDir, "dialect-feedback.jsonl"),
      "utf8",
    );
    const line = raw.trim().split("\n").at(-1)!;
    const entry = JSON.parse(line) as { original?: string };
    expect(entry.original).toBe("raw form");
  });

  it("omits engine/original from JSON when not provided", async () => {
    await appendDialectFeedback({
      text: "plain record",
      dialect: "teo",
      timestamp: 3,
    });
    const raw = await fs.readFile(
      path.join(tmpDir, "dialect-feedback.jsonl"),
      "utf8",
    );
    const line = raw.trim().split("\n").at(-1)!;
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry).not.toHaveProperty("engine");
    expect(entry).not.toHaveProperty("original");
    expect(entry.text).toBe("plain record");
  });
});
