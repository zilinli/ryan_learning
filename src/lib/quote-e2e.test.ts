import { describe, expect, it, beforeEach } from "vitest";
import { saveConversations, loadConversations } from "./storage";
import { RYAN_ACCOUNT } from "./tenant-storage";

class FakeStorage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe("client quote persistence e2e", () => {
  beforeEach(() => {
    const fake = new FakeStorage();
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    Object.defineProperty(globalThis, "window", { value: { location: { search: "" } }, configurable: true });
  });

  it("saveConversations → loadConversations keeps quote", () => {
    const store = loadConversations(RYAN_ACCOUNT);
    const activeId = store.activeId;
    const now = Date.now();
    const conv = {
      sessionId: activeId,
      title: "t",
      messages: [
        { id: "m0", role: "assistant", content: "1/4 + 1/2 = 3/4.", createdAt: now },
        {
          id: "m1",
          role: "user",
          content: "Show steps",
          createdAt: now + 1,
          quote: {
            messageId: "m0",
            author: "assistant",
            excerpt: "1/4 + 1/2 = 3/4.",
            content: "1/4 + 1/2 = 3/4.",
          },
        },
      ],
      createdAt: now,
      updatedAt: now + 1,
    };
    const nextStore = { ...store, activeId, conversations: [conv] };
    saveConversations(nextStore, RYAN_ACCOUNT);
    const loaded = loadConversations(RYAN_ACCOUNT);
    const m1 = loaded.conversations.find(c => c.sessionId === activeId)?.messages.find(m => m.id === "m1");
    console.log("LOADED m1 quote:", JSON.stringify(m1?.quote));
    expect(m1?.quote?.messageId).toBe("m0");
  });
});
