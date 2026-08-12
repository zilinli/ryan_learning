/**
 * Server-side parent → student message store.
 * JSON-file per student account: data/accounts/{id}/messages.json
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type MessageUrgency = "routine" | "important" | "urgent";

export type MessageAttachment = {
  name: string;
  url: string;
  type: "image" | "file";
};

export type ParentMessage = {
  id: string;
  fromAccountId: string;
  fromName: string;
  toAccountId: string;
  title: string;
  body: string;
  urgency: MessageUrgency;
  createdAt: number;
  publicReadAt?: number;
  senderSilentViewAt?: number;
  attachments?: MessageAttachment[];
};

export type MessagesStore = {
  version: 1;
  messages: ParentMessage[];
};

const MAX_MESSAGES = 200;

function dataDir(): string {
  return process.env.SPARK_DATA_DIR
    ? path.resolve(process.env.SPARK_DATA_DIR)
    : path.join(process.cwd(), "data");
}

function storePath(accountId: string): string {
  const safe = accountId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return path.join(dataDir(), "accounts", safe, "messages.json");
}

function empty(): MessagesStore {
  return { version: 1, messages: [] };
}

export async function loadMessages(accountId: string): Promise<MessagesStore> {
  try {
    const raw = await fs.readFile(storePath(accountId), "utf8");
    const parsed = JSON.parse(raw) as MessagesStore;
    if (!parsed || !Array.isArray(parsed.messages)) return empty();
    return { version: 1, messages: parsed.messages.slice(0, MAX_MESSAGES) };
  } catch {
    return empty();
  }
}

export async function saveMessages(
  accountId: string,
  store: MessagesStore,
): Promise<void> {
  const p = storePath(accountId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  if (store.messages.length > MAX_MESSAGES) {
    store.messages = store.messages.slice(store.messages.length - MAX_MESSAGES);
  }
  await fs.writeFile(p, JSON.stringify(store, null, 2), "utf8");
}

export async function addMessage(
  toAccountId: string,
  msg: ParentMessage,
): Promise<MessagesStore> {
  const store = await loadMessages(toAccountId);
  store.messages.push(msg);
  await saveMessages(toAccountId, store);
  return store;
}

export async function markRead(
  accountId: string,
  messageId: string,
  silent?: boolean,
): Promise<MessagesStore> {
  const store = await loadMessages(accountId);
  const msg = store.messages.find((m) => m.id === messageId);
  if (msg && !silent && !msg.publicReadAt) {
    msg.publicReadAt = Date.now();
  }
  await saveMessages(accountId, store);
  return store;
}

export async function unreadCount(accountId: string): Promise<number> {
  const store = await loadMessages(accountId);
  return store.messages.filter((m) => !m.publicReadAt).length;
}
