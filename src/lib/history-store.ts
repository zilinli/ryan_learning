import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConversationRecord } from "./types";
import { slimMessages, titleFromMessages } from "./storage";

/** Server-side durable chat history (shared across browsers / devices). */
const DATA_DIR = path.join(process.cwd(), "data", "conversations");
export const SERVER_MAX_CONVERSATIONS = 100;

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

/** Strip heavy previews before writing to disk. */
export function sanitizeForServer(
  record: ConversationRecord,
): ConversationRecord {
  const messages = slimMessages(record.messages || [], false);
  return {
    sessionId: record.sessionId,
    title: record.title || titleFromMessages(messages),
    messages,
    createdAt: record.createdAt || Date.now(),
    updatedAt: record.updatedAt || Date.now(),
  };
}

export async function listServerConversations(): Promise<ConversationRecord[]> {
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
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out.slice(0, SERVER_MAX_CONVERSATIONS);
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
  const clean = sanitizeForServer({ ...record, sessionId: id });
  await fs.writeFile(filePath(id), JSON.stringify(clean), "utf8");
  await pruneServerOverflow();
  return clean;
}

export async function upsertServerConversations(
  records: ConversationRecord[],
): Promise<number> {
  let saved = 0;
  for (const rec of records) {
    const out = await upsertServerConversation(rec);
    if (out) saved += 1;
  }
  return saved;
}

export async function deleteServerConversation(
  sessionId: string,
): Promise<boolean> {
  const id = safeId(sessionId);
  if (!id) return false;
  try {
    await fs.unlink(filePath(id));
    return true;
  } catch {
    return false;
  }
}

async function pruneServerOverflow(): Promise<void> {
  const list = await listServerConversations();
  if (list.length <= SERVER_MAX_CONVERSATIONS) return;
  const drop = list.slice(SERVER_MAX_CONVERSATIONS);
  await Promise.all(
    drop.map((c) => fs.unlink(filePath(c.sessionId)).catch(() => undefined)),
  );
}
