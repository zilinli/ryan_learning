/**
 * Tiny key-value store: localStorage when available, else in-memory (Node tests).
 */

const memory = new Map<string, string>();

export function kvGet(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // private mode / blocked
  }
  return memory.get(key) ?? null;
}

export function kvSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // fall through to memory
  }
  memory.set(key, value);
}

export function kvRemove(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  memory.delete(key);
}

/** Test helper — wipe memory map (and optional localStorage keys). */
export function kvClearMemory(): void {
  memory.clear();
}
