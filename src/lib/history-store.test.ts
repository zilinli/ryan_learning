import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  deleteServerConversation,
  getServerConversation,
  listServerConversations,
  sanitizeForServer,
  upsertServerConversation,
} from "./history-store";

describe("history-store server persistence", () => {
  it("sanitizeForServer strips base64 but keeps mediaId", () => {
    const clean = sanitizeForServer({
      sessionId: "abc123",
      title: "t",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "photo",
          createdAt: 1,
          attachments: [
            {
              id: "a1",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              dataUrl: "data:image/jpeg;base64,AAAA",
              mediaId: "sess_abc",
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    });
    expect(clean.messages[0]?.attachments?.[0]?.dataUrl).toBeUndefined();
    expect(clean.messages[0]?.attachments?.[0]?.mediaId).toBe("sess_abc");
    expect(clean.messages[0]?.attachments?.[0]?.name).toBe("p.jpg");
  });

  it("sanitizeForServer preserves the quote reference", () => {
    const clean = sanitizeForServer({
      sessionId: "abc123",
      title: "t",
      messages: [
        {
          id: "m2",
          role: "user",
          content: "Please explain the steps",
          createdAt: 2,
          quote: {
            messageId: "m1",
            author: "assistant",
            excerpt: "1/4 + 1/2 = 3/4.",
            content: "1/4 + 1/2 = 3/4.",
            attachments: [
              {
                name: "work.jpg",
                mimeType: "image/jpeg",
                kind: "image",
                data: "QUJD",
              },
            ],
          },
        },
      ],
      createdAt: 1,
      updatedAt: 3,
    });
    const quoted = clean.messages.find((m) => m.id === "m2");
    expect(quoted?.quote?.messageId).toBe("m1");
    expect(quoted?.quote?.author).toBe("assistant");
    expect(quoted?.quote?.excerpt).toBe("1/4 + 1/2 = 3/4.");
    // Heavy payload stripped for storage; reference stays intact
    expect(quoted?.quote?.attachments?.[0]?.data).toBeUndefined();
    expect(quoted?.quote?.attachments?.[0]?.name).toBe("work.jpg");
  });

  it("round-trips conversations through the data directory", async () => {
    const id = `ut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const file = path.join(
      process.cwd(),
      "data",
      "conversations",
      `${id}.json`,
    );
    try {
      const saved = await upsertServerConversation({
        sessionId: id,
        title: "Fractions",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "Help with fractions",
            createdAt: Date.now(),
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      expect(saved?.sessionId).toBe(id);
      const got = await getServerConversation(id);
      expect(got?.title).toContain("Fractions");
      const list = await listServerConversations();
      expect(list.some((c) => c.sessionId === id)).toBe(true);
      expect(await deleteServerConversation(id)).toBe(true);
      expect(await getServerConversation(id)).toBeNull();
    } finally {
      await rm(file, { force: true }).catch(() => undefined);
    }
  });

  it("rejects empty chats and unsafe ids", async () => {
    expect(
      await upsertServerConversation({
        sessionId: "../evil",
        title: "x",
        messages: [
          { id: "1", role: "user", content: "hi", createdAt: 1 },
        ],
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toBeNull();
    expect(
      await upsertServerConversation({
        sessionId: "okid",
        title: "empty",
        messages: [],
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toBeNull();
  });

  it("still cleans media if conversation json is already gone", async () => {
    const id = `orphan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved = await upsertServerConversation({
      sessionId: id,
      title: "gone json",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "photo",
          createdAt: 1,
          attachments: [
            {
              id: "a1",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              dataUrl:
                "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    const mediaId = saved?.messages[0]?.attachments?.[0]?.mediaId;
    expect(mediaId).toBeTruthy();
    const file = path.join(
      process.cwd(),
      "data",
      "conversations",
      `${id}.json`,
    );
    await rm(file, { force: true });
    expect(await deleteServerConversation(id)).toBe(true);
    const { readMedia } = await import("./media-store");
    expect(await readMedia(mediaId!)).toBeNull();
  });

  it("keeps mediaId when a client push overwrites a chat whose media was already written", async () => {
    const id = `keeps_media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    try {
      // 1) /api/chat path: server writes the video and records a mediaId.
      const first = await upsertServerConversation({
        sessionId: id,
        title: "video",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "watch this",
            createdAt: now,
            attachments: [
              {
                id: "a1",
                name: "clip.mov",
                mimeType: "video/quicktime",
                kind: "file",
                dataUrl: "data:video/quicktime;base64," + "A".repeat(2048),
              },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
      const mediaId = first?.messages[0]?.attachments?.[0]?.mediaId;
      expect(mediaId).toBeTruthy();
      const { mediaExists } = await import("./media-store");
      expect(await mediaExists(mediaId!)).toBe(true);

      // 2) Client pushStoreToServer path: localStorage copy has NO dataUrl and
      //    NO mediaId (videos carry only raw base64 client-side). A newer
      //    updatedAt simulates the push landing after /api/chat finished.
      const pushed = await upsertServerConversation({
        sessionId: id,
        title: "video",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "watch this",
            createdAt: now,
            attachments: [
              { id: "a1", name: "clip.mov", mimeType: "video/quicktime", kind: "file" },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now + 5000,
      });
      // The mediaId must survive the overwrite, and the media file must remain.
      expect(pushed?.messages[0]?.attachments?.[0]?.mediaId).toBe(mediaId);
      const got = await getServerConversation(id);
      expect(got?.messages[0]?.attachments?.[0]?.mediaId).toBe(mediaId);
      expect(await mediaExists(mediaId!)).toBe(true);
    } finally {
      await deleteServerConversation(id).catch(() => undefined);
    }
  });

  it("keeps an existing mediaId when a push carries no data (client degrades gracefully if file missing)", async () => {
    const id = `keep_mediaid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    try {
      const pushed = await upsertServerConversation({
        sessionId: id,
        title: "orphan",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "hi",
            createdAt: now,
            attachments: [
              {
                id: "a1",
                name: "x.mov",
                mimeType: "video/quicktime",
                kind: "file",
                mediaId: "fake_session_00000000000000000000",
              },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
      // A mediaId that is present (even without a backing file) is kept as-is;
      // the client shows an unavailable chip instead of a broken element.
      expect(pushed?.messages[0]?.attachments?.[0]?.mediaId).toBe(
        "fake_session_00000000000000000000",
      );
    } finally {
      await deleteServerConversation(id).catch(() => undefined);
    }
  });
});
