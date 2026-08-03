import type { ConversationRecord, ConversationsStore } from "./types";
import {
  MAX_CONVERSATIONS,
  newSessionId,
  slimMessages,
  titleFromMessages,
} from "./storage";

/**
 * Merge local + server conversations into one global list.
 * Newer updatedAt wins; ties prefer more messages.
 */
export function mergeConversationLists(
  local: ConversationRecord[],
  remote: ConversationRecord[],
  preferredActiveId?: string,
): ConversationsStore {
  const map = new Map<string, ConversationRecord>();

  const consider = (c: ConversationRecord) => {
    if (!c?.sessionId) return;
    const prev = map.get(c.sessionId);
    if (!prev) {
      map.set(c.sessionId, c);
      return;
    }
    if (c.updatedAt > prev.updatedAt) {
      map.set(c.sessionId, c);
      return;
    }
    if (
      c.updatedAt === prev.updatedAt &&
      (c.messages?.length || 0) > (prev.messages?.length || 0)
    ) {
      map.set(c.sessionId, c);
    }
  };

  // Remote first, then local (local can override when newer)
  for (const c of remote) consider(c);
  for (const c of local) consider(c);

  let list = [...map.values()].filter(
    (c) => c.messages.length > 0 || c.sessionId === preferredActiveId,
  );
  list.sort((a, b) => b.updatedAt - a.updatedAt);

  if (list.length > MAX_CONVERSATIONS) {
    const active = preferredActiveId
      ? list.find((c) => c.sessionId === preferredActiveId)
      : undefined;
    const rest = list
      .filter((c) => c.sessionId !== preferredActiveId)
      .slice(0, MAX_CONVERSATIONS - (active ? 1 : 0));
    list = active ? [active, ...rest] : rest;
  }

  const conversations = list.map((c) => ({
    ...c,
    title: c.title || titleFromMessages(c.messages),
    messages: slimMessages(c.messages, c.sessionId === preferredActiveId),
  }));

  let activeId = preferredActiveId || "";
  if (!conversations.some((c) => c.sessionId === activeId)) {
    activeId = conversations[0]?.sessionId || newSessionId();
  }

  if (!conversations.length) {
    const id = newSessionId();
    const now = Date.now();
    return {
      version: 3,
      activeId: id,
      conversations: [
        {
          sessionId: id,
          title: "New chat",
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  }

  // Ensure preferred empty active chat still exists when merging
  if (
    preferredActiveId &&
    !conversations.some((c) => c.sessionId === preferredActiveId)
  ) {
    const localActive = local.find((c) => c.sessionId === preferredActiveId);
    if (localActive) {
      conversations.unshift({
        ...localActive,
        title: localActive.title || "New chat",
        messages: slimMessages(localActive.messages, true),
      });
      activeId = preferredActiveId;
    }
  }

  return { version: 3, activeId, conversations };
}
