import { describe, expect, it } from "vitest";
import {
  attachmentsOf,
  buildQuoteFromMessage,
  clipQuoteText,
  quoteAttachmentsToPayload,
  resolveQuoteForSend,
  slimQuote,
  QUOTE_CONTENT_MAX,
  QUOTE_EXCERPT_MAX,
} from "./quote";
import type { ChatMessage } from "./types";

describe("clipQuoteText", () => {
  it("collapses whitespace and clips to max", () => {
    expect(clipQuoteText("  hello \n world  ", 20)).toBe("hello world");
    expect(clipQuoteText("a".repeat(100), 10)).toHaveLength(10);
  });
});

describe("buildQuoteFromMessage", () => {
  it("quotes user text with a snippet", () => {
    const m: ChatMessage = {
      id: "m1",
      role: "user",
      content: "How do I add fractions with unlike denominators?",
      createdAt: 1,
    };
    const q = buildQuoteFromMessage(m);
    expect(q.messageId).toBe("m1");
    expect(q.author).toBe("user");
    expect(q.excerpt).toContain("add fractions");
  });

  it("quotes assistant message", () => {
    const m: ChatMessage = {
      id: "m2",
      role: "assistant",
      content: "Find the same-size pieces first.",
      createdAt: 1,
    };
    expect(buildQuoteFromMessage(m).author).toBe("assistant");
  });

  it("falls back to a photo label for image-only messages", () => {
    const m: ChatMessage = {
      id: "m3",
      role: "user",
      content: "",
      attachments: [
        {
          id: "a1",
          name: "homework.jpg",
          mimeType: "image/jpeg",
          kind: "image",
          dataUrl: "data:image/jpeg;base64,AAAA",
        },
      ],
      createdAt: 1,
    };
    expect(buildQuoteFromMessage(m).excerpt).toBe("1 photo");
  });

  it("includes a thumbnail dataUrl when the quoted message has an image", () => {
    const m: ChatMessage = {
      id: "m5",
      role: "assistant",
      content: "Here is the diagram",
      attachments: [
        {
          id: "a1",
          name: "diagram.png",
          mimeType: "image/png",
          kind: "image",
          dataUrl: "data:image/png;base64,QUJD",
        },
      ],
      createdAt: 1,
    };
    const q = buildQuoteFromMessage(m);
    expect(q.thumbnail).toBe("data:image/png;base64,QUJD");
  });

  it("omits thumbnail for text-only messages", () => {
    const m: ChatMessage = {
      id: "m6",
      role: "user",
      content: "Just a question",
      createdAt: 1,
    };
    expect(buildQuoteFromMessage(m).thumbnail).toBeUndefined();
  });
});

describe("attachmentsOf", () => {
  it("reads legacy image fallback", () => {
    const m: ChatMessage = {
      id: "m4",
      role: "user",
      content: "",
      image: { dataUrl: "data:image/jpeg;base64,AAAA", mimeType: "image/jpeg" },
      createdAt: 1,
    };
    expect(attachmentsOf(m)).toHaveLength(1);
    expect(attachmentsOf(m)[0]?.kind).toBe("image");
  });
});

describe("quoteAttachmentsToPayload", () => {
  it("sends images as raw base64 data", () => {
    const payload = quoteAttachmentsToPayload([
      {
        id: "a1",
        name: "p.jpg",
        mimeType: "image/jpeg",
        kind: "image",
        dataUrl: "data:image/jpeg;base64,QUJD",
      },
    ]);
    expect(payload[0]?.data).toBe("QUJD");
    expect(payload[0]?.dataUrl).toBeUndefined();
  });

  it("keeps text documents as charset data URL", () => {
    const payload = quoteAttachmentsToPayload([
      {
        id: "a2",
        name: "notes.md",
        mimeType: "text/markdown",
        kind: "file",
        dataUrl: "data:text/markdown;charset=utf-8,hello",
      },
    ]);
    expect(payload[0]?.dataUrl).toContain("hello");
    expect(payload[0]?.data).toBeUndefined();
  });

  it("preserves mediaId", () => {
    const payload = quoteAttachmentsToPayload([
      {
        id: "a3",
        name: "doc.pdf",
        mimeType: "application/pdf",
        kind: "file",
        mediaId: "med-1",
      },
    ]);
    expect(payload[0]?.mediaId).toBe("med-1");
  });
});

describe("slimQuote", () => {
  it("keeps the reference and excerpt, strips heavy attachment payloads", () => {
    const slim = slimQuote({
      messageId: "m9",
      author: "user",
      excerpt: "How do I add fractions?",
      content: "How do I add fractions with unlike denominators?",
      attachments: [
        {
          name: "work.jpg",
          mimeType: "image/jpeg",
          kind: "image",
          data: "QUJD",
          dataUrl: "data:image/jpeg;base64,QUJD",
          textContent: "extracted text",
        },
        {
          name: "doc.pdf",
          mimeType: "application/pdf",
          kind: "file",
          mediaId: "med-1",
        },
      ],
    });
    expect(slim.messageId).toBe("m9");
    expect(slim.author).toBe("user");
    expect(slim.excerpt).toBe("How do I add fractions?");
    expect(slim.content).toBe("How do I add fractions with unlike denominators?");
    expect(slim.attachments).toEqual([
      { name: "work.jpg", mimeType: "image/jpeg", kind: "image" },
      { name: "doc.pdf", mimeType: "application/pdf", kind: "file", mediaId: "med-1" },
    ]);
  });

  it("clips content to the send cap", () => {
    const long = "y".repeat(QUOTE_CONTENT_MAX + 500);
    const slim = slimQuote({
      messageId: "m9",
      author: "user",
      excerpt: "hi",
      content: long,
    });
    expect(slim.content).toHaveLength(QUOTE_CONTENT_MAX);
  });
});

describe("resolveQuoteForSend", () => {
  const messages: ChatMessage[] = [
    {
      id: "m10",
      role: "assistant",
      content: "First find a common denominator.",
      attachments: [
        {
          id: "a1",
          name: "diagram.jpg",
          mimeType: "image/jpeg",
          kind: "image",
          dataUrl: "data:image/jpeg;base64,QUJD",
        },
      ],
      createdAt: 1,
    },
  ];

  it("attaches full text + attachments from the quoted message", () => {
    const q = buildQuoteFromMessage(messages[0]!);
    const resolved = resolveQuoteForSend(q, messages);
    expect(resolved.content).toContain("common denominator");
    expect(resolved.attachments).toHaveLength(1);
    expect(resolved.attachments?.[0]?.data).toBe("QUJD");
  });

  it("clips full content to QUOTE_CONTENT_MAX", () => {
    const long: ChatMessage = {
      id: "m11",
      role: "user",
      content: "x".repeat(QUOTE_CONTENT_MAX + 500),
      createdAt: 1,
    };
    const resolved = resolveQuoteForSend(buildQuoteFromMessage(long), [long]);
    expect(resolved.content).toHaveLength(QUOTE_CONTENT_MAX);
  });

  it("returns the original quote when the message is missing", () => {
    const q = { messageId: "gone", author: "user" as const, excerpt: "hi" };
    expect(resolveQuoteForSend(q, messages)).toBe(q);
  });

  it("does not exceed the excerpt cap", () => {
    const long: ChatMessage = {
      id: "m12",
      role: "user",
      content: "y".repeat(QUOTE_EXCERPT_MAX + 100),
      createdAt: 1,
    };
    expect(buildQuoteFromMessage(long).excerpt).toHaveLength(QUOTE_EXCERPT_MAX);
  });
});
