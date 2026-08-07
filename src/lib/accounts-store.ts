import { promises as fs } from "node:fs";
import path from "node:path";
import { lockedWriteJson } from "./file-lock";
import type { AccountsStore } from "./student-profile";

/** Server-side durable accounts store (shared across browsers / devices). */
const BASE_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_DIR = path.join(BASE_DIR, "accounts");
const ACCOUNTS_FILE = path.join(ACCOUNTS_DIR, "accounts.json");

export async function readServerAccounts(): Promise<AccountsStore | null> {
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as AccountsStore;
    if (parsed?.version === 1 && Array.isArray(parsed.accounts)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function writeServerAccounts(store: AccountsStore): Promise<void> {
  await lockedWriteJson(ACCOUNTS_FILE, store);
}
