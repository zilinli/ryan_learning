import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGES_PER_CHAT,
  newSessionId,
  slimMessages,
  titleFromMessages,
} from "./storage";
import type { ChatMessage } from "./types";

function msg(
  partial: Partial<ChatMessage> & Pick<ChatMessage, "role" | "content">,
): ChatMessage {
  return {
    id: partial.id || `m_${Math.random().toString(36).slice(2, 8)}`,
    role: partial.role,
    content: partial.content,
    createdAt: partial.createdAt ?? Date.now(),
    attachments: partial.attachments,
    image: partial.image,
  };
}

describe("newSessionId / titleFromMessages", () => {
  it("creates non-trivial session ids", () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toBe(b);
  });

  it("titles from first user text, else homework, else New chat", () => {
    expect(
      titleFromMessages([
        msg({ role: "assistant", content: "Hi" }),
        msg({ role: "user", content: "  Fractions help please  " }),
      ]),
    ).toBe("Fractions help please");

    expect(
      titleFromMessages([
        msg({
          role: "user",
          content: "",
          attachments: [
            {
              id: "a1",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
            },
          ],
        }),
      ]),
    ).toBe("Homework photos");

    expect(titleFromMessages([])).toBe("New chat");
  });

  it("truncates long titles with ellipsis", () => {
    const long = "A".repeat(80);
    const title = titleFromMessages([msg({ role: "user", content: long })]);
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(42);
  });
});

describe("slimMessages", () => {
  it("keeps only the latest MAX_MESSAGES_PER_CHAT", () => {
    const messages = Array.from({ length: MAX_MESSAGES_PER_CHAT + 25 }, (_, i) =>
      msg({ id: `m${i}`, role: i % 2 ? "assistant" : "user", content: `c${i}` }),
    );
    const slim = slimMessages(messages, true);
    expect(slim).toHaveLength(MAX_MESSAGES_PER_CHAT);
    expect(slim[0]?.id).toBe(`m${25}`);
  });

  it("strips attachment previews when keepPreviews is false", () => {
    const messages = [
      msg({
        role: "user",
        content: "photo",
        attachments: [
          {
            id: "a1",
            name: "p.jpg",
            mimeType: "image/jpeg",
            kind: "image",
            dataUrl: "data:image/jpeg;base64,AAAA",
          },
        ],
      }),
    ];
    const slim = slimMessages(messages, false);
    expect(slim[0]?.attachments?.[0]?.dataUrl).toBeUndefined();
    expect(slim[0]?.attachments?.[0]?.name).toBe("p.jpg");
  });

  it("truncates oversized content", () => {
    const huge = "x".repeat(7000);
    const slim = slimMessages(
      [msg({ role: "assistant", content: huge })],
      true,
    );
    expect(slim[0]!.content.length).toBeLessThan(huge.length);
    expect(slim[0]!.content.endsWith("…")).toBe(true);
  });
});
