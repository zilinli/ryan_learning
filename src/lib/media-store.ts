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
  /** Original filename for downloads */
  name?: string;
  kind?: "image" | "file";
  /**
   * Owning account. Media files live in one shared data/media dir, so pruning
   * MUST be scoped per account — otherwise any account's retention pass deletes
   * every other account's homework photos (broken history images).
   */
  accountId?: string;
};

/**
 * Reserved sessionIds for Studio (Writing / TED) blobs. Chat retention must
 * never treat these as orphan chat sessions — otherwise My Creations audio
 * disappears a few minutes after generate.
 */
export const STUDIO_MEDIA_SESSION_IDS = new Set(["lyric-studio"]);

export function isStudioMediaSession(sessionId: string | undefined): boolean {
  return Boolean(sessionId && STUDIO_MEDIA_SESSION_IDS.has(sessionId));
}

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
  refs: {
    sessionId: string;
    messageId: string;
    attachmentId: string;
    name?: string;
    kind?: "image" | "file";
    accountId?: string;
  },
): Promise<StoredMediaMeta | null> {
  const parsed = stripDataUrl(dataUrl);
  if (!parsed) return null;
  await ensureMediaDir();
  const mime = parsed.mime || fallbackMime || "application/octet-stream";
  await fs.writeFile(binPath(mediaId), parsed.buf);
  const meta: StoredMediaMeta = {
    mediaId,
    mimeType: mime,
    sessionId: refs.sessionId,
    messageId: refs.messageId,
    attachmentId: refs.attachmentId,
    bytes: parsed.buf.length,
    ...(refs.name ? { name: refs.name.slice(0, 120) } : {}),
    ...(refs.kind ? { kind: refs.kind } : {}),
    ...(refs.accountId ? { accountId: refs.accountId } : {}),
  };
  await fs.writeFile(metaPath(mediaId), JSON.stringify(meta), "utf8");
  return meta;
}

/** Persist raw bytes (e.g. Fun-Music mp3) under data/media. */
export async function writeMediaBytes(
  mediaId: string,
  buf: Buffer,
  mimeType: string,
  refs: {
    sessionId: string;
    messageId: string;
    attachmentId: string;
    name?: string;
    kind?: "image" | "file";
    accountId?: string;
  },
): Promise<StoredMediaMeta | null> {
  if (!buf?.length) return null;
  await ensureMediaDir();
  const id = safeSegment(mediaId, 80);
  await fs.writeFile(binPath(id), buf);
  const meta: StoredMediaMeta = {
    mediaId: id,
    mimeType: mimeType || "application/octet-stream",
    sessionId: refs.sessionId,
    messageId: refs.messageId,
    attachmentId: refs.attachmentId,
    bytes: buf.length,
    ...(refs.name ? { name: refs.name.slice(0, 120) } : {}),
    ...(refs.kind ? { kind: refs.kind } : {}),
    ...(refs.accountId ? { accountId: refs.accountId } : {}),
  };
  await fs.writeFile(metaPath(id), JSON.stringify(meta), "utf8");
  return meta;
}

export async function readMedia(
  mediaId: string,
): Promise<{ buf: Buffer; mimeType: string; name?: string; kind?: string } | null> {
  const id = safeSegment(mediaId, 80);
  if (!id || id === "x") return null;
  try {
    const buf = await fs.readFile(binPath(id));
    let mimeType = "application/octet-stream";
    let name: string | undefined;
    let kind: string | undefined;
    try {
      const meta = JSON.parse(
        await fs.readFile(metaPath(id), "utf8"),
      ) as StoredMediaMeta;
      if (meta.mimeType) mimeType = meta.mimeType;
      if (meta.name) name = meta.name;
      if (meta.kind) kind = meta.kind;
    } catch {
      // ignore missing meta
    }
    return { buf, mimeType, name, kind };
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

export async function deleteMediaForSession(
  sessionId: string,
  accountId?: string,
): Promise<number> {
  // Never wipe Studio library media via a chat-session delete path.
  if (isStudioMediaSession(sessionId)) return 0;
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
      // Account-scoped deletion: when the caller knows the owning account,
      // never touch another account's (or legacy no-accountId) media. Keeps a
      // sessionId collision across accounts from deleting the other's photos.
      if (accountId) {
        if (!meta.accountId || meta.accountId !== accountId) continue;
      }
      await deleteMedia(meta.mediaId);
      removed += 1;
    } catch {
      // skip
    }
  }
  return removed;
}

