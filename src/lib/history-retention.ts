import type { ConversationRecord } from "./types";

/** Global retention: keep roughly the newest N messages across all chats. */
export const MAX_TOTAL_MESSAGES = 2_000;
/** Soft disk budget for server history JSON only (photos live under data/media). */
export const MAX_HISTORY_BYTES = 12 * 1024 * 1024;

export type HistorySearchHit = {
  conversation: ConversationRecord;
  matchedTitle: boolean;
  snippet?: string;
};

function normalizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function includesAll(haystack: string, tokens: string[]): boolean {
  const h = haystack.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

/** Short excerpt around the first matched token. */
export function makeSearchSnippet(
  text: string,
  token: string,
  radius = 42,
): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(token.toLowerCase());
  if (idx < 0) {
    const t = text.replace(/\s+/g, " ").trim();
    return t.length > radius * 2 ? `${t.slice(0, radius * 2)}…` : t;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + token.length + radius);
  let snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = `…${snip}`;
  if (end < text.length) snip = `${snip}…`;
  return snip;
}

/**
 * Filter chats by keyword (title + message bodies).
 * Empty query returns all chats (no snippets).
 */
export function searchConversations(
  conversations: ConversationRecord[],
  query: string,
): HistorySearchHit[] {
  const tokens = normalizeQuery(query);
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  if (!tokens.length) {
    return sorted.map((conversation) => ({
      conversation,
      matchedTitle: false,
    }));
  }

  const hits: HistorySearchHit[] = [];
  for (const conversation of sorted) {
    const title = conversation.title || "";
    const matchedTitle = includesAll(title, tokens);
    let snippet: string | undefined;

    // Newest messages first for a useful snippet
    for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
      const content = conversation.messages[i]?.content || "";
      if (includesAll(content, tokens)) {
        snippet = makeSearchSnippet(content, tokens[0]!);
        break;
      }
    }

    // Also match attachment file names
    if (!snippet) {
      outer: for (const m of conversation.messages) {
        for (const a of m.attachments || []) {
          if (includesAll(a.name || "", tokens)) {
            snippet = `📎 ${a.name}`;
            break outer;
          }
        }
      }
    }

    if (matchedTitle || snippet) {
      hits.push({ conversation, matchedTitle, snippet });
    }
  }
  return hits;
}

export function countMessages(conversations: ConversationRecord[]): number {
  return conversations.reduce((n, c) => n + (c.messages?.length || 0), 0);
}

export function estimateHistoryBytes(
  conversations: ConversationRecord[],
): number {
  const json = JSON.stringify(conversations);
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(json, "utf8");
  }
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(json).length;
  }
  return json.length * 2;
}

/**
 * Keep newest conversations' newest messages until under the message budget.
 * Oldest chats are dropped entirely once the budget is consumed.
 */
export function pruneConversationsByMessageBudget(
  conversations: ConversationRecord[],
  maxMessages: number = MAX_TOTAL_MESSAGES,
): ConversationRecord[] {
  if (maxMessages <= 0) return [];
  const total = countMessages(conversations);
  if (total <= maxMessages) {
    return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  let remaining = maxMessages;
  const kept: ConversationRecord[] = [];

  for (const c of sorted) {
    if (remaining <= 0) break;
    const msgs = c.messages || [];
    if (!msgs.length) continue;
    const slice =
      msgs.length > remaining ? msgs.slice(msgs.length - remaining) : msgs;
    remaining -= slice.length;
    kept.push({
      ...c,
      messages: slice,
      title: c.title,
    });
  }
  return kept;
}

/**
 * If estimated size exceeds the byte budget, drop oldest conversations.
 */
export function pruneConversationsByBytes(
  conversations: ConversationRecord[],
  maxBytes: number = MAX_HISTORY_BYTES,
): ConversationRecord[] {
  let list = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  while (list.length > 1 && estimateHistoryBytes(list) > maxBytes) {
    list = list.slice(0, -1); // drop oldest (end of newest-first list)
  }
  // If a single huge chat remains, trim its oldest messages
  if (list.length === 1 && estimateHistoryBytes(list) > maxBytes) {
    const only = list[0]!;
    let msgs = [...(only.messages || [])];
    while (
      msgs.length > 1 &&
      estimateHistoryBytes([{ ...only, messages: msgs }]) > maxBytes
    ) {
      msgs = msgs.slice(1);
    }
    return [{ ...only, messages: msgs }];
  }
  return list;
}

/** Apply message + byte retention in one pass. */
export function enforceHistoryRetention(
  conversations: ConversationRecord[],
  opts: { maxMessages?: number; maxBytes?: number } = {},
): ConversationRecord[] {
  const byMsg = pruneConversationsByMessageBudget(
    conversations,
    opts.maxMessages ?? MAX_TOTAL_MESSAGES,
  );
  return pruneConversationsByBytes(byMsg, opts.maxBytes ?? MAX_HISTORY_BYTES);
}
