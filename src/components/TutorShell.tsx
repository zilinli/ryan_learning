"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { HistorySidebar } from "./HistorySidebar";
import { SetupPanel } from "./SetupPanel";
import {
  loadSpeakEnabled,
  loadVoiceId,
  replyLangFromVoice,
  type TutorVoiceId,
} from "@/lib/voices";
import {
  getActiveConversation,
  loadConversations,
  MAX_MESSAGES_PER_CHAT,
  newSessionId,
  saveConversations,
  titleFromMessages,
} from "@/lib/storage";
import {
  deleteServerChat,
  hydrateFromServer,
  pushStoreToServer,
} from "@/lib/history-sync";
import type { ClientAttachment } from "@/lib/file-payload";
import type {
  ChatMessage,
  ConversationRecord,
  ConversationsStore,
  HistoryTurn,
} from "@/lib/types";
import type { SpeakStreamApi } from "./VoiceControls";

function messageId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildHistoryPreview(messages: ChatMessage[]): HistoryTurn[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content.trim())
    .slice(-8)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.replace(/\s+/g, " ").trim().slice(0, 500),
    }));
}

async function consumeChatStream(
  body: unknown,
  onDelta: (text: string) => void,
  onStatus?: (status: string) => void,
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
        if (event === "done" && data.text && !full) {
          full = data.text;
          onDelta(data.text);
          gotDelta = true;
        }
      }
      // Let React paint between SSE chunks (critical on iPad)
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

