import type { ConversationRecord, ConversationsStore } from "./types";
import { mergeConversationLists } from "./history-merge";

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

/** Push non-empty chats to the shared server store. */
export async function pushStoreToServer(
  store: ConversationsStore,
): Promise<void> {
  const conversations = store.conversations.filter((c) => c.messages.length > 0);
  if (!conversations.length) return;
  try {
    await fetch("/api/history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversations }),
    });
  } catch {
    // offline / ignore — localStorage still has a copy
  }
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
