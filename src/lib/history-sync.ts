import type { ConversationRecord, ConversationsStore } from "./types";
import { mergeConversationLists, mergeMessageAttachments } from "./history-merge";

/** Pull global history from the server. */
export async function fetchServerHistory(): Promise<ConversationRecord[]> {
  const res = await fetch("/api/history", { cache: "no-store" });
  if (!res.ok) throw new Error(`history HTTP ${res.status}`);
  const data = (await res.json()) as { conversations?: ConversationRecord[] };
  return Array.isArray(data.conversations) ? data.conversations : [];
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
