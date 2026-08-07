import type { ConversationRecord, ConversationsStore } from "./types";
import { mergeConversationLists, mergeMessageAttachments } from "./history-merge";
import { RYAN_ACCOUNT } from "./tenant-storage";

/** Pull account-scoped history from the server. */
export async function fetchServerHistory(accountId: string = RYAN_ACCOUNT): Promise<ConversationRecord[]> {
  const res = await fetch(`/api/history?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`history HTTP ${res.status}`);
  const data = (await res.json()) as { conversations?: ConversationRecord[] };
  return Array.isArray(data.conversations) ? data.conversations : [];
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
 * Re-persist conversations where attachments have dataUrl but media files
 * are missing on the server. This repairs orphaned media references after a
 * server rebuild or data/media wipe.
 */
export async function repairMissingMedia(
  store: ConversationsStore,
): Promise<{ repaired: number; store: ConversationsStore }> {
  // Collect conversations that have dataUrl attachments with mediaIds
  const candidates: ConversationRecord[] = [];
  for (const c of store.conversations) {
    let hasDataUrl = false;
    for (const m of c.messages) {
      for (const a of m.attachments || []) {
        if (a.mediaId && a.dataUrl) {
          hasDataUrl = true;
        }
      }
    }
    if (hasDataUrl) {
      candidates.push(c);
    }
  }

  if (!candidates.length) return { repaired: 0, store };

  // Check which mediaIds are missing on the server
  const allIds = collectStoreMediaIds(store);
  const missing = await checkMissingMedia(allIds);

  if (!missing.size) return { repaired: 0, store };

  // Filter to only conversations that have missing media files
  const toRepair = candidates.filter((c) =>
    c.messages.some((m) =>
      (m.attachments || []).some(
        (a) => a.mediaId && a.dataUrl && missing.has(a.mediaId),
      ),
    ),
  );

  if (!toRepair.length) return { repaired: 0, store };

  try {
    const res = await fetch("/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations: toRepair }),
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
): Promise<ConversationsStore> {
  try {
    const remote = await fetchServerHistory();
    return mergeConversationLists(
      local.conversations,
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
): Promise<ConversationsStore> {
  const conversations = store.conversations.filter((c) => c.messages.length > 0);
  if (!conversations.length) return store;
  try {
    const res = await fetch("/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations }),
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

export async function deleteServerChat(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/history?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  } catch {
    // ignore
  }
}
