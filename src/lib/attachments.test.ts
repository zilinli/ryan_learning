import { describe, it, expect } from "vitest";
import {
  isAllowedAttachment,
  buildAttachmentLines,
  MAX_ATTACHMENTS,
} from "../../agent-chat/src/lib/attachments";
import type { ChatAttachment } from "../../agent-chat/src/lib/types";

describe("attachments", () => {
  it("allows supported image mime types", () => {
    expect(isAllowedAttachment("image/png", "a.png")).toBe(true);
    expect(isAllowedAttachment("image/jpeg", "a.jpg")).toBe(true);
    expect(isAllowedAttachment("application/pdf", "a.pdf")).toBe(true);
  });

  it("rejects unknown binary types", () => {
    expect(isAllowedAttachment("application/x-msdownload", "a.exe")).toBe(false);
    expect(isAllowedAttachment("application/zip", "a.zip")).toBe(false);
  });

  it("allows common text extensions", () => {
    expect(isAllowedAttachment("", "script.py")).toBe(true);
    expect(isAllowedAttachment("", "notes.md")).toBe(true);
    expect(isAllowedAttachment("text/plain", "a.txt")).toBe(true);
  });

  it("builds text lines from textContent", async () => {
    const att: ChatAttachment = {
      id: "1",
      name: "note.txt",
      mimeType: "text/plain",
      kind: "file",
      textContent: "Hello world",
    };
    const out = await buildAttachmentLines([att]);
    expect(out).toContain("note.txt");
    expect(out).toContain("Hello world");
  });

  it("ignores empty / disallowed attachments", async () => {
    const out = await buildAttachmentLines([]);
    expect(out).toBe("");
  });

  it("caps attachments at MAX_ATTACHMENTS", async () => {
    const many: ChatAttachment[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: `f${i}.txt`,
      mimeType: "text/plain",
      kind: "file",
      textContent: "x",
    }));
    const out = await buildAttachmentLines(many);
    expect(MAX_ATTACHMENTS).toBe(9);
    const count = out.match(/--- File \d+ \(f\d+\.txt\)/g)?.length ?? 0;
    expect(count).toBe(9);
  });

  it("treats images as context (no base64 dump into prompt)", async () => {
    const att: ChatAttachment = {
      id: "1",
      name: "photo.png",
      mimeType: "image/png",
      kind: "image",
      data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    };
    const out = await buildAttachmentLines([att]);
    expect(out).toContain("photo.png");
    expect(out).not.toContain("iVBORw0KGgo"); // base64 not dumped
  });
});
