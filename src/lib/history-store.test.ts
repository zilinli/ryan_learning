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
  it("sanitizeForServer strips attachment previews", () => {
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
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    });
    expect(clean.messages[0]?.attachments?.[0]?.dataUrl).toBeUndefined();
    expect(clean.messages[0]?.attachments?.[0]?.name).toBe("p.jpg");
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
});
