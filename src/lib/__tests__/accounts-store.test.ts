import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  deleteServerAccount,
  mergeAccounts,
  readServerAccounts,
  readServerDeletedIds,
  writeServerAccounts,
} from "../accounts-store";
import type { AccountsStore } from "../student-profile";

let tmpDir: string;

function rec(id: string, updatedAt: number, name = `user_${id}`) {
  return {
    id,
    profile: { name, age: 9, grade: 4, gradeBand: "elementary", school: "", curriculum: null, preferredChinese: "yue", stronger: [], focusAreas: [] },
    createdAt: 1,
    updatedAt,
  } as AccountsStore["accounts"][number];
}

function store(activeId: string, accounts: AccountsStore["accounts"]): AccountsStore {
  return { version: 1, activeId, accounts };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "spark-accounts-"));
  process.env.SPARK_DATA_DIR = tmpDir;
});

afterEach(async () => {
  delete process.env.SPARK_DATA_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("accounts-store (server-side)", () => {
  it("readServerAccounts returns null when no file exists", async () => {
    const result = await readServerAccounts();
    expect(result).toBeNull();
  });

  it("writeServerAccounts + readServerAccounts round-trips", async () => {
    await writeServerAccounts(store("acct_ryan", [rec("acct_ryan", 1, "Ryan"), rec("acct_alice", 2, "Alice")]));
    const read = await readServerAccounts();
    expect(read).not.toBeNull();
    expect(read!.accounts.length).toBe(2);
    const names = read!.accounts.map((a) => a.profile.name).sort();
    expect(names).toEqual(["Alice", "Ryan"]);
  });

  it("mergeAccounts prefers the freshest version of a shared account", async () => {
    await writeServerAccounts(store("acct_ryan", [rec("acct_ryan", 100, "Ryan old")]));
    // A different device pushes an older copy of Ryan — must not win
    await writeServerAccounts(store("acct_ryan", [rec("acct_ryan", 50, "Ryan stale")]));
    const read = await readServerAccounts();
    expect(read!.accounts.find((a) => a.id === "acct_ryan")!.updatedAt).toBe(100);
    // A fresh copy does win
    await writeServerAccounts(store("acct_ryan", [rec("acct_ryan", 200, "Ryan fresh")]));
    const read2 = await readServerAccounts();
    expect(read2!.accounts.find((a) => a.id === "acct_ryan")!.updatedAt).toBe(200);
  });

  it("mergeAccounts keeps accounts the pusher didn't send", async () => {
    await writeServerAccounts(store("acct_ryan", [rec("acct_a", 100), rec("acct_b", 100)]));
    await writeServerAccounts(store("acct_ryan", [rec("acct_a", 150)]));
    const read = await readServerAccounts();
    expect(read!.accounts.map((a) => a.id).sort()).toEqual(["acct_a", "acct_b"]);
  });

  it("deleteServerAccount tombstones the id so it cannot be resurrected", async () => {
    await writeServerAccounts(store("acct_ryan", [rec("acct_ryan", 100, "Ryan"), rec("acct_gone", 100, "Gone")]));
    await deleteServerAccount("acct_gone");
    let read = await readServerAccounts();
    expect(read!.accounts.map((a) => a.id)).toEqual(["acct_ryan"]);
    expect(await readServerDeletedIds()).toEqual(["acct_gone"]);
    // A stale device tries to push the deleted account back
    await writeServerAccounts(store("acct_ryan", [rec("acct_gone", 500, "Gone")]));
    read = await readServerAccounts();
    expect(read!.accounts.map((a) => a.id)).toEqual(["acct_ryan"]);
  });

  it("mergeAccounts pure function merges both sides correctly", () => {
    const merged = mergeAccounts(
      store("acct_ryan", [rec("acct_a", 10), rec("acct_b", 20)]),
      store("acct_ryan", [rec("acct_a", 30), rec("acct_c", 40)]),
    );
    const ids = merged.accounts.map((a) => a.id).sort();
    expect(ids).toEqual(["acct_a", "acct_b", "acct_c"]);
    expect(merged.accounts.find((a) => a.id === "acct_a")!.updatedAt).toBe(30);
  });
});
