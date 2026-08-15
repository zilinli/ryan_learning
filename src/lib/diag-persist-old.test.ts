import { describe, it, expect } from "vitest";
import { writeMediaFromDataUrl, mediaExists } from "./media-store";
import { mkdirSync } from "node:fs";
import path from "node:path";

describe("diag old-format video", () => {
  it("persists a legacy userMsg dataUrl that is a bare data URL", async () => {
    const b64 = Buffer.from("OLD-FORMAT-VIDEO-BYTES-0123456789").toString("base64");
    const dataUrl = `data:video/quicktime;base64,${b64}`;
    const mediaId = "diag-old_" + Math.random().toString(36).slice(2, 10);
    mkdirSync(path.join(process.cwd(), "data", "media"), { recursive: true });
    const res = await writeMediaFromDataUrl(mediaId, dataUrl, "video/quicktime", {
      sessionId: "diag-session",
      messageId: "diag-old-msg",
      attachmentId: "diag-old-att",
      name: "IMG_OLD.mov",
      kind: "file",
      accountId: "acct_diag",
    });
    console.log("write result:", res ? `ok bytes=${res.bytes}` : "NULL");
    expect(res?.bytes).toBeGreaterThan(0);
    expect(await mediaExists(mediaId)).toBe(true);
  });

  it("persists when dataUrl is missing but wire data exists via full chat record path", async () => {
    // Simulate the FULL server upsert path exactly like /api/chat does:
    // userMsg attachments have NO dataUrl; wire attachments carry `data`.
    const { hydrateUserMessageMedia } = await import("./attachments");
    const { upsertServerConversation, getServerConversation } = await import("./history-store");
    const userMsg: any = {
      id: `diag-full-msg-${Date.now()}`,
      role: "user",
      content: "full path",
      createdAt: Date.now(),
      attachments: [
        { id: "diag-full-att", name: "IMG_FULL.mov", mimeType: "video/quicktime", kind: "file" },
      ],
    };
    const wire = [
      {
        name: "IMG_FULL.mov",
        mimeType: "video/quicktime",
        kind: "file",
        data: Buffer.from("FULL-PATH-VIDEO-BYTES-abcdef").toString("base64"),
      },
    ];
    const hydrated = hydrateUserMessageMedia(userMsg, wire);
    expect(hydrated.attachments?.[0]?.dataUrl).toMatch(/^data:video\/quicktime;base64,/);
    const sessionId = `diag-full-${Date.now()}`;
    const accountId = "acct_diag_full";
    const saved = await upsertServerConversation(
      {
        sessionId,
        title: "full",
        messages: [hydrated],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      accountId,
    );
    const att = saved?.messages?.find((m) => m.role === "user")?.attachments?.[0];
    console.log("saved mediaId:", att?.mediaId, "| exists:", att?.mediaId ? await mediaExists(att.mediaId) : "n/a");
    expect(att?.mediaId).toBeTruthy();
    expect(await mediaExists(att!.mediaId!)).toBe(true);
    // cleanup
    const fs = await import("node:fs");
    fs.rmSync(path.join(process.cwd(), "data", "history", accountId, `${sessionId}.json`), { force: true });
  });
});
