import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadMiniConsoleState, saveMiniConsoleState, clearMiniConsoleState,
  getConsoleSessionId, setConsoleSessionId,
  loadCodeAgentPanelContext, saveCodeAgentPanelContext, clearCodeAgentPanelContext,
} from "./mini-console-store";
const mockStore = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: vi.fn((k: string) => mockStore.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { mockStore.set(k, v); }),
  removeItem: vi.fn((k: string) => { mockStore.delete(k); }),
});
beforeEach(() => { mockStore.clear(); });
describe("mini-console-store", () => {
  it("loadMiniConsoleState returns default when empty", () => {
    const s = loadMiniConsoleState();
    expect(s.open).toBe(false);
    expect(s.phase).toBe("idle");
  });
  it("loadMiniConsoleState returns stored state", () => {
    mockStore.set("spark.miniConsole", JSON.stringify({ open: true, sessionId: "cs_test", phase: "thinking", userMessage: "hi", agentMessage: "hey" }));
    const s = loadMiniConsoleState();
    expect(s.open).toBe(true);
    expect(s.sessionId).toBe("cs_test");
  });
  it("saveMiniConsoleState persists", () => {
    saveMiniConsoleState({ open: true, sessionId: "abc", phase: "diff", userMessage: "fix", agentMessage: "done" });
    expect(mockStore.get("spark.miniConsole")).toContain("abc");
  });
  it("clearMiniConsoleState removes", () => {
    mockStore.set("spark.miniConsole", "{}");
    clearMiniConsoleState();
    expect(mockStore.has("spark.miniConsole")).toBe(false);
  });
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
  it("save/load CodeAgentPanelContext with runId", () => {
    saveCodeAgentPanelContext({
      sessionId: "cs_1",
      phase: "thinking",
      messages: [{ id: "cm_1", role: "user", content: "hi", createdAt: 1 }],
      runId: "cr_abc",
      streamingContent: "partial",
      updatedAt: 0,
    });
    const loaded = loadCodeAgentPanelContext();
    expect(loaded.sessionId).toBe("cs_1");
    expect(loaded.phase).toBe("thinking");
    expect(loaded.runId).toBe("cr_abc");
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.streamingContent).toBe("partial");
    clearCodeAgentPanelContext();
    expect(loadCodeAgentPanelContext().sessionId).toBe("");
  });
});
