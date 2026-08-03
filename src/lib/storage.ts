import type {
  ChatMessage,
  ConversationRecord,
  ConversationsStore,
  TutorSessionState,
} from "./types";
import {
  enforceHistoryRetention,
  MAX_TOTAL_MESSAGES,
} from "./history-retention";

const LEGACY_KEY = "spark-tutor-session-v2";
const STORE_KEY = "spark-tutor-sessions-v3";

/** Hard caps so localStorage + RAM stay small on phones */
export const MAX_CONVERSATIONS = 100;
export const MAX_MESSAGES_PER_CHAT = 80;
const MAX_CONTENT_CHARS = 32_000;
const MAX_TITLE_LEN = 42;

export { MAX_TOTAL_MESSAGES };

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function titleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user" && m.content.trim());
  if (first?.content.trim()) {
    const t = first.content.replace(/\s+/g, " ").trim();
    return t.length > MAX_TITLE_LEN ? `${t.slice(0, MAX_TITLE_LEN - 1)}…` : t;
  }
  const withFile = messages.find((m) => m.attachments?.length || m.image);
  if (withFile) return "Homework photos";
  return "New chat";
}

function slimAttachment(a: NonNullable<ChatMessage["attachments"]>[number]) {
  return {
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    kind: a.kind,
    ...(a.mediaId ? { mediaId: a.mediaId } : {}),
  };
}

/**
 * Truncate prose but never cut through an SVG markdown image mid-URI.
 * Truncating a data:image/svg+xml URI mid-stream makes the figure vanish after save.
 */
export function truncateMessageContent(
  content: string,
  max = MAX_CONTENT_CHARS,
): string {
  if (content.length <= max) return content;
  const diagramRe = /!\[[^\]]*\]\(data:image\/svg\+xml(?:;base64)?,[^)]+\)/gi;
  const diagrams = [...content.matchAll(diagramRe)].map((m) => m[0]);
  if (diagrams.length > 0) {
    const without = content.replace(diagramRe, "\n");
    const diagramBlock = diagrams.join("\n\n");
    const proseMax = Math.max(200, max - diagramBlock.length - 4);
    const trimmedProse =
      without.length > proseMax
        ? `${without.slice(0, proseMax).trimEnd()}…`
        : without.trim();
    // Always keep full diagram URIs (append after truncated prose)
    return `${trimmedProse}\n\n${diagramBlock}`.trim();
  }
  return `${content.slice(0, max)}…`;
}

/**
 * Trim message text / file payloads for storage.
 * Image **and file** dataUrls stay on the client so history can reopen / download
 * attachments (server sync still strips base64 and keeps mediaId).
 */
export function slimMessages(
  messages: ChatMessage[],
  keepPreviews: boolean,
): ChatMessage[] {
  const trimmed = messages.slice(-MAX_MESSAGES_PER_CHAT);
  return trimmed.map((m) => {
    const content = truncateMessageContent(m.content);
    const attachments = m.attachments?.map((a) => {
      if (a.dataUrl) return a;
      return keepPreviews ? a : slimAttachment(a);
    });
    const image =
      m.image?.dataUrl
        ? m.image
        : keepPreviews && m.image
          ? m.image
          : m.image
            ? { dataUrl: "", mimeType: m.image.mimeType }
            : undefined;
    return {
      id: m.id,
      role: m.role,
      content,
      createdAt: m.createdAt,
      ...(attachments?.length ? { attachments } : {}),
      ...(image && image.dataUrl ? { image } : {}),
    };
  });
}

