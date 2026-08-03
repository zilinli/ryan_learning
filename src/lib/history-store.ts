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
  deleteMediaForSession,
  persistConversationMedia,
  pruneOrphanMedia,
} from "./media-store";

/** Server-side durable chat history (shared across browsers / devices). */
const DATA_DIR = path.join(process.cwd(), "data", "conversations");
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

function filePath(sessionId: string): string {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
): Promise<ConversationRecord> {
  const withMedia = await persistConversationMedia(record);
  return sanitizeForServer(withMedia);
}

async function readAllFromDisk(): Promise<ConversationRecord[]> {
  await ensureDir();
  const names = await fs.readdir(DATA_DIR);
  const out: ConversationRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name.startsWith("_")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, name), "utf8");
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
export async function enforceServerRetention(): Promise<{
  conversations: number;
  messages: number;
  bytes: number;
  removed: number;
}> {
  const before = await readAllFromDisk();
  const kept = enforceHistoryRetention(before, {
    maxMessages: MAX_TOTAL_MESSAGES,
    maxBytes: MAX_HISTORY_BYTES,
  }).slice(0, SERVER_MAX_CONVERSATIONS);

  const keepIds = new Set(kept.map((c) => c.sessionId));
  let removed = 0;

  for (const c of before) {
    if (keepIds.has(c.sessionId)) continue;
    try {
      await fs.unlink(filePath(c.sessionId));
      await deleteMediaForSession(c.sessionId);
      removed += 1;
    } catch {
      // ignore
    }
  }

  // Rewrite chats that were message-trimmed
  for (const c of kept) {
    const prev = before.find((x) => x.sessionId === c.sessionId);
    if (prev && prev.messages.length !== c.messages.length) {
      await fs.writeFile(filePath(c.sessionId), JSON.stringify(c), "utf8");
    }
  }

  await pruneOrphanMedia(keepIds);

  return {
    conversations: kept.length,
    messages: countMessages(kept),
    bytes: estimateHistoryBytes(kept),
    removed,
  };
}

export async function listServerConversations(): Promise<ConversationRecord[]> {
  const all = await readAllFromDisk();
  const kept = enforceHistoryRetention(all).slice(0, SERVER_MAX_CONVERSATIONS);
  kept.sort((a, b) => b.updatedAt - a.updatedAt);
  return kept;
}

export async function searchServerConversations(
  query: string,
): Promise<HistorySearchHit[]> {
  const list = await listServerConversations();
  return searchConversations(list, query);
}

export async function getServerConversation(
  sessionId: string,
): Promise<ConversationRecord | null> {
  const id = safeId(sessionId);
  if (!id) return null;
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    const parsed = JSON.parse(raw) as ConversationRecord;
    if (!parsed?.sessionId) return null;
    return sanitizeForServer(parsed);
  } catch {
    return null;
  }
}

export async function upsertServerConversation(
  record: ConversationRecord,
): Promise<ConversationRecord | null> {
  const id = safeId(record.sessionId);
  if (!id) return null;
  // Skip empty drafts so the global list stays useful
  if (!record.messages?.length) {
    return null;
  }
  await ensureDir();
  const clean = await prepareConversationForServer({ ...record, sessionId: id });
  await fs.writeFile(filePath(id), JSON.stringify(clean), "utf8");
  await enforceServerRetention();
  return clean;
}

export async function upsertServerConversations(
  records: ConversationRecord[],
): Promise<number> {
  let saved = 0;
  await ensureDir();
  for (const rec of records) {
    const id = safeId(rec.sessionId);
    if (!id || !rec.messages?.length) continue;
    const clean = await prepareConversationForServer({ ...rec, sessionId: id });
    await fs.writeFile(filePath(id), JSON.stringify(clean), "utf8");
    saved += 1;
  }
  if (saved > 0) await enforceServerRetention();
  return saved;
}

export async function deleteServerConversation(
  sessionId: string,
): Promise<boolean> {
  const id = safeId(sessionId);
  if (!id) return false;
  try {
    await fs.unlink(filePath(id));
    await deleteMediaForSession(id);
    return true;
  } catch {
    return false;
  }
}

export async function historyStats(): Promise<{
  conversations: number;
  messages: number;
  bytes: number;
  maxMessages: number;
  maxBytes: number;
}> {
  const list = await listServerConversations();
  return {
    conversations: list.length,
    messages: countMessages(list),
    bytes: estimateHistoryBytes(list),
    maxMessages: MAX_TOTAL_MESSAGES,
    maxBytes: MAX_HISTORY_BYTES,
  };
}
