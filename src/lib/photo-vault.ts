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

/** Save every image dataUrl found in a conversations store. */
export async function ingestStorePhotos(
  store: ConversationsStore,
): Promise<number> {
  let n = 0;
  for (const c of store.conversations || []) {
    for (const m of c.messages || []) {
      for (const a of m.attachments || []) {
        if (a.kind === "image" && a.dataUrl) {
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
  for (const c of store.conversations) {
    const messages: ChatMessage[] = [];
    for (const m of c.messages) {
      let attachments = m.attachments;
      if (attachments?.length) {
        const next: ChatAttachment[] = [];
        for (const a of attachments) {
          if (a.kind === "image" && !a.dataUrl) {
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
  return { ...store, conversations };
}
