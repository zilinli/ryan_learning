/**
 * Account-scoped creations for TED Lab challenges + Lyric Studio songs.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type CreationType = "ted_challenge" | "song" | "image" | "video";

export type CreationItem = {
  id: string;
  type: CreationType;
  title: string;
  createdAt: number;
  accountId: string;
  talkSlug?: string;
  notes?: string;
  /** Structured lyrics for songs */
  lyrics?: string;
  /** Style / mood notes (saved; Fun-Music primarily uses lyrics) */
  caption?: string;
  /** media-store id for audio blob */
  audioMediaId?: string;
  /** media-store id for image/video blobs from Stage text2X */
  mediaId?: string;
  /** Optional challenge summary */
  challengeScore?: string;
};

export type CreationsStore = {
  version: 1;
  items: CreationItem[];
};

const ROOT = path.join(process.cwd(), "data", "accounts");

function storePath(accountId: string): string {
  const safe = accountId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return path.join(ROOT, safe, "creations.json");
}

function empty(): CreationsStore {
  return { version: 1, items: [] };
}

export async function loadCreations(accountId: string): Promise<CreationsStore> {
  try {
    const raw = await fs.readFile(storePath(accountId), "utf8");
    const parsed = JSON.parse(raw) as CreationsStore;
    if (!parsed || !Array.isArray(parsed.items)) return empty();
    return { version: 1, items: parsed.items };
  } catch {
    return empty();
  }
}

export async function saveCreations(
  accountId: string,
  store: CreationsStore,
): Promise<void> {
  const p = storePath(accountId);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(store, null, 2), "utf8");
}

export async function addCreation(
  accountId: string,
  item: Omit<CreationItem, "id" | "createdAt" | "accountId"> & {
    id?: string;
    createdAt?: number;
  },
): Promise<CreationItem> {
  const store = await loadCreations(accountId);
  const row: CreationItem = {
    ...item,
    id: item.id || `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: item.createdAt || Date.now(),
    accountId,
  };
  store.items.unshift(row);
  store.items = store.items.slice(0, 100);
  await saveCreations(accountId, store);
  return row;
}

export async function deleteCreation(
  accountId: string,
  id: string,
): Promise<boolean> {
  const store = await loadCreations(accountId);
  const next = store.items.filter((i) => i.id !== id);
  if (next.length === store.items.length) return false;
  store.items = next;
  await saveCreations(accountId, store);
  return true;
}
