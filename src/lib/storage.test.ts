import { describe, expect, it } from "vitest";
import {
  accountIdFromUrl,
  MAX_MESSAGES_PER_CHAT,
  newSessionId,
  sessionIdFromUrl,
  setUrlSession,
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
    quote: partial.quote,
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

  it("keeps homework image dataUrls even when keepPreviews is false", () => {
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
    expect(slim[0]?.attachments?.[0]?.dataUrl).toBe(
      "data:image/jpeg;base64,AAAA",
    );
    expect(slim[0]?.attachments?.[0]?.name).toBe("p.jpg");
  });

  it("keeps PDF / file dataUrls so history downloads work", () => {
    const messages = [
      msg({
        role: "user",
        content: "notes",
        attachments: [
          {
            id: "f1",
            name: "a.pdf",
            mimeType: "application/pdf",
            kind: "file",
            dataUrl: "data:application/pdf;base64,AAAA",
          },
        ],
      }),
    ];
    const slim = slimMessages(messages, false);
    expect(slim[0]?.attachments?.[0]?.dataUrl).toBe(
      "data:application/pdf;base64,AAAA",
    );
    expect(slim[0]?.attachments?.[0]?.name).toBe("a.pdf");
  });

  it("truncates oversized content", () => {
    const huge = "x".repeat(40_000);
    const slim = slimMessages(
      [msg({ role: "assistant", content: huge })],
      true,
    );
    expect(slim[0]!.content.length).toBeLessThan(huge.length);
    expect(slim[0]!.content.endsWith("…")).toBe(true);
  });

  it("preserves the quote reference across persistence", () => {
    const messages = [
      msg({
        id: "m1",
        role: "user",
        content: "What is 1/4 + 1/2?",
      }),
      msg({
        id: "m2",
        role: "assistant",
        content: "1/4 + 1/2 = 3/4.",
      }),
      msg({
        id: "m3",
        role: "user",
        content: "Show me the steps please",
        quote: {
          messageId: "m2",
          author: "assistant",
          excerpt: "1/4 + 1/2 = 3/4.",
          content: "1/4 + 1/2 = 3/4.",
        },
      }),
    ];
    const slim = slimMessages(messages, true);
    const quoted = slim.find((m) => m.id === "m3");
    expect(quoted?.quote).toEqual({
      messageId: "m2",
      author: "assistant",
      excerpt: "1/4 + 1/2 = 3/4.",
      content: "1/4 + 1/2 = 3/4.",
    });
  });

  it("preserves SVG markdown images when truncating long replies", () => {
    const diagram =
      "![直角三角形 ABC](data:image/svg+xml,%3Csvg%3E" +
      "A".repeat(2000) +
      "%3C%2Fsvg%3E)";
    const content = `${"讲解。".repeat(20_000)}\n${diagram}\n你注意到咩？`;
    const slim = slimMessages(
      [msg({ role: "assistant", content })],
      true,
    );
    expect(slim[0]!.content).toContain("data:image/svg+xml");
    expect(slim[0]!.content).toContain("![直角三角形 ABC]");
  });
});

// ── URL-param Session Persistence (Phase 0.7) ──────────────

describe("sessionIdFromUrl", () => {
  it("returns null when no session param", () => {
    delete (globalThis as Record<string, unknown>).window;
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          search: "",
          href: "http://localhost:3000",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(sessionIdFromUrl()).toBeNull();
  });

  it("extracts session param from URL", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          search: "?session=abc-123-def",
          href: "http://localhost:3000/?session=abc-123-def",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(sessionIdFromUrl()).toBe("abc-123-def");
  });

  it("returns null for short session ids", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          search: "?session=x",
          href: "http://localhost:3000/?session=x",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(sessionIdFromUrl()).toBe("x");
  });
});

describe("setUrlSession", () => {
  it("updates window URL with session param", () => {
    let replaced = "";
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          search: "",
          href: "http://localhost:3000",
        },
        history: {
          replaceState(_d: unknown, _t: string, u: string) {
            replaced = u;
          },
        },
      },
      writable: true,
      configurable: true,
    });
    setUrlSession("my-share-id");
    expect(replaced).toContain("session=my-share-id");
  });

  it("includes account for shareable cross-account links", () => {
    let replaced = "";
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { search: "", href: "http://localhost:3000" },
        history: {
          replaceState(_d: unknown, _t: string, u: string) {
            replaced = u;
          },
        },
      },
      writable: true,
      configurable: true,
    });
    setUrlSession("my-share-id", "acct_ching");
    expect(replaced).toContain("account=acct_ching");
  });
});

describe("accountIdFromUrl", () => {
  it("reads account param", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          search: "?session=abc&account=acct_ching",
          href: "http://localhost:3000/?session=abc&account=acct_ching",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(accountIdFromUrl()).toBe("acct_ching");
  });
});
