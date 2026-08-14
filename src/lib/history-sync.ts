import type { ConversationRecord, ConversationsStore } from "./types";
import { mergeConversationLists, mergeMessageAttachments } from "./history-merge";
import { RYAN_ACCOUNT } from "./tenant-storage";

const TOMBSTONE_TTL_MS = 30 * 86400 * 1000;

/**
 * Last-known server deletion map, refreshed by hydrateFromServer /
 * deleteServerChat. Used by pushStoreToServer so a stale local copy of a
 * conversation that was deleted on another device is never re-uploaded.
 */
let deletionCache: Record<string, number> = {};

function hasFreshTombstone(sessionId: string, now: number = Date.now()): boolean {
  const ts = deletionCache[sessionId];
  return typeof ts === "number" && now - ts < TOMBSTONE_TTL_MS;
}

/** Test-only: reset the cached deletion map. */
export function __resetDeletionCacheForTests(log: Record<string, number> = {}): void {
  deletionCache = log;
}

/** Pull account-scoped history from the server. */
export async function fetchServerHistory(accountId: string = RYAN_ACCOUNT): Promise<{
  conversations: ConversationRecord[];
  deletions: Record<string, number>;
}> {
  const res = await fetch(`/api/history?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`history HTTP ${res.status}`);
  const data = (await res.json()) as { conversations?: ConversationRecord[]; deletions?: Record<string, number> };
  return {
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
    deletions: data.deletions && typeof data.deletions === "object" ? data.deletions : {},
  };
}

/** Collect all mediaIds referenced in conversations. */
export function collectStoreMediaIds(store: ConversationsStore): string[] {
  const ids = new Set<string>();
  for (const c of store.conversations) {
    for (const m of c.messages) {
      for (const a of m.attachments || []) {
        if (a.mediaId) ids.add(a.mediaId);
      }
    }
  }
  return [...ids];
}

/** Query /api/media/check to find which mediaIds are missing on server. */
export async function checkMissingMedia(mediaIds: string[]): Promise<Set<string>> {
  if (!mediaIds.length) return new Set();
  try {
    const qs = mediaIds.slice(0, 500).join(",");
    const res = await fetch(`/api/media/check?ids=${encodeURIComponent(qs)}`);
    if (!res.ok) return new Set();
    const data = (await res.json()) as { missing?: string[] };
    return new Set(data.missing || []);
  } catch {
    return new Set();
  }
}

/**
 * Re-persist conversations whose attachments have dataUrl but are not yet
 * saved server-side. Covers two cases:
 *
 * 1. mediaId exists but the media file is missing on the server (orphaned by
 *    a failed write / data/media wipe) — re-uploads if the browser still has
 *    the dataUrl (vault/localStorage).
 * 2. mediaId is absent entirely (the server never persisted this attachment,
 *    e.g. the write failed during an earlier push) — uploads it now so the
 *    server generates a mediaId.
 *
 * Videos fall through the same path whenever their dataUrl is still present
 * (e.g. recovered from the IndexedDB vault); video-only clients that dropped
 * the dataUrl for memory reasons can only be re-uploaded by the user.
 */
export async function repairMissingMedia(
  store: ConversationsStore,
  accountId: string = RYAN_ACCOUNT,
): Promise<{ repaired: number; store: ConversationsStore }> {
  // Conversations that carry dataUrl attachments (with or without mediaId).
  const candidates: ConversationRecord[] = [];
  for (const c of store.conversations) {
    const hasDataUrl = (c.messages || []).some((m) =>
      (m.attachments || []).some((a) => a.dataUrl),
    );
    if (hasDataUrl) candidates.push(c);
  }
  if (!candidates.length) return { repaired: 0, store };

  // Check which mediaIds are missing on the server.
  const missing = await checkMissingMedia(collectStoreMediaIds(store));

  // Repair attachments that are either server-missing (mediaId known) or
  // never uploaded (no mediaId yet).
  const toRepair = candidates.filter((c) =>
    c.messages.some((m) =>
      (m.attachments || []).some(
        (a) => a.dataUrl && (!a.mediaId || missing.has(a.mediaId)),
      ),
    ),
  );

  if (!toRepair.length) return { repaired: 0, store };

  try {
    const res = await fetch("/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, conversations: toRepair }),
    });
    if (!res.ok) return { repaired: 0, store };
    const data = (await res.json()) as {
      conversations?: ConversationRecord[];
    };
    const repaired = Array.isArray(data.conversations)
      ? data.conversations.length
      : 0;
    const updated = repaired
      ? applyServerMediaIds(store, data.conversations!)
      : store;
    return { repaired, store: updated };
  } catch {
    return { repaired: 0, store };
  }
}

/** Merge server list into the local store (server is shared across devices). */
export async function hydrateFromServer(
  local: ConversationsStore,
  accountId: string = RYAN_ACCOUNT,
): Promise<ConversationsStore> {
  try {
    const { conversations: remote, deletions } = await fetchServerHistory(accountId);
    deletionCache = deletions;
    // Filter out tombstoned conversations from local store
    const now = Date.now();
    const filteredLocal = local.conversations.filter((c) => {
      const ts = deletions[c.sessionId];
      if (typeof ts !== "number") return true;
      // Keep if tombstone is older than 30 days (expired)
      return now - ts > TOMBSTONE_TTL_MS;
    });
    return mergeConversationLists(
      filteredLocal,
      remote,
      local.activeId,
    );
  } catch {
    return local;
  }
}

/** Copy mediaId from server-saved chats onto the local store. */
function applyServerMediaIds(
  local: ConversationsStore,
  saved: ConversationRecord[],
): ConversationsStore {
  if (!saved.length) return local;
  const byId = new Map(saved.map((c) => [c.sessionId, c]));
  let changed = false;
  const conversations = local.conversations.map((c) => {
    const s = byId.get(c.sessionId);
    if (!s) return c;
    const messages = mergeMessageAttachments(c.messages, s.messages);
    for (let i = 0; i < messages.length; i += 1) {
      const before = c.messages[i]?.attachments || [];
      const after = messages[i]?.attachments || [];
      for (let j = 0; j < after.length; j += 1) {
        if (after[j]?.mediaId && after[j]?.mediaId !== before[j]?.mediaId) {
          changed = true;
        }
        if (after[j]?.dataUrl && after[j]?.dataUrl !== before[j]?.dataUrl) {
          changed = true;
        }
      }
    }
    return { ...c, messages };
  });
  return changed ? { ...local, conversations } : local;
}

/** Push non-empty chats to the shared server store (persists homework photos). */
export async function pushStoreToServer(
  store: ConversationsStore,
  accountId: string = RYAN_ACCOUNT,
): Promise<ConversationsStore> {
  const conversations = store.conversations.filter(
    (c) => c.messages.length > 0 && !hasFreshTombstone(c.sessionId),
  );
  if (!conversations.length) return store;
  try {
    const res = await fetch("/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, conversations }),
    });
    if (!res.ok) return store;
    const data = (await res.json()) as {
      conversations?: ConversationRecord[];
    };
    if (Array.isArray(data.conversations) && data.conversations.length) {
      return applyServerMediaIds(store, data.conversations);
    }
  } catch {
    // offline / ignore — localStorage still has a copy
  }
  return store;
}

export async function deleteServerChat(sessionId: string, accountId: string = RYAN_ACCOUNT): Promise<void> {
  try {
    const res = await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}&accountId=${encodeURIComponent(accountId)}`, {
      method: "DELETE",
    });
    // Remember the deletion locally so this device won't re-upload the chat
    // before the next hydration refreshes the server-side tombstone map.
    deletionCache[sessionId] = Date.now();
    if (!res.ok) throw new Error(`delete HTTP ${res.status}`);
  } catch {
    // ignore
  }
}
