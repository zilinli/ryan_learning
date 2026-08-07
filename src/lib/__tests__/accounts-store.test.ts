import { describe, it, expect, afterAll } from "vitest";
import { readServerAccounts, writeServerAccounts } from "../accounts-store";
import type { AccountsStore } from "../student-profile";
import fs from "node:fs/promises";
import path from "node:path";

const ACCOUNTS_FILE = path.join(process.cwd(), "data", "accounts", "accounts.json");

const RYAN = {
  id: "acct_ryan",
  profile: { name: "Ryan", grade: 5 },
  createdAt: 1,
  updatedAt: 1,
} as AccountsStore["accounts"][number];

const ALICE = {
  id: "acct_alice",
  profile: { name: "Alice", grade: 3 },
  createdAt: 2,
  updatedAt: 2,
} as AccountsStore["accounts"][number];

describe("accounts-store (server-side)", () => {
  // Clean up test data after all tests
  afterAll(async () => {
    try { await fs.unlink(ACCOUNTS_FILE); } catch { /* ok */ }
  });

  it("readServerAccounts returns null when no file exists", async () => {
    // Clean up first in case a previous run left a file
    try { await fs.unlink(ACCOUNTS_FILE); } catch { /* ok */ }
    const result = await readServerAccounts();
    expect(result).toBeNull();
  });

  it("writeServerAccounts + readServerAccounts round-trips", async () => {
    const store: AccountsStore = {
      version: 1,
      activeId: "acct_ryan",
      accounts: [RYAN, ALICE],
    };

    await writeServerAccounts(store);
    const read = await readServerAccounts();
    expect(read).not.toBeNull();
    expect(read!.accounts.length).toBe(2);
    const names = read!.accounts.map((a) => a.profile.name).sort();
    expect(names).toEqual(["Alice", "Ryan"]);
  });
});