/** Collect mediaIds still referenced by conversation JSON. */
export function collectReferencedMediaIds(
  conversations: ConversationRecord[],
): Set<string> {
  const ids = new Set<string>();
  for (const c of conversations || []) {
    for (const m of c.messages || []) {
      for (const a of m.attachments || []) {
        if (a.mediaId) ids.add(a.mediaId);
      }
    }
  }
  return ids;
}

/**
 * Drop media for the given account whose session is gone, or whose mediaId is
 * no longer referenced (e.g. messages trimmed by retention). Also removes
 * stray .bin without meta.
 *
 * PRUNING IS ACCOUNT-SCOPED: media meta carries `accountId`, and only media
 * that belongs to this account is ever deleted here. Media written by older
 * builds (no accountId) is left untouched — a per-account retention pass must
 * never delete another account's (or legacy) homework photos.
 *
 * Fresh files (< 2 min) for unknown sessions are kept so an in-flight upsert
 * that wrote media before the conversation JSON cannot race with prune.
 */
export async function pruneOrphanMedia(
  accountId: string,
  keepSessionIds: Set<string>,
  keepMediaIds?: Set<string>,
): Promise<number> {
  await ensureMediaDir();
  const names = await fs.readdir(MEDIA_DIR);
  let removed = 0;
  const seenBins = new Set<string>();
  const GRACE_MS = 2 * 60 * 1000;
  const now = Date.now();

  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const base = name.slice(0, -".json".length);
    seenBins.add(`${base}.bin`);
    const jsonFull = path.join(MEDIA_DIR, name);
    try {
      const meta = JSON.parse(
        await fs.readFile(jsonFull, "utf8"),
      ) as StoredMediaMeta;
      // PRUNING IS ACCOUNT-SCOPED: only media whose meta.accountId matches this
      // account may be removed. Media without accountId (written by old builds)
      // is treated as legacy — its owner is unknowable, so it is never pruned by
      // a per-account retention pass (a stale delete here breaks history imgs).
      if (!meta.accountId || meta.accountId !== accountId) continue;
      // Studio songs/images/videos live under reserved sessionIds and are
      // referenced from creations.json — not chat history. Never orphan-prune.
      if (isStudioMediaSession(meta.sessionId)) continue;
      const sessionKept = keepSessionIds.has(meta.sessionId);
      const unreferenced =
        Boolean(keepMediaIds) &&
        sessionKept &&
        !keepMediaIds!.has(meta.mediaId);
      const sessionGone = !sessionKept;

      if (unreferenced) {
        await deleteMedia(meta.mediaId);
        removed += 1;
        continue;
      }
      if (sessionGone) {
        let mtime = now;
        try {
          mtime = (await fs.stat(jsonFull)).mtimeMs;
        } catch {
          // ignore
        }
        if (now - mtime < GRACE_MS) continue;
        await deleteMedia(meta.mediaId);
        removed += 1;
      }
    } catch {
      // Corrupt meta — remove pair
      await Promise.allSettled([
        fs.unlink(jsonFull),
        fs.unlink(path.join(MEDIA_DIR, `${base}.bin`)),
      ]);
      removed += 1;
    }
  }

  // Stray .bin files with no matching .json
  for (const name of names) {
    if (!name.endsWith(".bin")) continue;
    if (seenBins.has(name)) continue;
    const jsonSibling = name.slice(0, -".bin".length) + ".json";
    if (names.includes(jsonSibling)) continue;
    const binFull = path.join(MEDIA_DIR, name);
    try {
      const st = await fs.stat(binFull);
      if (now - st.mtimeMs < GRACE_MS) continue;
      await fs.unlink(binFull);
      removed += 1;
    } catch {
      // ignore
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
 * Persist homework photos + uploaded files to data/media and return a
 * JSON-safe conversation (no base64 dataUrls).
 */
export async function persistConversationMedia(
  record: ConversationRecord,
  accountId?: string,
): Promise<ConversationRecord> {
  const sessionId = record.sessionId;
  const messages: ChatMessage[] = [];

  for (const m of record.messages || []) {
    const attachments: ChatAttachment[] = [];
    for (const a of m.attachments || []) {
      if (a.dataUrl) {
        const mediaId = a.mediaId || buildMediaId(sessionId, m.id, a.id);
        await writeMediaFromDataUrl(mediaId, a.dataUrl, a.mimeType, {
          sessionId,
          messageId: m.id,
          attachmentId: a.id,
          name: a.name,
          kind: a.kind,
          accountId,
        });
        attachments.push({
          id: a.id,
          name: a.name,
          mimeType: a.mimeType,
          kind: a.kind,
          mediaId,
        });
      } else if (a.mediaId) {
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
        name: "photo.jpg",
        kind: "image",
        accountId,
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
