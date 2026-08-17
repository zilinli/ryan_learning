/** @vitest-environment node */

import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getUsageSummary,
  readUsage,
  recordUsage,
} from "./usage-store";

const ORIGINAL_ENV = { ...process.env };
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-store-"));
  process.env.SPARK_DATA_DIR = tmpDir;
});

describe("usage-store", () => {
  it("starts empty", async () => {
    expect(await readUsage()).toEqual([]);
    const s = await getUsageSummary();
    expect(s.allTime.totals.turns).toBe(0);
    expect(s.byAccount).toEqual([]);
  });

  it("records and rolls up per-account usage", async () => {
    await recordUsage({
      accountId: "acct_ryan",
      inputChars: 400,
      outputChars: 400,
    });
    await recordUsage({
      accountId: "acct_ryan",
      inputChars: 400,
      outputChars: 400,
    });
    await recordUsage({
      accountId: "acct_sis",
      inputChars: 800,
      outputChars: 200,
    });

    const s = await getUsageSummary();
    expect(s.allTime.totals.turns).toBe(3);
    expect(s.allTime.totals.costUsd).toBeGreaterThan(0);

    const ryan = s.byAccount.find((a) => a.accountId === "acct_ryan");
    expect(ryan?.turns).toBe(2);
    expect(ryan?.inputTokens).toBe(200); // 800 chars / 4
    expect(ryan?.outputTokens).toBe(200);

    const sis = s.byAccount.find((a) => a.accountId === "acct_sis");
    expect(sis?.turns).toBe(1);
    expect(sis?.inputTokens).toBe(200);
    expect(sis?.outputTokens).toBe(50);
  });

  it("sanitizes account ids", async () => {
    await recordUsage({
      accountId: "weird/../path\x00!",
      inputChars: 100,
      outputChars: 100,
    });
    const records = await readUsage();
    expect(records[0].accountId).toBe("weird/../path!");
  });
});
