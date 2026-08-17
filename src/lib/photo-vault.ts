/**
 * Browser photo vault (IndexedDB) so homework images survive
 * localStorage slim / server sync that strips base64.
 */

import type {
  ChatAttachment,
  ChatMessage,
  ConversationRecord,
  ConversationsStore,
} from "./types";
import { isLargeBinaryAttachment } from "./attachments";

const DB_NAME = "spark.photoVault";
const STORE = "photos";
const DB_VERSION = 1;

export type VaultPhoto = {
  id: string;
  dataUrl: string;
  mimeType: string;
  name?: string;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let req: IDBRequest<T> | undefined;
    try {
      const r = fn(store);
      if (r) req = r;
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("idb tx failed"));
    };
  });
}

export async function putPhotoInVault(photo: {
  id: string;
  dataUrl: string;
  mimeType?: string;
  name?: string;
}): Promise<void> {
  if (!photo.id || !photo.dataUrl?.startsWith("data:")) return;
  try {
    await withStore("readwrite", (store) => {
      store.put({
        id: photo.id,
        dataUrl: photo.dataUrl,
        mimeType: photo.mimeType || "image/jpeg",
        name: photo.name,
        updatedAt: Date.now(),
      } satisfies VaultPhoto);
    });
  } catch {
    // quota / private mode
  }
}

export async function getPhotoFromVault(
  id: string,
): Promise<VaultPhoto | null> {
  if (!id) return null;
  try {
    const row = await withStore<VaultPhoto>("readonly", (store) =>
      store.get(id),
    );
    return row && row.dataUrl ? row : null;
  } catch {
    return null;
  }
}

/** Attachment / legacy image keys stored in the vault for one chat. */
export function vaultIdsFromConversation(
  conversation: ConversationRecord,
): string[] {
  const ids: string[] = [];
  for (const m of conversation.messages || []) {
    for (const a of m.attachments || []) {
      if (a.id) ids.push(a.id);
    }
    ids.push(`${m.id}-img`);
  }
  return ids;
}

export function vaultIdsFromStore(store: ConversationsStore): Set<string> {
  const ids = new Set<string>();
  for (const c of store.conversations || []) {
    for (const id of vaultIdsFromConversation(c)) ids.add(id);
  }
  return ids;
}

/** Remove specific vault entries (call when a chat is deleted). */
export async function deletePhotosFromVault(ids: string[]): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return 0;
  let removed = 0;
  try {
    await withStore("readwrite", (store) => {
      for (const id of unique) {
        store.delete(id);
        removed += 1;
      }
    });
  } catch {
    return 0;
  }
  return removed;
}

/**
 * Drop vault photos that are no longer referenced by any local chat.
 * Safe to run after hydrate / delete.
 */
export async function pruneVaultToStore(
  store: ConversationsStore,
): Promise<number> {
  const keep = vaultIdsFromStore(store);
  try {
    const db = await openDb();
    const allIds = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => {
        resolve((req.result as IDBValidKey[]).map((k) => String(k)));
      };
      req.onerror = () => reject(req.error || new Error("getAllKeys failed"));
      tx.onerror = () => reject(tx.error || new Error("idb tx failed"));
    });
    try {
      db.close();
    } catch {
      // ignore
    }
    const orphans = allIds.filter((id) => !keep.has(id));
    if (!orphans.length) return 0;
    return deletePhotosFromVault(orphans);
  } catch {
    return 0;
  }
}

/** Save every attachment dataUrl found in a conversations store. */
export async function ingestStorePhotos(
  store: ConversationsStore,
): Promise<number> {
  let n = 0;
  for (const c of store.conversations || []) {
    for (const m of c.messages || []) {
      for (const a of m.attachments || []) {
        if (a.dataUrl) {
          await putPhotoInVault({
            id: a.id,
            dataUrl: a.dataUrl,
            mimeType: a.mimeType,
            name: a.name,
          });
          n += 1;
        }
      }
      if (m.image?.dataUrl) {
        await putPhotoInVault({
          id: `${m.id}-img`,
          dataUrl: m.image.dataUrl,
          mimeType: m.image.mimeType,
          name: "photo",
        });
        n += 1;
      }
    }
  }
  return n;
}

