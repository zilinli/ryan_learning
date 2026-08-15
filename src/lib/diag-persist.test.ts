import { describe, it, expect } from "vitest";
import { hydrateUserMessageMedia } from "./attachments";
import { writeMediaFromDataUrl, mediaExists } from "./media-store";
import { mkdirSync } from "node:fs";
import path from "node:path";

describe("diag video persist path", () => {
  it("writes video/quicktime dataUrl to disk", async () => {
    const userMsg: any = {
      id: "diag-msg-1",
      role: "user",
      content: "diag video",
      createdAt: Date.now(),
      attachments: [
        { id: "diag-att-1", name: "IMG_DIAG.mov", mimeType: "video/quicktime", kind: "file" },
      ],
    };
    const wireAtts = [
      {
        name: "IMG_DIAG.mov",
        mimeType: "video/quicktime",
        kind: "file",
        data: Buffer.from("DIAGNOSTIC-VIDEO-BYTES").toString("base64"),
      },
    ];
    const hydrated = hydrateUserMessageMedia(userMsg, wireAtts);
    expect(hydrated.attachments?.[0]?.dataUrl).toMatch(/^data:video\/quicktime;base64,/);
    console.log("hydrated dataUrl len:", hydrated.attachments?.[0]?.dataUrl?.length);

    const mediaId = "diag-test_" + Math.random().toString(36).slice(2, 10);
    mkdirSync(path.join(process.cwd(), "data", "media"), { recursive: true });
    const res = await writeMediaFromDataUrl(
      mediaId,
      hydrated.attachments![0].dataUrl!,
      "video/quicktime",
      {
        sessionId: "diag-session",
        messageId: "diag-msg-1",
        attachmentId: "diag-att-1",
        name: "IMG_DIAG.mov",
        kind: "file",
        accountId: "acct_diag",
      },
    );
    console.log("write result:", res ? `ok bytes=${res.bytes}` : "NULL");
    expect(res?.bytes).toBeGreaterThan(0);
    expect(await mediaExists(mediaId)).toBe(true);
  });
});
