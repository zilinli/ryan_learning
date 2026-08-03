import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadMiniConsoleState, saveMiniConsoleState, clearMiniConsoleState, getConsoleSessionId, setConsoleSessionId } from "./mini-console-store";

const mockStore = new Map<string, string>();
const lsMock = {
  getItem: vi.fn((k: string) => mockStore.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { mockStore.set(k, v); }),
  removeItem: vi.fn((k: string) => { mockStore.delete(k); }),
};
vi.stubGlobal("localStorage", lsMock);

beforeEach(() => { mockStore.clear(); vi.clearAllMocks(); });

describe("mini-console-store", () => {
  describe("loadMiniConsoleState", () => {
    it("returns default when no state stored", () => {
      const s = loadMiniConsoleState();
      expect(s.open).toBe(false);
      expect(s.phase).toBe("idle");
    });
    it("returns stored state", () => {
      mockStore.set("spark.miniConsole", JSON.stringify({ open: true, sessionId: "cs_test", phase: "thinking", userMessage: "hi", agentMessage: "hey" }));
      const s = loadMiniConsoleState();
      expect(s.open).toBe(true);
      expect(s.sessionId).toBe("cs_test");
    });
  });

  describe("saveMiniConsoleState", () => {
    it("persists state", () => {
      saveMiniConsoleState({ open: true, sessionId: "abc", phase: "diff", userMessage: "fix", agentMessage: "done" });
      expect(localStorage.setItem).toHaveBeenCalledWith("spark.miniConsole", expect.stringContaining("abc"));
    });
  });

  describe("clearMiniConsoleState", () => {
    it("removes stored state", () => {
      mockStore.set("spark.miniConsole", "{}");
      clearMiniConsoleState();
      expect(mockStore.has("spark.miniConsole")).toBe(false);
    });
  });

  describe("sessionId", () => {
    it("getConsoleSessionId generates and caches", () => {
      const id1 = getConsoleSessionId();
      const id2 = getConsoleSessionId();
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^cs_\d+_[a-z0-9]+$/);
    });
    it("setConsoleSessionId overwrites", () => {
      setConsoleSessionId("cs_manual");
      expect(getConsoleSessionId()).toBe("cs_manual");
    });
  });
});
