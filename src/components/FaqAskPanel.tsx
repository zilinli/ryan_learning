"use client";

import { useEffect, useRef, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { MicTranscribeButton } from "@/components/MicTranscribeButton";
import {
  attachmentFromCameraCapture,
  filesToAttachments,
  type ClientAttachment,
} from "@/lib/file-payload";
import { FILE_INPUT_ACCEPT, MAX_ATTACHMENTS } from "@/lib/attachments";
import type { FaqReplyLang } from "@/lib/faq-ai";
import { sttLangFromDictLang } from "@/lib/stt-lang";
import type { DictLang } from "@/lib/dict-types";

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: { name: string; kind: string }[];
  status?: string;
  error?: boolean;
};

const REPLY_LANGS: { id: FaqReplyLang; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "zh", label: "中文" },
  { id: "yue", label: "粤语" },
  { id: "ms", label: "Melayu" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "teo", label: "闽南" },
  { id: "hak", label: "客家" },
  { id: "sha", label: "上海" },
];

const SUGGESTIONS = [
  "How do I change the tutor voice language?",
  "为什么 Listen 没声音？",
  "Bagaimana nak translate jawapan ke English?",
  "Where is my data stored?",
];

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type Props = {
  onOpenSuggest: () => void;
};

export function FaqAskPanel({ onOpenSuggest }: Props) {
  const [replyLang, setReplyLang] = useState<FaqReplyLang>("auto");
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hint, setHint] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const atLimit = attachments.length >= MAX_ATTACHMENTS;

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setHint("");
    try {
      const { items, errors } = await filesToAttachments(
        Array.from(list),
        attachments.length,
      );
      if (items.length) {
        setAttachments((prev) => [...prev, ...items].slice(0, MAX_ATTACHMENTS));
      }
      if (errors.length) setHint(errors[0] || "Upload failed");
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const ask = async (preset?: string) => {
    const q = (preset ?? text).trim();
    if (busy) return;
    if (!q && attachments.length === 0) return;

    const userTurn: Turn = {
      id: newId("u"),
      role: "user",
      text: q || "(see attachment)",
      attachments: attachments.map((a) => ({ name: a.name, kind: a.kind })),
    };
    const assistId = newId("a");
    setTurns((prev) => [
      ...prev,
      userTurn,
      {
        id: assistId,
        role: "assistant",
        text: "",
        status: "Looking through docs & code…",
      },
    ]);
    setText("");
    const payloadAtts = attachments;
    setAttachments([]);
    setBusy(true);
    setHint("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/faq-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          question: q,
          replyLang,
          attachments: payloadAtts.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            kind: a.kind,
            data: a.data,
            dataUrl: a.dataUrl,
            textContent: a.textContent,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Help failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const applyEvent = (ev: string, raw: string) => {
        let data: {
          text?: string;
          status?: string;
          answer?: string;
          error?: string;
        } = {};
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          return;
        }
        if (ev === "status" && data.status) {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === assistId ? { ...t, status: data.status } : t,
            ),
          );
        } else if (ev === "delta" && data.text) {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === assistId
                ? {
                    ...t,
                    text: (t.text || "") + data.text,
                    status: undefined,
                  }
                : t,
            ),
          );
        } else if (ev === "done" && data.answer) {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === assistId
                ? { ...t, text: data.answer || t.text, status: undefined }
                : t,
            ),
          );
        } else if (ev === "error") {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === assistId
                ? {
                    ...t,
                    text: data.error || "Something went wrong.",
                    status: undefined,
                    error: true,
                  }
                : t,
            ),
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const block of parts) {
          const lines = block.split("\n");
          let ev = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length) applyEvent(ev, dataLines.join("\n"));
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistId && !t.text
              ? { ...t, text: "Stopped.", status: undefined }
              : t,
          ),
        );
      } else {
        const msg = err instanceof Error ? err.message : "Help failed";
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistId
              ? { ...t, text: msg, status: undefined, error: true }
              : t,
          ),
        );
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const sttLang = sttLangFromDictLang(
    replyLang === "auto" ? "auto" : (replyLang as DictLang),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {turns.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)]/50 bg-gradient-to-br from-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] to-[var(--surface)] p-4">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Ask anything about Spark
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
              Answers come from the live product docs and code — voice, Listen,
              languages, homework photos, accounts, and more. Type, speak, upload,
              or snap a screenshot.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-[var(--line)]/70 bg-[var(--surface)] px-2.5 py-1 text-left text-[11px] text-[var(--ink)] transition hover:border-[var(--teal)]/40 hover:bg-[var(--teal)]/5 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((t) => {
          const isUser = t.role === "user";
          return (
            <div
              key={t.id}
              className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                {isUser ? "You" : "Spark Help"}
              </span>
              <div
                className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  isUser
                    ? "bg-[var(--teal)] text-white"
                    : t.error
                      ? "border border-[var(--coral)]/30 bg-[color-mix(in_srgb,var(--coral)_8%,var(--surface))] text-[var(--coral)]"
                      : "border border-[var(--line)]/55 bg-[var(--surface-muted)]/80 text-[var(--ink)]"
                }`}
              >
                {t.attachments && t.attachments.length > 0 ? (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {t.attachments.map((a, i) => (
                      <span
                        key={`${a.name}-${i}`}
                        className={`inline-flex max-w-[140px] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                          isUser
                            ? "bg-white/20 text-white"
                            : "bg-[var(--surface)] text-[var(--ink-muted)]"
                        }`}
                      >
                        {a.kind === "image" ? "Photo" : "File"}
                        <span className="truncate">{a.name}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {t.status && !t.text ? (
                  <p className="animate-pulse text-[12px] text-[var(--ink-muted)]">
                    {t.status}
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{t.text}</p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--line)]/50 bg-[var(--surface)] px-3 pb-3 pt-2.5">
        <div className="mb-2 flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              Answer in
            </span>
            <select
              value={replyLang}
              onChange={(e) => setReplyLang(e.target.value as FaqReplyLang)}
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)]/70 bg-[var(--bg0)]/40 px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--teal)]/50"
            >
              {REPLY_LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-[var(--coral)]/40 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--coral)]"
            >
              Stop
            </button>
          ) : null}
        </div>

        {attachments.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="group relative overflow-hidden rounded-lg border border-[var(--line)]/60 bg-[var(--surface-muted)]"
              >
                {a.kind === "image" && a.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.dataUrl}
                    alt={a.name}
                    className="h-12 w-12 object-cover"
                  />
                ) : (
                  <span className="flex h-12 max-w-[7rem] items-center px-2 text-[10px] text-[var(--ink-muted)]">
                    <span className="truncate">{a.name}</span>
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() =>
                    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                  }
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-[9px] text-white opacity-0 transition group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-end gap-1.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            disabled={busy}
            placeholder="Ask about Spark… (any language)"
            className="min-h-[2.75rem] max-h-28 flex-1 resize-y rounded-xl border border-[var(--line)]/70 bg-[var(--bg0)]/35 px-3 py-2 text-[13px] leading-snug text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)]/55 focus:border-[var(--teal)]/55 focus:ring-2 focus:ring-[var(--teal)]/15 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          <MicTranscribeButton
            language={sttLang}
            disabled={busy}
            compact
            onTranscript={(t) => {
              setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
            }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept={FILE_INPUT_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy || atLimit}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--line)]/70 px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] transition hover:border-[var(--teal)]/40 hover:text-[var(--teal)] disabled:opacity-40"
          >
            Upload
          </button>
          <button
            type="button"
            disabled={busy || atLimit}
            onClick={() => setCameraOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/8 px-2.5 py-1 text-[11px] font-semibold text-[var(--teal)] transition hover:bg-[var(--teal)]/15 disabled:opacity-40"
          >
            Camera
          </button>
          <button
            type="button"
            disabled={busy || (!text.trim() && attachments.length === 0)}
            onClick={() => void ask()}
            className="ml-auto inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-[var(--teal)] px-3.5 text-[12px] font-semibold text-white transition hover:brightness-105 disabled:opacity-40"
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>

        {hint ? (
          <p className="mt-1.5 text-[11px] text-[var(--coral)]">{hint}</p>
        ) : (
          <p className="mt-1.5 text-[10.5px] text-[var(--ink-muted)]/75">
            Still need a change?{" "}
            <button
              type="button"
              onClick={onOpenSuggest}
              className="font-semibold text-[var(--teal)] underline-offset-2 hover:underline"
            >
              Suggest on GitHub
            </button>
          </p>
        )}
      </div>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        capturedCount={attachments.filter((a) => a.kind === "image").length}
        onCapture={(payload) => {
          const item = attachmentFromCameraCapture({
            ...payload,
            index: attachments.length + 1,
          });
          setAttachments((prev) => [...prev, item].slice(0, MAX_ATTACHMENTS));
          setCameraOpen(false);
        }}
      />
    </div>
  );
}
