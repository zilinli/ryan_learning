import type {
  ChatAttachment,
  ChatMessage,
  ConversationRecord,
  ConversationsStore,
} from "./types";
import {
  MAX_CONVERSATIONS,
  newSessionId,
  slimMessages,
  titleFromMessages,
} from "./storage";

/** Prefer attachment copies that still have homework photo dataUrls. */
export function mergeMessageAttachments(
  preferred: ChatMessage[],
  fallback: ChatMessage[],
): ChatMessage[] {
  if (!fallback.length) return preferred;
  const byId = new Map(fallback.map((m) => [m.id, m]));
  return preferred.map((m) => {
    const other = byId.get(m.id);
    if (!other) return m;

    let attachments = m.attachments;
    if (m.attachments?.length || other.attachments?.length) {
      const otherAtt = new Map(
        (other.attachments || []).map((a) => [a.id, a]),
      );
      const base = m.attachments?.length
        ? m.attachments
        : other.attachments || [];
      attachments = base.map((a) => {
        const o = otherAtt.get(a.id);
        if (!a.dataUrl && o?.dataUrl) {
          return { ...a, dataUrl: o.dataUrl } satisfies ChatAttachment;
        }
        if (!a.mediaId && o?.mediaId) {
          return { ...a, mediaId: o.mediaId } satisfies ChatAttachment;
        }
        if (!m.attachments?.length && o) return o;
        return a;
      });
    }

    const image =
      m.image?.dataUrl
        ? m.image
        : other.image?.dataUrl
          ? other.image
          : m.image || other.image;

    return {
      ...m,
      ...(attachments?.length ? { attachments } : {}),
      ...(image ? { image } : {}),
    };
  });
}

function pickRicherConversation(
  a: ConversationRecord,
  b: ConversationRecord,
): ConversationRecord {
  // Newer updatedAt wins for text/history; then restore any photo bytes from the other.
  let winner = a;
  let loser = b;
  if (b.updatedAt > a.updatedAt) {
    winner = b;
    loser = a;
  } else if (
    b.updatedAt === a.updatedAt &&
    (b.messages?.length || 0) > (a.messages?.length || 0)
  ) {
    winner = b;
    loser = a;
  }
  return {
    ...winner,
    messages: mergeMessageAttachments(winner.messages || [], loser.messages || []),
  };
}

/**
 * Merge local + server conversations into one global list.
 * Newer updatedAt wins; ties prefer more messages.
 * Photo dataUrls from either side are kept so homework stays viewable.
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
    map.set(c.sessionId, pickRicherConversation(prev, c));
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