function upsertActive(
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

export function TutorShell() {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<ConversationsStore | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const [keyMissing, setKeyMissing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceId, setVoiceId] = useState<TutorVoiceId>("auto");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const resetNextRef = useRef(false);
  /** sessionIds that need a fresh Cursor agent on next send */
  const resetIdsRef = useRef<Set<string>>(new Set());
  const speakApiRef = useRef<SpeakStreamApi | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const voiceEnabledRef = useRef(true);
  const voiceIdRef = useRef<TutorVoiceId>("auto");

  useEffect(() => {
    const enabled = loadSpeakEnabled();
    setVoiceEnabled(enabled);
    voiceEnabledRef.current = enabled;
    const vid = loadVoiceId();
    setVoiceId(vid);
    voiceIdRef.current = vid;
  }, []);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    voiceIdRef.current = voiceId;
  }, [voiceId]);

  const setSpeakApi = useCallback((api: SpeakStreamApi | null) => {
    speakApiRef.current = api;
  }, []);

  useEffect(() => {
    const loaded = loadConversations();
    setStore(loaded);
    setReady(true);

    // Overlay shared server history so every browser sees the same chats
    void hydrateFromServer(loaded).then((merged) => {
      setStore(merged);
      saveConversations(merged);
      // Upload any local-only chats the server does not have yet
      void pushStoreToServer(merged);
    });

    fetch("/api/setup")
      .then(async (r) => {
        const data = (await r.json()) as { configured?: boolean };
        // 仅在明确未配置时才弹出输入；网络失败不挡小孩使用（服务端有默认 Key）
        setKeyMissing(data.configured === false);
      })
      .catch(() => setKeyMissing(false));
  }, []);

  // Debounce localStorage + server sync while streaming — sync writes freeze the UI on iPad
  useEffect(() => {
    if (!ready || !store) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const delay = busy ? 1500 : 280;
    saveTimerRef.current = window.setTimeout(() => {
      saveConversations(store);
      if (!busy) void pushStoreToServer(store);
    }, delay);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [ready, store, busy]);

  const active = useMemo(
    () => (store ? getActiveConversation(store) : null),
    [store],
  );
  const sessionId = active?.sessionId ?? "";
  const messages = active?.messages ?? [];

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const startNewSession = () => {
    if (!store || busy) return;
    const id = newSessionId();
    resetIdsRef.current.add(id);
    resetNextRef.current = true;
    const now = Date.now();
    // Drop other empty chats so the list stays tidy
    const kept = store.conversations.filter((c) => c.messages.length > 0);
    setStore({
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
        ...kept,
      ],
    });
    setError("");
    speakApiRef.current?.stop();
  };

  const selectConversation = (id: string) => {
    if (!store || busy || id === store.activeId) return;
    speakApiRef.current?.stop();
    setStore({ ...store, activeId: id });
    setError("");
    resetNextRef.current = resetIdsRef.current.has(id);
  };

  const deleteConversation = (id: string) => {
    if (!store || busy) return;
    let conversations = store.conversations.filter((c) => c.sessionId !== id);
    let activeId = store.activeId;
    if (activeId === id) {
      if (conversations.length === 0) {
        const nid = newSessionId();
        resetIdsRef.current.add(nid);
        resetNextRef.current = true;
        const now = Date.now();
        conversations = [
          {
            sessionId: nid,
            title: "New chat",
            messages: [],
            createdAt: now,
            updatedAt: now,
          },
        ];
        activeId = nid;
      } else {
        activeId = [...conversations].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        )[0]!.sessionId;
        resetNextRef.current = resetIdsRef.current.has(activeId);
      }
    }
    resetIdsRef.current.delete(id);
    speakApiRef.current?.stop();
    setStore({ version: 3, activeId, conversations });
    setError("");
    void deleteServerChat(id);
  };

  const handleSend = async (payload: {
    text: string;
    attachments: ClientAttachment[];
  }) => {
    if (busy || !store || !sessionId) return;
    setBusy(true);
    setError("");
    setAgentStatus("Thinking…");

    const needReset =
      resetNextRef.current || resetIdsRef.current.has(sessionId);
    const history = buildHistoryPreview(messages);
    const shouldSpeak = voiceEnabledRef.current;

    const userMsg: ChatMessage = {
      id: messageId(),
      role: "user",
      content: payload.text,
      attachments: payload.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        kind: a.kind,
        dataUrl: a.dataUrl,
      })),
      createdAt: Date.now(),
    };
    const assistantId = messageId();
    const nextMessages: ChatMessage[] = [
      ...messages,
      userMsg,
      { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
    ];

    setStore((prev) =>
      prev
        ? upsertActive(
            { ...prev, activeId: sessionId },
            { messages: nextMessages },
          )
        : prev,
    );

    if (shouldSpeak) {
      speakApiRef.current?.begin();
    }

    try {
      const full = await consumeChatStream(
        {
          sessionId,
          message: payload.text,
          reset: needReset,
          history: needReset ? undefined : history,
          voiceId: voiceIdRef.current,
          replyLanguage: replyLangFromVoice(voiceIdRef.current),
          attachments: payload.attachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            kind: a.kind,
            data: a.data,
            textContent: a.textContent,
          })),
        },
        (delta) => {
          setAgentStatus("");
          // Paint text immediately as SSE chunks arrive
          setStore((prev) => {
            if (!prev) return prev;
            const cur = getActiveConversation(prev);
            if (cur.sessionId !== sessionId) return prev;
            const msgs = cur.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m,
            );
            return upsertActive(prev, { messages: msgs });
          });
          if (shouldSpeak) {
            speakApiRef.current?.push(delta);
          }
        },
        (status) => setAgentStatus(status),
      );
      resetNextRef.current = false;
      resetIdsRef.current.delete(sessionId);
      if (shouldSpeak) {
        speakApiRef.current?.finish(full);
      }
      if (!full.trim()) {
        setStore((prev) => {
          if (!prev) return prev;
          const cur = getActiveConversation(prev);
          if (cur.sessionId !== sessionId) return prev;
          const msgs = cur.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || "(empty reply)" }
              : m,
          );
          return upsertActive(prev, { messages: msgs });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      setError(msg);
      if (msg.includes("CURSOR_API_KEY") || msg.includes("API Key")) {
        setKeyMissing(true);
      }
      speakApiRef.current?.stop();
      setStore((prev) => {
        if (!prev) return prev;
        const cur = getActiveConversation(prev);
        if (cur.sessionId !== sessionId) return prev;
        const msgs = cur.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content || `Sorry — something went wrong: ${msg}`,
              }
            : m,
        );
        return upsertActive(prev, { messages: msgs });
      });
    } finally {
      setBusy(false);
      setAgentStatus("");
      // Persist promptly when the turn ends
      window.setTimeout(() => {
        setStore((prev) => (prev ? { ...prev } : prev));
      }, 0);
    }
  };

  if (!ready || !store) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--ink-muted)]">
        Loading…
      </div>
    );
  }

  if (keyMissing) {
    return (
      <div className="relative min-h-dvh">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="atmosphere-blob atmosphere-blob-a" />
          <div className="atmosphere-blob atmosphere-blob-b" />
          <div className="atmosphere-grain" />
        </div>
        <SetupPanel onConfigured={() => setKeyMissing(false)} />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh max-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <HistorySidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={store.conversations}
        activeId={store.activeId}
        disabled={busy}
        onNew={startNewSession}
        onSelect={selectConversation}
        onDelete={deleteConversation}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="safe-top flex w-full shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-3 sm:px-4 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 px-3 text-sm text-[var(--ink)] lg:hidden"
              aria-label="Open all chat history"
            >
              All chats
            </button>
            <div className="min-w-0 lg:pl-1">
              <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--ink)] sm:text-4xl lg:text-5xl">
                Spark
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)] sm:text-sm">
                {active?.title && active.title !== "New chat"
                  ? active.title
                  : "Your AI tutor · talk it through"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={startNewSession}
            className="shrink-0 rounded-full px-3 py-2 text-sm text-[var(--ink-muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline disabled:opacity-40"
          >
            New chat
          </button>
        </header>

        <main
          ref={scrollerRef}
          className="mx-auto mt-1 w-full max-w-5xl min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <ChatThread messages={messages} streaming={busy} />
        </main>

        {agentStatus ? (
          <p className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-1 text-xs text-[var(--teal)]">
            {agentStatus}
          </p>
        ) : null}

        {error ? (
          <p className="mx-auto w-full max-w-3xl shrink-0 px-4 text-sm text-[var(--coral)]">
            {error}
          </p>
        ) : null}

        <div className="shrink-0 border-t border-[var(--line)]/60 bg-[color-mix(in_srgb,var(--bg0)_82%,transparent)] backdrop-blur-md">
        <Composer
          disabled={busy}
          voiceEnabled={voiceEnabled}
          onVoiceEnabledChange={setVoiceEnabled}
          onVoiceIdChange={setVoiceId}
          onSpeakApi={setSpeakApi}
          onPrepareSpeak={async () => {
            await speakApiRef.current?.prepare();
          }}
          onSend={handleSend}
        />
        </div>
      </div>
    </div>
  );
}
