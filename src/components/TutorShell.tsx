"use client";

import { useEffect, useRef, useState } from "react";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { SetupPanel } from "./SetupPanel";
import {
  clearSession,
  loadSession,
  newSessionId,
  saveSession,
} from "@/lib/storage";
import type { ClientAttachment } from "@/lib/file-payload";
import type { ChatMessage } from "@/lib/types";

function messageId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function consumeChatStream(
  body: unknown,
  onDelta: (text: string) => void,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let streamError = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

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
      };
      if (event === "delta" && data.text) {
        full += data.text;
        onDelta(data.text);
      }
      if (event === "error" && data.error) {
        streamError = data.error;
      }
      if (event === "done" && data.text && !full) {
        full = data.text;
        onDelta(data.text);
      }
    }
  }

  if (streamError) throw new Error(streamError);
  return full;
}

export function TutorShell() {
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyMissing, setKeyMissing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakText, setSpeakText] = useState<string | undefined>();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const resetNextRef = useRef(false);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSessionId(saved.sessionId);
      setMessages(saved.messages);
    } else {
      setSessionId(newSessionId());
    }
    setReady(true);

    fetch("/api/setup")
      .then(async (r) => {
        const data = (await r.json()) as { configured?: boolean };
        setKeyMissing(!data.configured);
      })
      .catch(() => setKeyMissing(true));
  }, []);

  useEffect(() => {
    if (!ready || !sessionId) return;
    saveSession({
      sessionId,
      messages,
      updatedAt: Date.now(),
    });
  }, [ready, sessionId, messages]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const startNewSession = () => {
    clearSession();
    setSessionId(newSessionId());
    setMessages([]);
    setError("");
    setSpeakText(undefined);
    resetNextRef.current = true;
  };

  const handleSend = async (payload: {
    text: string;
    attachments: ClientAttachment[];
  }) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSpeakText(undefined);

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
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
    ]);

    try {
      const full = await consumeChatStream(
        {
          sessionId,
          message: payload.text,
          reset: resetNextRef.current,
          attachments: payload.attachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            kind: a.kind,
            data: a.data,
            textContent: a.textContent,
          })),
        },
        (delta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + delta } : m,
            ),
          );
        },
      );
      resetNextRef.current = false;
      setSpeakText(full);
      if (!full.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || "(empty reply)" }
              : m,
          ),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      setError(msg);
      if (msg.includes("CURSOR_API_KEY") || msg.includes("API Key")) {
        setKeyMissing(true);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || `Sorry — something went wrong: ${msg}` }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
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
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <header className="safe-top relative z-10 mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-4 sm:gap-4 sm:pt-6">
        <div className="animate-fade-up min-w-0">
          <p className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--ink)] sm:text-5xl">
            Spark
          </p>
          <p className="mt-1 truncate text-xs text-[var(--ink-muted)] sm:text-sm">
            Your AI tutor · talk it through
          </p>
        </div>
        <button
          type="button"
          onClick={startNewSession}
          className="animate-fade-up-delay shrink-0 rounded-full px-3 py-2 text-sm text-[var(--ink-muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          New chat
        </button>
      </header>

      <main
        ref={scrollerRef}
        className="relative z-10 mx-auto mt-1 w-full max-w-5xl min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <ChatThread messages={messages} streaming={busy} />
      </main>

      {error ? (
        <p className="relative z-10 mx-auto w-full max-w-3xl shrink-0 px-4 text-sm text-[var(--coral)]">
          {error}
        </p>
      ) : null}

      <div className="relative z-10 shrink-0 border-t border-[var(--line)]/60 bg-[color-mix(in_srgb,var(--bg0)_82%,transparent)] backdrop-blur-md">
        <Composer
          disabled={busy}
          voiceEnabled={voiceEnabled}
          onVoiceEnabledChange={setVoiceEnabled}
          speakText={speakText}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
