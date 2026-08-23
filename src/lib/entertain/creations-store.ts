/**
 * Account-scoped creations for TED Lab challenges + Writing Studio songs.
 * Server disk only — same host + same accountId = same library across devices.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type CreationType = "ted_challenge" | "natgeo_challenge" | "bbc_challenge" | "rsa_challenge" | "podcast_challenge" | "song" | "image" | "video";

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
  /** Public share token for /share/c/[token] (songs / videos / images) */
  shareToken?: string;
  /** Set by GET /api/creations when referenced audio blob is gone */
  audioMissing?: boolean;
  /** Set by GET /api/creations when referenced image/video blob is gone */
  mediaMissing?: boolean;
};

export type CreationsStore = {
  version: 1;
  items: CreationItem[];
};

function dataDir(): string {
  return process.env.SPARK_DATA_DIR
    ? path.resolve(process.env.SPARK_DATA_DIR)
    : path.join(process.cwd(), "data");
}

function storePath(accountId: string): string {
  const safe = accountId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return path.join(dataDir(), "accounts", safe, "creations.json");
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

/** All media blob ids referenced by this account's My Creations. */
export async function listCreationMediaIds(
  accountId: string,
): Promise<Set<string>> {
  const store = await loadCreations(accountId);
  const ids = new Set<string>();
  for (const item of store.items) {
    if (item.audioMediaId) ids.add(item.audioMediaId);
    if (item.mediaId) ids.add(item.mediaId);
  }
  return ids;
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
  const overflow = store.items.slice(99);
  store.items.unshift(row);
  store.items = store.items.slice(0, 100);
  await saveCreations(accountId, store);
  try {
    const { appendCreationToJournal } = await import("./journal-store");
    await appendCreationToJournal(accountId, row);
  } catch {
    /* journal is best-effort — never fail Keep */
  }
  if (overflow.length) {
    const { deleteMedia } = await import("../media-store");
    await Promise.allSettled(
      overflow.flatMap((o) =>
        [o.audioMediaId, o.mediaId]
          .filter(Boolean)
          .map((id) => deleteMedia(id!)),
      ),
    );
  }
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

function newShareToken(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Ensure a creation has a shareToken; persists and returns the item. */
export async function ensureCreationShareToken(
  accountId: string,
  creationId: string,
): Promise<CreationItem | null> {
  const store = await loadCreations(accountId);
  const idx = store.items.findIndex((i) => i.id === creationId);
  if (idx < 0) return null;
  const row = store.items[idx]!;
  if (row.shareToken) return row;
  const next: CreationItem = { ...row, shareToken: newShareToken() };
  store.items[idx] = next;
  await saveCreations(accountId, store);
  return next;
}

async function listAccountDirs(): Promise<string[]> {
  const root = path.join(dataDir(), "accounts");
  try {
    const names = await fs.readdir(root);
    const out: string[] = [];
    for (const name of names) {
      try {
        const st = await fs.stat(path.join(root, name));
        if (st.isDirectory()) out.push(name);
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Resolve a public share token to a creation (any account on this host). */
export async function findCreationByShareToken(
  token: string,
): Promise<CreationItem | null> {
  const t = token.trim();
  if (!t || t.length < 8 || t.length > 80) return null;
  if (!/^s_[A-Za-z0-9_-]+$/.test(t)) return null;
  for (const acct of await listAccountDirs()) {
    const store = await loadCreations(acct);
    const hit = store.items.find((i) => i.shareToken === t);
    if (hit) return hit;
  }
  return null;
}
