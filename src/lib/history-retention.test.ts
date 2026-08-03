import { describe, expect, it } from "vitest";
import {
  countMessages,
  enforceHistoryRetention,
  makeSearchSnippet,
  pruneConversationsByMessageBudget,
  searchConversations,
} from "./history-retention";
import type { ConversationRecord } from "./types";

function chat(
  id: string,
  updatedAt: number,
  messages: string[],
  title?: string,
): ConversationRecord {
  return {
    sessionId: id,
    title: title || messages[0]?.slice(0, 20) || "New chat",
    messages: messages.map((content, i) => ({
      id: `${id}_${i}`,
      role: i % 2 ? "assistant" : "user",
      content,
      createdAt: updatedAt + i,
    })),
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("searchConversations", () => {
  const data = [
    chat("a", 300, ["Help with fractions please", "Try one half"], "Fractions"),
    chat("b", 200, ["Reading comprehension river", "Look at paragraph 2"], "Reading"),
    chat("c", 100, ["Hola, matemáticas"], "Español"),
  ];

  it("returns all when query empty", () => {
    expect(searchConversations(data, "  ")).toHaveLength(3);
  });

  it("matches title and message body", () => {
    const byTitle = searchConversations(data, "Fractions");
    expect(byTitle.map((h) => h.conversation.sessionId)).toEqual(["a"]);
    expect(byTitle[0]?.matchedTitle).toBe(true);

    const byBody = searchConversations(data, "paragraph");
    expect(byBody).toHaveLength(1);
    expect(byBody[0]?.conversation.sessionId).toBe("b");
    expect(byBody[0]?.snippet?.toLowerCase()).toContain("paragraph");
  });

  it("supports multi-token AND search", () => {
    const hits = searchConversations(data, "help fractions");
    expect(hits.map((h) => h.conversation.sessionId)).toEqual(["a"]);
    expect(searchConversations(data, "help river")).toHaveLength(0);
  });
});

describe("makeSearchSnippet", () => {
  it("centers around the match", () => {
    const snip = makeSearchSnippet(
      "AAAA look at the river carefully BBBB",
      "river",
      8,
    );
    expect(snip.toLowerCase()).toContain("river");
    expect(snip.startsWith("…") || snip.includes("look")).toBe(true);
  });
});

describe("pruneConversationsByMessageBudget", () => {
  it("keeps newest chats within message budget", () => {
    const list = [
      chat("old", 1, ["m1", "m2", "m3"]),
      chat("mid", 50, ["a", "b"]),
      chat("new", 100, ["x", "y", "z", "w"]),
    ];
    expect(countMessages(list)).toBe(9);
    const kept = pruneConversationsByMessageBudget(list, 5);
    expect(countMessages(kept)).toBeLessThanOrEqual(5);
    expect(kept[0]?.sessionId).toBe("new");
    expect(kept.some((c) => c.sessionId === "old")).toBe(false);
  });

  it("trims messages inside a chat when needed", () => {
    const big = chat(
      "huge",
      10,
      Array.from({ length: 20 }, (_, i) => `msg ${i}`),
    );
    const kept = pruneConversationsByMessageBudget([big], 5);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.messages).toHaveLength(5);
    expect(kept[0]!.messages[0]!.content).toBe("msg 15");
  });

  it("enforceHistoryRetention combines budgets", () => {
    const list = Array.from({ length: 30 }, (_, i) =>
      chat(`c${i}`, i, [`hello ${i}`, `world ${i}`]),
    );
    const kept = enforceHistoryRetention(list, {
      maxMessages: 10,
      maxBytes: 48 * 1024 * 1024,
    });
    expect(countMessages(kept)).toBeLessThanOrEqual(10);
  });
});
