import {
  MAX_MESSAGES_PER_CHAT,
  titleFromMessages,
} from "@/lib/storage";
import { preferCompleteTutorText, hasTutorDiagram } from "@/lib/tutor-text-filter";
import type {
  ChatMessage,
  ConversationRecord,
  ConversationsStore,
  HistoryTurn,
} from "@/lib/types";

export function messageId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildHistoryPreview(messages: ChatMessage[]): HistoryTurn[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content.trim())
    .slice(-8)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.replace(/\s+/g, " ").trim().slice(0, 500),
      ...(m.role === "user" &&
      m.attachments?.some((a) => a.kind === "image" && a.dataUrl)
        ? {
            images: m.attachments
              .filter(
                (a): a is typeof a & { dataUrl: string } =>
                  a.kind === "image" && !!a.dataUrl,
              )
              .map((a) => ({
                name: a.name,
                mimeType: a.mimeType,
                data: a.dataUrl.replace(/^data:image\/\w+;base64,/, ""),
              })),
          }
        : undefined),
    }));
}

export async function consumeChatStream(
  body: unknown,
  onDelta: (text: string) => void,
  onStatus?: (status: string) => void,
  onReplace?: (text: string) => void,
): Promise<string> {
  const payload = JSON.stringify(body);

  const readStream = async (res: Response): Promise<string> => {
    if (!res.body) throw new Error(`Request failed (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let streamError = "";

    const paint = () =>
      new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      let gotDelta = false;
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) dataLine += line.slice(5).trim();
        }
        if (!dataLine) continue;
        const data = JSON.parse(dataLine) as {
          text?: string;
          error?: string;
          status?: string;
        };
        if (event === "delta" && data.text) {
          full += data.text;
          onDelta(data.text);
          gotDelta = true;
        }
        if (event === "status" && data.status) {
          onStatus?.(data.status);
        }
        if (event === "error" && data.error) {
          streamError = data.error;
        }
        if (event === "done" && data.text) {
          let preferred = preferCompleteTutorText(full, data.text);
          if (hasTutorDiagram(full) && !hasTutorDiagram(preferred)) {
            preferred = full;
          }
          if (!full) {
            full = preferred;
            onDelta(preferred);
            gotDelta = true;
          } else if (preferred !== full) {
            full = preferred;
            onReplace?.(preferred);
            gotDelta = true;
          }
        }
      }
      if (gotDelta) await paint();
    }

    if (streamError) throw new Error(streamError);
    return full;
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    if (res.ok) {
      return readStream(res);
    }

    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    const msg = data?.error || `Request failed (${res.status})`;
    const retryable =
      attempt === 0 &&
      (res.status === 400 || res.status === 502 || res.status === 503) &&
      (!data?.error || /invalid json|bad request/i.test(msg));
    if (retryable) {
      await new Promise((r) => setTimeout(r, 350));
      continue;
    }
    throw new Error(msg);
  }

  throw new Error("Request failed");
}

export function upsertActive(
  store: ConversationsStore,
  patch: Partial<ConversationRecord> & { messages?: ChatMessage[] },
): ConversationsStore {
  const now = Date.now();
  const idx = store.conversations.findIndex(
    (c) => c.sessionId === store.activeId,
  );
  const prev =
    idx >= 0
      ? store.conversations[idx]!
      : {
          sessionId: store.activeId,
          title: "New chat",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

  let messages = patch.messages ?? prev.messages;
  if (messages.length > MAX_MESSAGES_PER_CHAT) {
    messages = messages.slice(-MAX_MESSAGES_PER_CHAT);
  }

  const next: ConversationRecord = {
    ...prev,
    ...patch,
    messages,
    title: titleFromMessages(messages),
    updatedAt: now,
  };

  const conversations = [...store.conversations];
  if (idx >= 0) conversations[idx] = next;
  else conversations.unshift(next);

  return { ...store, conversations };
}
