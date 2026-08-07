import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConversationRecord } from "./types";
import { slimMessages, titleFromMessages } from "./storage";
import {
  countMessages,
  enforceHistoryRetention,
  estimateHistoryBytes,
  MAX_HISTORY_BYTES,
  MAX_TOTAL_MESSAGES,
  searchConversations,
  type HistorySearchHit,
} from "./history-retention";
import {
  collectReferencedMediaIds,
  deleteMediaForSession,
  persistConversationMedia,
  pruneOrphanMedia,
} from "./media-store";
import { lockedWriteJson } from "./file-lock";
import { isTombstoned, readDeletionLog, writeTombstone } from "./deletion-log";

/** Server-side durable chat history (account-scoped, shared across browsers / devices). */
const BASE_DIR = path.join(process.cwd(), "data");
const HISTORY_DIR = path.join(BASE_DIR, "history");
const LEGACY_CONV_DIR = path.join(BASE_DIR, "conversations");
export const SERVER_MAX_CONVERSATIONS = 200;

export {
  MAX_HISTORY_BYTES,
  MAX_TOTAL_MESSAGES,
  searchConversations,
  type HistorySearchHit,
};

function safeId(sessionId: string): string | null {
  const id = (sessionId || "").trim();
  if (!id || id.length > 80) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return id;
}

function dataDir(accountId: string = "default"): string {
  const canonical = toServerAccountId(accountId);
  if (canonical === "default") return LEGACY_CONV_DIR;
  return path.join(HISTORY_DIR, canonical);
}

/** Map client accountId → server storage accountId. "acct_ryan" → "default" for backward compat. */
function toServerAccountId(clientId: string): string {
  if (clientId === "acct_ryan" || clientId === "default") return "default";
  return clientId;
}

function filePath(sessionId: string, accountId: string = "default"): string {
  return path.join(dataDir(accountId), `${sessionId}.json`);
}

async function ensureDir(accountId: string = "default"): Promise<void> {
  await fs.mkdir(dataDir(accountId), { recursive: true });
}

/**
 * Strip base64 from a conversation JSON record.
 * Keeps mediaId so history photos can be loaded via /api/media/:id.
 */
export function sanitizeForServer(
  record: ConversationRecord,
): ConversationRecord {
  const messages = slimMessages(record.messages || [], false).map((m) => {
    const attachments = m.attachments?.map((a) => ({
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      kind: a.kind,
      ...(a.mediaId ? { mediaId: a.mediaId } : {}),
    }));
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      ...(attachments?.length ? { attachments } : {}),
    };
  });
  return {
    sessionId: record.sessionId,
    title: record.title || titleFromMessages(messages),
    messages,
    createdAt: record.createdAt || Date.now(),
    updatedAt: record.updatedAt || Date.now(),
  };
}

/** Persist homework photos to disk, then return JSON-safe conversation. */
export async function prepareConversationForServer(
  record: ConversationRecord,
  accountId: string = "default",
): Promise<ConversationRecord> {
  const withMedia = await persistConversationMedia(record, accountId);
  return sanitizeForServer(withMedia);
}

async function readAllFromDisk(accountId: string = "default"): Promise<ConversationRecord[]> {
  const dir = dataDir(accountId);
  await ensureDir(accountId);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: ConversationRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name.startsWith("_")) continue;
    try {
      const raw = await fs.readFile(path.join(dir, name), "utf8");
      const parsed = JSON.parse(raw) as ConversationRecord;
      if (parsed?.sessionId && Array.isArray(parsed.messages)) {
        out.push(sanitizeForServer(parsed));
      }
    } catch {
      // skip corrupt
    }
  }
  return out;
}

/**
 * Drop oldest chats / trim messages so we stay under the message budget.
 * Deletes pruned conversation files and orphan media from disk.
 */