function pruneStore(store: ConversationsStore): ConversationsStore {
  // Drop empty non-active chats
  let list = store.conversations.filter(
    (c) => c.sessionId === store.activeId || c.messages.length > 0,
  );

  // Global message + size retention (keep newest ~1k messages)
  list = enforceHistoryRetention(list, {
    maxMessages: MAX_TOTAL_MESSAGES,
  });

  // LRU by updatedAt — keep active always
  if (list.length > MAX_CONVERSATIONS) {
    const active = list.find((c) => c.sessionId === store.activeId);
    const rest = list
      .filter((c) => c.sessionId !== store.activeId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS - 1);
    list = active ? [active, ...rest] : rest.slice(0, MAX_CONVERSATIONS);
  }

  // Ensure active empty draft survives retention if it was filtered out
  if (
    store.activeId &&
    !list.some((c) => c.sessionId === store.activeId)
  ) {
    const active = store.conversations.find(
      (c) => c.sessionId === store.activeId,
    );
    if (active) list = [active, ...list].slice(0, MAX_CONVERSATIONS);
  }

  const conversations = list.map((c) => {
    const keepPreviews = c.sessionId === store.activeId;
    const messages = slimMessages(c.messages, keepPreviews);
    return {
      ...c,
      title: c.title || titleFromMessages(messages),
      messages,
    };
  });

  let activeId = store.activeId;
  if (!conversations.some((c) => c.sessionId === activeId)) {
    activeId = conversations[0]?.sessionId ?? "";
  }

  return { version: 3, activeId, conversations };
}

function emptyStore(): ConversationsStore {
  const id = newSessionId();
  return {
    version: 3,
    activeId: id,
    conversations: [
      {
        sessionId: id,
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  };
}

function migrateLegacy(legacy: TutorSessionState): ConversationsStore {
  return {
    version: 3,
    activeId: legacy.sessionId,
    conversations: [
      {
        sessionId: legacy.sessionId,
        title: titleFromMessages(legacy.messages || []),
        messages: legacy.messages || [],
        createdAt: legacy.updatedAt || Date.now(),
        updatedAt: legacy.updatedAt || Date.now(),
      },
    ],
  };
}

export function loadConversations(): ConversationsStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConversationsStore;
      if (parsed?.version === 3 && Array.isArray(parsed.conversations)) {
        return pruneStore(parsed);
      }
    }
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as TutorSessionState;
      if (legacy?.sessionId) {
        const migrated = pruneStore(migrateLegacy(legacy));
        saveConversations(migrated);
        localStorage.removeItem(LEGACY_KEY);
        return migrated;
      }
    }
  } catch {
    // ignore
  }
  return emptyStore();
}

export function saveConversations(store: ConversationsStore): void {
  if (typeof window === "undefined") return;
  const pruned = pruneStore(store);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(pruned));
  } catch {
    // Quota exceeded — drop oldest inactive chats and strip all previews
    try {
      const aggressive: ConversationsStore = {
        ...pruned,
        conversations: pruned.conversations
          .sort((a, b) => {
            if (a.sessionId === pruned.activeId) return -1;
            if (b.sessionId === pruned.activeId) return 1;
            return b.updatedAt - a.updatedAt;
          })
          .slice(0, Math.min(8, MAX_CONVERSATIONS))
          .map((c) => ({
            ...c,
            messages: slimMessages(c.messages, false),
          })),
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(aggressive));
    } catch {
      // private mode / hard fail
    }
  }
}

export function getActiveConversation(
  store: ConversationsStore,
): ConversationRecord {
  return (
    store.conversations.find((c) => c.sessionId === store.activeId) ||
    store.conversations[0]!
  );
}

/** @deprecated — use loadConversations */
export function loadSession(): TutorSessionState | null {
  const store = loadConversations();
  const active = getActiveConversation(store);
  if (!active) return null;
  return {
    sessionId: active.sessionId,
    messages: active.messages,
    updatedAt: active.updatedAt,
  };
}

/** @deprecated */
export function saveSession(state: TutorSessionState): void {
  const store = loadConversations();
  const idx = store.conversations.findIndex(
    (c) => c.sessionId === state.sessionId,
  );
  const record: ConversationRecord = {
    sessionId: state.sessionId,
    title: titleFromMessages(state.messages),
    messages: state.messages,
    createdAt:
      idx >= 0 ? store.conversations[idx]!.createdAt : state.updatedAt,
    updatedAt: state.updatedAt,
  };
  if (idx >= 0) store.conversations[idx] = record;
  else store.conversations.unshift(record);
  store.activeId = state.sessionId;
  saveConversations(store);
}

/** @deprecated */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(STORE_KEY);
}
