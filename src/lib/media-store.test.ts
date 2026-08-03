import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMediaId,
  collectReferencedMediaIds,
  deleteMediaForSession,
  persistConversationMedia,
  pruneOrphanMedia,
  readMedia,
} from "./media-store";
import {
  deleteServerConversation,
  upsertServerConversation,
} from "./history-store";

const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

describe("media-store", () => {
  it("persists homework photos and reads them back", async () => {
    const sessionId = `med_${Date.now()}`;
    const mediaId = buildMediaId(sessionId, "m1", "a1");
    const prepared = await persistConversationMedia({
      sessionId,
      title: "hw",
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
              dataUrl: TINY_JPEG,
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    });

    expect(prepared.messages[0]?.attachments?.[0]?.dataUrl).toBeUndefined();
    expect(prepared.messages[0]?.attachments?.[0]?.mediaId).toBeTruthy();

    const hit = await readMedia(
      prepared.messages[0]!.attachments![0]!.mediaId!,
    );
    expect(hit).not.toBeNull();
    expect(hit!.buf.length).toBeGreaterThan(20);
    expect(hit!.mimeType).toMatch(/image\//);

    const dir = path.join(process.cwd(), "data", "media");
    const id = prepared.messages[0]!.attachments![0]!.mediaId!;
    await rm(path.join(dir, `${id}.bin`), { force: true });
    await rm(path.join(dir, `${id}.json`), { force: true });
    expect(mediaId).toContain("_");
  });

  it("persists PDF files for later download", async () => {
    const sessionId = `pdf_${Date.now()}`;
    const pdfB64 = Buffer.from(
      "%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
    ).toString("base64");
    const prepared = await persistConversationMedia({
      sessionId,
      title: "pdf",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "see pdf",
          createdAt: 1,
          attachments: [
            {
              id: "a1",
              name: "hw.pdf",
              mimeType: "application/pdf",
              kind: "file",
              dataUrl: `data:application/pdf;base64,${pdfB64}`,
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    const id = prepared.messages[0]?.attachments?.[0]?.mediaId;
    expect(id).toBeTruthy();
    const hit = await readMedia(id!);
    expect(hit?.mimeType).toMatch(/pdf/);
    expect(hit?.name).toBe("hw.pdf");
    expect(hit!.buf.toString("utf8")).toContain("%PDF");

    const dir = path.join(process.cwd(), "data", "media");
    await rm(path.join(dir, `${id}.bin`), { force: true });
    await rm(path.join(dir, `${id}.json`), { force: true });
  });

  it("deletes media files when a conversation is deleted", async () => {
    const id = `delmed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved = await upsertServerConversation({
      sessionId: id,
      title: "with photo",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "hw",
          createdAt: 1,
          attachments: [
            {
              id: "a1",
              name: "p.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              dataUrl: TINY_JPEG,
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    const mediaId = saved?.messages[0]?.attachments?.[0]?.mediaId;
    expect(mediaId).toBeTruthy();
    expect(await readMedia(mediaId!)).not.toBeNull();

    expect(await deleteServerConversation(id)).toBe(true);
    expect(await readMedia(mediaId!)).toBeNull();
  });

  it("prunes media for trimmed messages and orphan sessions", async () => {
    const sessionId = `prune_${Date.now()}`;
    const prepared = await persistConversationMedia({
      sessionId,
      title: "trim",
      messages: [
        {
          id: "old",
          role: "user",
          content: "old photo",
          createdAt: 1,
          attachments: [
            {
              id: "a_old",
              name: "old.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              dataUrl: TINY_JPEG,
            },
          ],
        },
        {
          id: "keep",
          role: "user",
          content: "keep photo",
          createdAt: 2,
          attachments: [
            {
              id: "a_keep",
              name: "keep.jpg",
              mimeType: "image/jpeg",
              kind: "image",
              dataUrl: TINY_JPEG,
            },
          ],
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    });
    const oldId = prepared.messages[0]!.attachments![0]!.mediaId!;
    const keepId = prepared.messages[1]!.attachments![0]!.mediaId!;

    const trimmed = {
      ...prepared,
      messages: [prepared.messages[1]!],
    };
    const removed = await pruneOrphanMedia(
      new Set([sessionId]),
      collectReferencedMediaIds([trimmed]),
    );
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await readMedia(oldId)).toBeNull();
    expect(await readMedia(keepId)).not.toBeNull();

    await deleteMediaForSession(sessionId);
    expect(await readMedia(keepId)).toBeNull();
  });
});