export async function enforceServerRetention(accountId: string = "default"): Promise<{
  conversations: number;
  messages: number;
  bytes: number;
  removed: number;
}> {
  const before = await readAllFromDisk(accountId);
  const kept = enforceHistoryRetention(before, {
    maxMessages: MAX_TOTAL_MESSAGES,
    maxBytes: MAX_HISTORY_BYTES,
  }).slice(0, SERVER_MAX_CONVERSATIONS);

  const keepIds = new Set(kept.map((c) => c.sessionId));
  let removed = 0;

  for (const c of before) {
    if (keepIds.has(c.sessionId)) continue;
    try {
      await fs.unlink(filePath(c.sessionId, accountId));
      await deleteMediaForSession(c.sessionId, accountId);
      removed += 1;
    } catch {
      // ignore
    }
  }

  // Rewrite chats that were message-trimmed
  for (const c of kept) {
    const prev = before.find((x) => x.sessionId === c.sessionId);
    if (prev && prev.messages.length !== c.messages.length) {
      await lockedWriteJson(filePath(c.sessionId, accountId), c);
    }
  }

  // Drop media for deleted chats AND for messages trimmed out of kept chats.
  // Pruning is account-scoped — only this account's media may be removed.
  await pruneOrphanMedia(accountId, keepIds, collectReferencedMediaIds(kept));

  return {
    conversations: kept.length,
    messages: countMessages(kept),
    bytes: estimateHistoryBytes(kept),
    removed,
  };
}

export async function listServerConversations(accountId: string = "default"): Promise<ConversationRecord[]> {
  const all = await readAllFromDisk(accountId);
  const kept = enforceHistoryRetention(all).slice(0, SERVER_MAX_CONVERSATIONS);
  kept.sort((a, b) => b.updatedAt - a.updatedAt);
  return kept;
}

export async function searchServerConversations(
  query: string,
  accountId: string = "default",
): Promise<HistorySearchHit[]> {
  const list = await listServerConversations(accountId);
  return searchConversations(list, query);
}

export async function getServerConversation(
  sessionId: string,
  accountId: string = "default",
): Promise<ConversationRecord | null> {
  const id = safeId(sessionId);
  if (!id) return null;
  try {
    const raw = await fs.readFile(filePath(id, accountId), "utf8");
    const parsed = JSON.parse(raw) as ConversationRecord;
    if (!parsed?.sessionId) return null;
    return sanitizeForServer(parsed);
  } catch {
    return null;
  }
}

/**
 * A deleted conversation must never be re-created: the server rejects any
 * upsert of a session that has a fresh tombstone. This is the authoritative
 * guard against the cross-device "reincarnation" bug — a stale device's push
 * of a chat that was deleted elsewhere is silently dropped here.
 */
async function isDeletedSession(
  sessionId: string,
  accountId: string,
): Promise<boolean> {
  const deletions = await readDeletionLog(accountId);
  return isTombstoned(deletions, sessionId);
}

export async function upsertServerConversation(
  record: ConversationRecord,
  accountId: string = "default",
): Promise<ConversationRecord | null> {
  const id = safeId(record.sessionId);
  if (!id) return null;
  if (!record.messages?.length) {
    return null;
  }
  if (await isDeletedSession(id, accountId)) {
    return null;
  }
  await ensureDir(accountId);
  const clean = await prepareConversationForServer(
    { ...record, sessionId: id },
    accountId,
  );
  await lockedWriteJson(filePath(id, accountId), clean);
  await enforceServerRetention(accountId);
  return clean;
}

export async function upsertServerConversations(
  records: ConversationRecord[],
  accountId: string = "default",
): Promise<ConversationRecord[]> {
  const saved: ConversationRecord[] = [];
  await ensureDir(accountId);
  const deletions = await readDeletionLog(accountId);
  for (const rec of records) {
    const id = safeId(rec.sessionId);
    if (!id || !rec.messages?.length) continue;
    if (isTombstoned(deletions, id)) continue;
    const clean = await prepareConversationForServer(
      { ...rec, sessionId: id },
      accountId,
    );
    await lockedWriteJson(filePath(id, accountId), clean);
    saved.push(clean);
  }
  if (saved.length > 0) await enforceServerRetention(accountId);
  return saved;
}

export async function deleteServerConversation(
  sessionId: string,
  accountId: string = "default",
): Promise<boolean> {
  const id = safeId(sessionId);
  if (!id) return false;
  // Write tombstone so other devices know to drop this conversation
  await writeTombstone(id, accountId);
  let removedJson = false;
  try {
    await fs.unlink(filePath(id, accountId));
    removedJson = true;
  } catch {
    // Already gone — still clean media below
  }
  const removedMedia = await deleteMediaForSession(id, accountId);
  return removedJson || removedMedia > 0;
}

export async function historyStats(accountId: string = "default"): Promise<{
  conversations: number;
  messages: number;
  bytes: number;
  maxMessages: number;
  maxBytes: number;
}> {
  const list = await listServerConversations(accountId);
  return {
    conversations: list.length,
    messages: countMessages(list),
    bytes: estimateHistoryBytes(list),
    maxMessages: MAX_TOTAL_MESSAGES,
    maxBytes: MAX_HISTORY_BYTES,
  };
}
