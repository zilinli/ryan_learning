import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChatAttachment, ChatMessage, ConversationRecord } from "./types";

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

export type StoredMediaMeta = {
  mediaId: string;
  mimeType: string;
  sessionId: string;
  messageId: string;
  attachmentId: string;
  bytes: number;
};

function safeSegment(s: string, max = 48): string {
  return (s || "x")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, max);
}

/** Stable id for a homework photo on disk. */
export function buildMediaId(
  sessionId: string,
  messageId: string,
  attachmentId: string,
): string {
  const raw = `${sessionId}|${messageId}|${attachmentId}`;
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 24);
  return `${safeSegment(sessionId, 24)}_${hash}`;
}

function binPath(mediaId: string): string {
  return path.join(MEDIA_DIR, `${safeSegment(mediaId, 80)}.bin`);
}

function metaPath(mediaId: string): string {
  return path.join(MEDIA_DIR, `${safeSegment(mediaId, 80)}.json`);
}

async function ensureMediaDir(): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}

function stripDataUrl(dataUrl: string): { mime: string; buf: Buffer } | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl || "");
  if (!m) return null;
  const mime = m[1] || "image/jpeg";
  const isB64 = Boolean(m[2]);
  const payload = m[3] || "";
  try {
    const buf = isB64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    if (buf.length < 8) return null;
    return { mime, buf };
  } catch {
    return null;
  }
}

export async function writeMediaFromDataUrl(
  mediaId: string,
  dataUrl: string,
  fallbackMime: string,
  refs: { sessionId: string; messageId: string; attachmentId: string },
): Promise<StoredMediaMeta | null> {
  const parsed = stripDataUrl(dataUrl);
  if (!parsed) return null;
  await ensureMediaDir();
  const mime = parsed.mime || fallbackMime || "image/jpeg";
  await fs.writeFile(binPath(mediaId), parsed.buf);
  const meta: StoredMediaMeta = {
    mediaId,
    mimeType: mime,
    sessionId: refs.sessionId,
    messageId: refs.messageId,
    attachmentId: refs.attachmentId,
    bytes: parsed.buf.length,
  };
  await fs.writeFile(metaPath(mediaId), JSON.stringify(meta), "utf8");
  return meta;
}

export async function readMedia(
  mediaId: string,
): Promise<{ buf: Buffer; mimeType: string } | null> {
  const id = safeSegment(mediaId, 80);
  if (!id || id === "x") return null;
  try {
    const buf = await fs.readFile(binPath(id));
    let mimeType = "image/jpeg";
    try {
      const meta = JSON.parse(
        await fs.readFile(metaPath(id), "utf8"),
      ) as StoredMediaMeta;
      if (meta.mimeType) mimeType = meta.mimeType;
    } catch {
      // ignore missing meta
    }
    return { buf, mimeType };
  } catch {
    return null;
  }
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const id = safeSegment(mediaId, 80);
  await Promise.allSettled([
    fs.unlink(binPath(id)),
    fs.unlink(metaPath(id)),
  ]);
}

export async function deleteMediaForSession(sessionId: string): Promise<number> {
  await ensureMediaDir();
  const names = await fs.readdir(MEDIA_DIR);
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const meta = JSON.parse(
        await fs.readFile(path.join(MEDIA_DIR, name), "utf8"),
      ) as StoredMediaMeta;
      if (meta.sessionId !== sessionId) continue;
      await deleteMedia(meta.mediaId);
      removed += 1;
    } catch {
      // skip
    }
  }
  return removed;
}

/** Drop media whose session is no longer in the keep set. */
export async function pruneOrphanMedia(
  keepSessionIds: Set<string>,
): Promise<number> {
  await ensureMediaDir();
  const names = await fs.readdir(MEDIA_DIR);
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const meta = JSON.parse(
        await fs.readFile(path.join(MEDIA_DIR, name), "utf8"),
      ) as StoredMediaMeta;
      if (keepSessionIds.has(meta.sessionId)) continue;
      await deleteMedia(meta.mediaId);
      removed += 1;
    } catch {
      // skip corrupt
    }
  }
  return removed;
}

function slimAttMeta(a: ChatAttachment): ChatAttachment {
  return {
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    kind: a.kind,
    ...(a.mediaId ? { mediaId: a.mediaId } : {}),
  };
}

/**
 * Persist homework photos to data/media and return a JSON-safe conversation
 * (no base64 dataUrls).
 */
export async function persistConversationMedia(
  record: ConversationRecord,
): Promise<ConversationRecord> {
  const sessionId = record.sessionId;
  const messages: ChatMessage[] = [];

  for (const m of record.messages || []) {
    const attachments: ChatAttachment[] = [];
    for (const a of m.attachments || []) {
      if (a.kind === "image" && a.dataUrl) {
        const mediaId =
          a.mediaId || buildMediaId(sessionId, m.id, a.id);
        await writeMediaFromDataUrl(mediaId, a.dataUrl, a.mimeType, {
          sessionId,
          messageId: m.id,
          attachmentId: a.id,
        });
        attachments.push({
          id: a.id,
          name: a.name,
          mimeType: a.mimeType,
          kind: "image",
          mediaId,
        });
      } else if (a.kind === "image" && a.mediaId) {
        attachments.push(slimAttMeta(a));
      } else {
        attachments.push(slimAttMeta(a));
      }
    }

    // Legacy single image field
    if (m.image?.dataUrl) {
      const attId = `${m.id}-img`;
      const mediaId = buildMediaId(sessionId, m.id, attId);
      await writeMediaFromDataUrl(mediaId, m.image.dataUrl, m.image.mimeType, {
        sessionId,
        messageId: m.id,
        attachmentId: attId,
      });
      if (!attachments.some((x) => x.id === attId)) {
        attachments.push({
          id: attId,
          name: "photo",
          mimeType: m.image.mimeType || "image/jpeg",
          kind: "image",
          mediaId,
        });
      }
    }

    messages.push({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      ...(attachments.length ? { attachments } : {}),
    });
  }

  return {
    sessionId,
    title: record.title,
    messages,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
