import { promises as fs } from "node:fs";
import path from "node:path";
import { lockedWriteJson } from "./file-lock";
import type { AccountsStore } from "./student-profile";

/**
 * Server-side durable accounts store (shared across browsers / devices).
 *
 * Data dir is lazily resolved so tests can inject an isolated directory via
 * SPARK_DATA_DIR without touching production data.
 */
function dataDir(): string {
  return process.env.SPARK_DATA_DIR
    ? path.resolve(process.env.SPARK_DATA_DIR)
    : path.join(process.cwd(), "data");
}
function accountsDir(): string {
  return path.join(dataDir(), "accounts");
}
function accountsFile(): string {
  return path.join(accountsDir(), "accounts.json");
}
function deletedFile(): string {
  return path.join(accountsDir(), "deleted.json");
}

/** Tombstoned account IDs — deleted on some device, never resurrected. */
async function readDeletedIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(deletedFile(), "utf8");
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function writeDeletedIds(ids: string[]): Promise<void> {
  await lockedWriteJson(deletedFile(), ids);
}

export async function readServerAccounts(): Promise<AccountsStore | null> {
  try {
    const raw = await fs.readFile(accountsFile(), "utf8");
    const parsed = JSON.parse(raw) as AccountsStore;
    if (parsed?.version === 1 && Array.isArray(parsed.accounts)) {
      const deleted = new Set(await readDeletedIds());
      return {
        ...parsed,
        accounts: parsed.accounts.filter((a) => !deleted.has(a.id)),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Tombstoned account IDs currently on the server (for client-side drop). */
export async function readServerDeletedIds(): Promise<string[]> {
  return readDeletedIds();
}

/** Permanently remove an account from the shared store (other devices drop it). */
export async function deleteServerAccount(accountId: string): Promise<void> {
  if (!accountId || typeof accountId !== "string") return;
  const deleted = await readDeletedIds();
  if (!deleted.includes(accountId)) {
    await writeDeletedIds([...deleted, accountId]);
  }
  const existing = await readServerAccounts();
  if (existing) {
    const next: AccountsStore = {
      ...existing,
      accounts: existing.accounts.filter((a) => a.id !== accountId),
    };
    await writeServerAccounts(next);
  }
}

export async function writeServerAccounts(store: AccountsStore): Promise<void> {
  // Tombstoned accounts are never resurrected — strip them from incoming.
  const deleted = new Set(await readDeletedIds());
  const sanitized: AccountsStore = {
    ...store,
    accounts: store.accounts.filter((a) => !deleted.has(a.id)),
  };
  const existing = await readServerAccounts();
  const merged = existing ? mergeAccounts(existing, sanitized) : sanitized;
  await lockedWriteJson(accountsFile(), merged);
}

/**
 * Merge a pushed store into the existing server store, preferring the freshest
 * version of each account (by updatedAt) and keeping accounts that the pusher
 * didn't send. This prevents a stale device from wiping server corrections
 * (last-write-wins full replacement would lose newer profiles).
 */
export function mergeAccounts(base: AccountsStore, incoming: AccountsStore): AccountsStore {
  const out = new Map<string, AccountsStore["accounts"][number]>();
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
