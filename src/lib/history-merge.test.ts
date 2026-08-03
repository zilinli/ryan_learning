import { describe, expect, it } from "vitest";
import { mergeConversationLists } from "./history-merge";
import type { ConversationRecord } from "./types";

function chat(
  id: string,
  updatedAt: number,
  content: string,
): ConversationRecord {
  return {
    sessionId: id,
    title: content.slice(0, 20) || "New chat",
    messages: content
      ? [
          {
            id: `m_${id}`,
            role: "user",
            content,
            createdAt: updatedAt,
          },
        ]
      : [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("mergeConversationLists", () => {
  it("unions local and remote chats", () => {
    const merged = mergeConversationLists(
      [chat("a", 100, "local only")],
      [chat("b", 200, "server only")],
      "a",
    );
    const ids = merged.conversations.map((c) => c.sessionId).sort();
    expect(ids).toEqual(["a", "b"]);
    expect(merged.activeId).toBe("a");
  });

  it("prefers the newer copy of the same session", () => {
    const merged = mergeConversationLists(
      [chat("x", 100, "old local")],
      [chat("x", 500, "fresh server")],
      "x",
    );
    expect(merged.conversations).toHaveLength(1);
    expect(merged.conversations[0]!.messages[0]!.content).toBe("fresh server");
  });

  it("lets a newer local override stale server", () => {
    const merged = mergeConversationLists(
      [chat("x", 900, "newer local")],
      [chat("x", 100, "old server")],
      "x",
    );
    expect(merged.conversations[0]!.messages[0]!.content).toBe("newer local");
  });

  it("keeps empty active draft while dropping other empties", () => {
    const emptyActive: ConversationRecord = {
      sessionId: "draft",
      title: "New chat",
      messages: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const merged = mergeConversationLists(
      [emptyActive],
      [chat("old", 50, "homework")],
      "draft",
    );
    expect(merged.activeId).toBe("draft");
    expect(merged.conversations.some((c) => c.sessionId === "draft")).toBe(
      true,
    );
    expect(merged.conversations.some((c) => c.sessionId === "old")).toBe(true);
  });

  it("restores local photo dataUrls when server copy is newer but stripped", () => {
    const local: ConversationRecord = {
      sessionId: "hw",
      title: "Homework",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "help",
          createdAt: 100,
          attachments: [
            {
              id: "a1",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              dataUrl: "data:image/jpeg;base64,LOCAL",
            },
          ],
        },
      ],
      createdAt: 100,
      updatedAt: 100,
    };
    const remote: ConversationRecord = {
      sessionId: "hw",
      title: "Homework",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "help",
          createdAt: 100,
          attachments: [
            {
              id: "a1",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
            },
          ],
        },
        {
          id: "m2",
          role: "assistant",
          content: "What do you notice?",
          createdAt: 200,
        },
      ],
      createdAt: 100,
      updatedAt: 200,
    };
    const merged = mergeConversationLists([local], [remote], "hw");
    const att = merged.conversations[0]?.messages[0]?.attachments?.[0];
    expect(att?.dataUrl).toBe("data:image/jpeg;base64,LOCAL");
    expect(merged.conversations[0]?.messages).toHaveLength(2);
  });
});
