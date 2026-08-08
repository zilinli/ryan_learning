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
  const existing = await readServerAccounts();
  const merged = existing ? mergeAccounts(existing, store) : store;
  await lockedWriteJson(ACCOUNTS_FILE, merged);
}

/**
 * Merge a pushed store into the existing server store, preferring the freshest
 * version of each account (by updatedAt) and keeping accounts that the pusher
 * didn't send. This prevents a stale device from wiping server corrections
 * (last-write-wins full replacement would lose newer profiles).
 */
function mergeAccounts(base: AccountsStore, incoming: AccountsStore): AccountsStore {
  const out = new Map<string, AccountRecord>();
  for (const a of base.accounts) out.set(a.id, a);
  for (const a of incoming.accounts) {
    const existing = out.get(a.id);
    if (!existing || (a.updatedAt || 0) > (existing.updatedAt || 0)) {
      out.set(a.id, a);
    }
  }
  return {
    version: 1,
    activeId: incoming.activeId || base.activeId,
    accounts: [...out.values()],
  };
}
