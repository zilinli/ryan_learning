import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearParentPin,
  hasParentPin,
  isParentSessionUnlocked,
  lockParentSession,
  saveParentPin,
  unlockParentSession,
  verifyParentPin,
} from "./parent-pin";

describe("parent-pin", () => {
  const store: Record<string, string> = {};
  const session: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    for (const k of Object.keys(session)) delete session[k];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => session[k] ?? null,
      setItem: (k: string, v: string) => {
        session[k] = v;
      },
      removeItem: (k: string) => {
        delete session[k];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and verifies PIN; session unlock is separate", () => {
    expect(hasParentPin()).toBe(false);
    saveParentPin("1234");
    expect(hasParentPin()).toBe(true);
    expect(verifyParentPin("1234")).toBe(true);
    expect(verifyParentPin("0000")).toBe(false);
    unlockParentSession();
    expect(isParentSessionUnlocked()).toBe(true);
    lockParentSession();
    expect(isParentSessionUnlocked()).toBe(false);
    expect(hasParentPin()).toBe(true);
    clearParentPin();
    expect(hasParentPin()).toBe(false);
  });
});
