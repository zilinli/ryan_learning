import { describe, it, expect } from "vitest";
import { hydrateUserMessageMedia } from "./attachments";
import type { ChatMessage, ChatAttachmentPayload } from "./types";

function userMsg(attachments?: ChatMessage["attachments"]): ChatMessage {
  return {
    id: "m1",
    role: "user",
    content: "watch this",
    createdAt: 1234,
    ...(attachments ? { attachments } : {}),
  };
}

describe("hydrateUserMessageMedia", () => {
  it("rebuilds a dataUrl for a video sent as raw base64 data", () => {
    const wire: ChatAttachmentPayload[] = [
      {
        name: "clip.mp4",
        mimeType: "video/mp4",
        kind: "file",
        data: "VklERU8=",
      },
    ];
    const m = userMsg([
      { id: "a1", name: "clip.mp4", mimeType: "video/mp4", kind: "file" },
    ]);
    const out = hydrateUserMessageMedia(m, wire);
    expect(out.attachments?.[0]?.dataUrl).toBe(
      "data:video/mp4;base64,VklERU8=",
    );
    // Original untouched
    expect(m.attachments?.[0]?.dataUrl).toBeUndefined();
  });

  it("keeps existing dataUrl attachments unchanged", () => {
    const wire: ChatAttachmentPayload[] = [
      { name: "photo.jpg", mimeType: "image/jpeg", kind: "image", data: "AAA=" },
    ];
    const m = userMsg([
      {
        id: "a1",
        name: "photo.jpg",
        mimeType: "image/jpeg",
        kind: "image",
        dataUrl: "data:image/jpeg;base64,ALREADY",
      },
    ]);
    const out = hydrateUserMessageMedia(m, wire);
    expect(out.attachments?.[0]?.dataUrl).toBe(
      "data:image/jpeg;base64,ALREADY",
    );
  });

  it("leaves attachments without a matching wire payload untouched", () => {
    const m = userMsg([
      { id: "a1", name: "missing.mp4", mimeType: "video/mp4", kind: "file" },
    ]);
    const out = hydrateUserMessageMedia(m, []);
    expect(out.attachments?.[0]?.dataUrl).toBeUndefined();
    // Same reference — no-op for unhydratable messages.
    expect(out).toBe(m);
  });
});
