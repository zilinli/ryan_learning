import { describe, it, expect, afterAll } from "vitest";
import { readDeletionLog, writeTombstone, getDeletionLogTTL, isTombstoned } from "./deletion-log";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "deletions");
const AID = "_test_deletion_sync";

afterAll(async () => {
  try {
    await fs.unlink(path.join(DIR, `${AID}.json`));
  } catch {}
});

describe("deletion-log", () => {
  it("returns empty for unknown account", async () => {
    const log = await readDeletionLog("nonexistent_xyz_123");
    expect(log).toEqual({});
  });

  it("writes and reads tombstone", async () => {
    await writeTombstone("sess_abc", AID);
    const log = await readDeletionLog(AID);
    expect(log["sess_abc"]).toBeTypeOf("number");
    expect(Date.now() - log["sess_abc"]).toBeLessThan(5000);
  });

  it("multiple tombstones coexist", async () => {
    await writeTombstone("sess_xyz", AID);
    const log = await readDeletionLog(AID);
    expect(log["sess_abc"]).toBeDefined();
    expect(log["sess_xyz"]).toBeDefined();
  });

  it("TTL is 30 days", () => {
    expect(getDeletionLogTTL()).toBe(30 * 86400 * 1000);
  });

  it("prunes expired entries (manual time)", async () => {
    const manualPath = path.join(DIR, `${AID}.json`);
    const old = Date.now() - 31 * 86400 * 1000; // 31 days ago
    const log = { old_sess: old, fresh_sess: Date.now() };
    await fs.writeFile(manualPath, JSON.stringify(log), "utf-8");
    const result = await readDeletionLog(AID);
    expect(result["old_sess"]).toBeUndefined();
    expect(result["fresh_sess"]).toBeDefined();
  });

  it("isTombstoned — fresh tombstone is active", async () => {
    await writeTombstone("sess_active", AID);
    const log = await readDeletionLog(AID);
    expect(isTombstoned(log, "sess_active")).toBe(true);
  });

  it("isTombstoned — expired tombstone is ignored", () => {
    const old = Date.now() - 31 * 86400 * 1000;
    expect(isTombstoned({ old_sess: old }, "old_sess")).toBe(false);
  });

  it("isTombstoned — missing session is not tombstoned", () => {
    expect(isTombstoned({}, "nope")).toBe(false);
  });
});
