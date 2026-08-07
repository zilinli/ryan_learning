import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  nsKey,
  TenantStorage,
  storageForAccount,
  FLAT_KEYS,
  migrationKey,
  isAccountMigrated,
  markMigrated,
  readFlatKey,
  RYAN_ACCOUNT,
} from "../tenant-storage";

// Provide a simple localStorage mock for the node environment
const store = new Map<string, string>();
const ls = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
  clear: () => { store.clear(); },
};
(globalThis as Record<string, unknown>).localStorage = ls;
(globalThis as Record<string, unknown>).window = {
  localStorage: ls,
};

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  store.clear();
});

describe("nsKey", () => {
  it("builds a namespaced key for an account and module", () => {
    expect(nsKey("acct_ryan", "memory")).toBe("spark.acct_ryan.memory.v1");
    expect(nsKey("acct_abc", "sessions")).toBe("spark.acct_abc.sessions.v1");
  });

  it("supports arbitrary module names", () => {
    expect(nsKey("acct_x", "custom")).toBe("spark.acct_x.custom.v1");
  });
});

describe("TenantStorage", () => {
  it("writes and reads namespaced values", () => {
    const storage = new TenantStorage("acct_test1");
    storage.set("memory", JSON.stringify({ hello: "world" }));
    expect(storage.get("memory")).toBe(JSON.stringify({ hello: "world" }));
  });

  it("isolates data between different accounts", () => {
    const acctA = new TenantStorage("acct_A");
    const acctB = new TenantStorage("acct_B");

    acctA.set("memory", '{"from":"A"}');
    acctB.set("memory", '{"from":"B"}');

    expect(acctA.get("memory")).toBe('{"from":"A"}');
    expect(acctB.get("memory")).toBe('{"from":"B"}');
  });

  it("same module, different accounts → separate keys", () => {
    const acctA = new TenantStorage("acct_A");
    const acctB = new TenantStorage("acct_B");

    acctA.set("engagement", '{"streak":3}');
    acctB.set("engagement", '{"streak":7}');

    // Verify separate localStorage keys exist
    const keyA = nsKey("acct_A", "engagement");
    const keyB = nsKey("acct_B", "engagement");
    expect(localStorage.getItem(keyA)).toBe('{"streak":3}');
    expect(localStorage.getItem(keyB)).toBe('{"streak":7}');
    expect(keyA).not.toBe(keyB);
  });

  it("returns null for missing keys", () => {
    const storage = new TenantStorage("acct_nonexistent");
    expect(storage.get("memory")).toBeNull();
    expect(storage.get("sessions")).toBeNull();
  });

  it("removes a namespaced key", () => {
    const storage = new TenantStorage("acct_test2");
    storage.set("memory", "data");
    expect(storage.get("memory")).toBe("data");
    storage.remove("memory");
    expect(storage.get("memory")).toBeNull();
  });

  it("clearAll removes all namespaced keys for the account", () => {
    const storage = new TenantStorage("acct_clear");
    storage.set("memory", "m");
    storage.set("sessions", "s");
    storage.set("engagement", "e");
    storage.set("migrated", "1");

    const removed = storage.clearAll();
    expect(removed.length).toBeGreaterThanOrEqual(4);

    expect(storage.get("memory")).toBeNull();
    expect(storage.get("sessions")).toBeNull();
    expect(storage.get("engagement")).toBeNull();
  });

  it("clearAll does not affect other accounts", () => {
    const acctA = new TenantStorage("acct_A");
    const acctB = new TenantStorage("acct_B");

    acctA.set("memory", "A");
    acctB.set("memory", "B");

    acctA.clearAll();

    expect(acctA.get("memory")).toBeNull();
    expect(acctB.get("memory")).toBe("B");
  });
});

describe("storageForAccount", () => {
  it("creates a TenantStorage for the given account", () => {
    const s = storageForAccount("acct_xyz");
    expect(s).toBeInstanceOf(TenantStorage);
    s.set("memory", "x");
    expect(s.get("memory")).toBe("x");
  });
});

describe("migration helpers", () => {
  it("migrationKey builds a sentinel key", () => {
    expect(migrationKey("acct_ryan")).toBe("spark.acct_ryan.migrated.v1");
  });

  it("isAccountMigrated returns false before migration", () => {
    expect(isAccountMigrated("acct_new")).toBe(false);
  });

  it("isAccountMigrated returns true after markMigrated", () => {
    markMigrated("acct_new");
    expect(isAccountMigrated("acct_new")).toBe(true);
  });
});

describe("FLAT_KEYS", () => {
  it("contains all expected flat keys", () => {
    expect(FLAT_KEYS.sessions).toBe("spark-tutor-sessions-v3");
    expect(FLAT_KEYS.memory).toBe("spark.learningMemory");
    expect(FLAT_KEYS.engagement).toBe("spark.engagement");
    expect(FLAT_KEYS.ttsVoice).toBe("spark.ttsVoice");
    expect(FLAT_KEYS.speakEnabled).toBe("spark.speakEnabled");
  });
});

describe("readFlatKey", () => {
  it("reads an existing flat key", () => {
    localStorage.setItem("spark.learningMemory", JSON.stringify({ test: true }));
    const result = readFlatKey("spark.learningMemory");
    expect(result).toBe(JSON.stringify({ test: true }));
  });

  it("returns null for non-existent flat key", () => {
    expect(readFlatKey("spark.nonexistent")).toBeNull();
  });
});

describe("migration round-trip", () => {
  it("write namespaced → reload → read back → data matches", () => {
    const storage = new TenantStorage("acct_roundtrip");
    const data = { skills: [{ id: "add", pKnown: 0.8 }], topics: [], updatedAt: Date.now() };
    storage.set("memory", JSON.stringify(data));

    const readBack = storage.get("memory");
    expect(readBack).toBe(JSON.stringify(data));

    const parsed = JSON.parse(readBack!);
    expect(parsed.skills[0].id).toBe("add");
    expect(parsed.skills[0].pKnown).toBe(0.8);
  });

  it("flat key → namespaced migration preserves data", () => {
    // Simulate migration: write flat key, then read into namespaced
    const flatData = { streak: 5, lastActiveDay: "2026-08-01" };
    localStorage.setItem(FLAT_KEYS.engagement, JSON.stringify(flatData));

    const flatRaw = readFlatKey(FLAT_KEYS.engagement);
    expect(flatRaw).toBe(JSON.stringify(flatData));

    // Migrate to namespaced
    const nsKeyVal = nsKey("acct_ryan", "engagement");
    localStorage.setItem(nsKeyVal, flatRaw!);

    // Verify namespaced key has the data
    expect(localStorage.getItem(nsKeyVal)).toBe(JSON.stringify(flatData));
    // Verify flat key still intact
    expect(localStorage.getItem(FLAT_KEYS.engagement)).toBe(JSON.stringify(flatData));
  });
});