/** Fill missing attachment dataUrls from the vault (returns a new store). */
export async function restoreStorePhotosFromVault(
  store: ConversationsStore,
): Promise<ConversationsStore> {
  const conversations: ConversationRecord[] = [];
  const staleBinaryIds: string[] = [];
  for (const c of store.conversations) {
    const messages: ChatMessage[] = [];
    for (const m of c.messages) {
      let attachments = m.attachments;
      if (attachments?.length) {
        const next: ChatAttachment[] = [];
        for (const a of attachments) {
          if (!a.dataUrl) {
            // Large binaries (video/PDF/Office) are data-only by design and
            // never rehydrate from the vault — a multi-MB base64 dataUrl would
            // re-trigger the phone OOM reload loop. Drop any stale vault entry
            // an older client may have written.
            if (isLargeBinaryAttachment(a.mimeType, a.name)) {
              staleBinaryIds.push(a.id);
              next.push(a);
              continue;
            }
            const hit = await getPhotoFromVault(a.id);
            if (hit?.dataUrl) {
              next.push({ ...a, dataUrl: hit.dataUrl });
              continue;
            }
          }
          next.push(a);
        }
        attachments = next;
      }
      let image = m.image;
      if (image && !image.dataUrl) {
        const hit = await getPhotoFromVault(`${m.id}-img`);
        if (hit?.dataUrl) {
          image = {
            dataUrl: hit.dataUrl,
            mimeType: hit.mimeType || image.mimeType,
          };
        }
      }
      messages.push({
        ...m,
        ...(attachments ? { attachments } : {}),
        ...(image ? { image } : {}),
      });
    }
    conversations.push({ ...c, messages });
  }
  if (staleBinaryIds.length) {
    void deletePhotosFromVault(staleBinaryIds);
  }
  return { ...store, conversations };
}

/**
 * For attachments that have a mediaId but no dataUrl (e.g. photos uploaded
 * from another device), fetch the binary from the server media store and
 * construct a dataUrl, then cache it in the local vault for next time.
 */
export async function fetchMissingPhotosFromServer(
  store: ConversationsStore,
): Promise<ConversationsStore> {
  let changed = false;
  const conversations: ConversationRecord[] = [];
  for (const c of store.conversations) {
    const messages: ChatMessage[] = [];
    for (const m of c.messages) {
      let msgChanged = false;
      let attachments = m.attachments;
      if (attachments?.length) {
        const next: ChatAttachment[] = [];
        for (const a of attachments) {
          // Large binaries (video/PDF/Office) never hydrate into a dataUrl —
          // they stream/download via /api/media. Fetching a 54MB video just to
          // build a base64 dataUrl is what crashed phones.
          if (isLargeBinaryAttachment(a.mimeType, a.name)) {
            next.push(a);
            continue;
          }
          if (!a.dataUrl && a.mediaId) {
            try {
              const res = await fetch(
                `/api/media/${encodeURIComponent(a.mediaId)}`,
                { cache: "force-cache" },
              );
              if (res.ok) {
                const blob = await res.blob();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                // Cache in vault so next restoreStorePhotosFromVault picks it up
                void putPhotoInVault({
                  id: a.id,
                  dataUrl,
                  mimeType: a.mimeType || blob.type || "image/jpeg",
                  name: a.name,
                }).catch(() => {});
                next.push({ ...a, dataUrl });
                changed = true;
                msgChanged = true;
                continue;
              }
            } catch {
              // Server offline, keep mediaId reference but no dataUrl
            }
          }
          next.push(a);
        }
        if (msgChanged) attachments = next;
      }
      messages.push({
        ...m,
        ...(attachments ? { attachments } : {}),
      });
    }
    conversations.push({ ...c, messages });
  }
  return changed ? { ...store, conversations } : store;
}
