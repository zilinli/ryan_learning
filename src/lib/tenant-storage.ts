/**
 * Tenant-scoped localStorage wrapper.
 *
 * All per-account data follows: spark.{accountId}.{module}.v1
 * Shared (cross-tenant) keys bypass the prefix and use a flat key.
 *
 * Key design:
 * - No login/auth — accounts are local identifiers on the device
 * - Migration is additive: flat keys are never deleted, only read + copied
 * - This module has NO imports from student-profile to avoid circular deps
 */

export const RYAN_ACCOUNT = "acct_ryan";

/** Build a namespaced localStorage key for a given account + module. */
export function nsKey(accountId: string, module: string): string {
  return `spark.${accountId}.${module}.v1`;
}

/** Flat keys used before migration — read source, never delete. */
export const FLAT_KEYS = {
  sessions: "spark-tutor-sessions-v3",
  memory: "spark.learningMemory",
  engagement: "spark.engagement",
  ttsVoice: "spark.ttsVoice",
  speakEnabled: "spark.speakEnabled",
} as const;

/** Migration sentinel: once set, load paths prefer namespaced key. */
export function migrationKey(accountId: string): string {
  return nsKey(accountId, "migrated");
}

/**
 * TenantStorage — thin wrapper around localStorage with account-scoped keys.
 */
export class TenantStorage {
  constructor(private readonly accountId: string) {}

  get(module: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(nsKey(this.accountId, module));
    } catch {
      return null;
    }
  }

  set(module: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(nsKey(this.accountId, module), value);
    } catch {
      // quota
    }
  }

  remove(module: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(nsKey(this.accountId, module));
    } catch {
      // ignore
    }
  }

  /** Clear ALL namespaced keys for this account (account deletion). */
  clearAll(): string[] {
    if (typeof window === "undefined") return [];
    const modules = [
      "sessions", "memory", "engagement", "ttsVoice",
      "speakEnabled", "migrated", "profile",
    ];
    const removed: string[] = [];
    for (const mod of modules) {
      try {
        const key = nsKey(this.accountId, mod);
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed.push(key);
        }
      } catch {
        // ignore
      }
    }
    return removed;
  }
}

export function storageForAccount(accountId: string = RYAN_ACCOUNT): TenantStorage {
  return new TenantStorage(accountId);
}

/** Detect if migration has already been applied for an account. */
export function isAccountMigrated(accountId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(migrationKey(accountId)) === "1";
  } catch {
    return false;
  }
}

/** Mark an account as migrated. */
export function markMigrated(accountId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(migrationKey(accountId), "1");
  } catch {
    // ignore
  }
}

/**
 * Read a flat legacy key (used as fallback during migration).
 * Returns null if the key doesn't exist.
 */
export function readFlatKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
