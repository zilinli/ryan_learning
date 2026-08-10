"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FILE_INPUT_ACCEPT, MAX_ATTACHMENTS, resolveFilePickerAccept } from "@/lib/attachments";
import {
  attachmentFromCameraCapture,
  filesToAttachments,
  type ClientAttachment,
} from "@/lib/file-payload";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { CameraCapture } from "./CameraCapture";
import { getTutorVoice, loadVoiceAutoSend, type TutorVoiceId } from "@/lib/voices";
import { VoiceControls, type SpeakStreamApi } from "./VoiceControls";
import { RYAN_ACCOUNT } from "@/lib/tenant-storage";

export type ComposerApi = {
  openCamera: () => void;
};

type Props = {
  disabled?: boolean;
  /** Active student account — forwarded to VoiceControls for scoped prefs */
  accountId?: string;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (v: boolean) => void;
  onVoiceIdChange?: (id: TutorVoiceId) => void;
  onSpeakApi?: (api: SpeakStreamApi | null) => void;
  onComposerApi?: (api: ComposerApi | null) => void;
  /** Unlock audio inside the Send tap (required on iPhone/iPad) */
  onPrepareSpeak?: () => Promise<void>;
  /** UI-B2a — speaking status line above toolbar */
  speakStatus?: string;
  onSpeakingChange?: (speaking: boolean) => void;
  /** B3 — skill context for voice confusable gating */
  recentSkillIds?: string[];
  onSend: (payload: {
    text: string;
    attachments: ClientAttachment[];
  }) => void;
};

export function Composer({
  disabled,
  accountId,
  voiceEnabled,
  onVoiceEnabledChange,
  onVoiceIdChange,
  onSpeakApi,
  onComposerApi,
  onPrepareSpeak,
  speakStatus,
  onSpeakingChange,
  recentSkillIds,
  onSend,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceId, setVoiceId] = useState<TutorVoiceId>("auto");
  const [voiceAutoSend, setVoiceAutoSend] = useState(false);
  const [dialectPending, setDialectPending] = useState(false);
  const [voiceConfirm, setVoiceConfirm] = useState<{
    line: string;
    options: string[];
    onPick: (chosen: string) => void;
    onDismiss: () => void;
  } | null>(null);
  const dialectTokenRef = useRef(0);
  const fileId = useId();
  const [fileAccept, setFileAccept] = useState<string | undefined>(
    FILE_INPUT_ACCEPT,
  );
  const attachmentsRef = useRef<ClientAttachment[]>([]);
  // Keep a ref of the latest attachments for stable event-handler closures
  // (addFiles/submit are recreated or memoized without deps).
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    setFileAccept(resolveFilePickerAccept(FILE_INPUT_ACCEPT));
  }, []);

  useEffect(() => {
    setVoiceAutoSend(loadVoiceAutoSend(accountId || RYAN_ACCOUNT));
  }, [accountId]);

  useEffect(() => {
    onComposerApi?.({
      openCamera: () => {
        setError("");
        setCameraOpen(true);
      },
    });
    return () => onComposerApi?.(null);
  }, [onComposerApi]);

  const addFiles = useCallback(async (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    setAdding(true);
    setError("");
    try {
      const { items, errors } = await filesToAttachments(
        fileList,
        attachmentsRef.current.length,
      );
      if (items.length) {
        setAttachments((prev) => [...prev, ...items].slice(0, MAX_ATTACHMENTS));
      }
      if (errors.length) setError(errors.join(" "));
    } finally {
      setAdding(false);
    }
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const submit = (overrideText?: string) => {
    const finalText = (overrideText ?? text).trim();
    const current = attachmentsRef.current;
    if (!finalText && current.length === 0) return;
    const payload = { text: finalText, attachments: current };
    setText("");
    setAttachments([]);
    setError("");
    setDialectPending(false);
    // Unlock TTS in this user gesture, then send (iPad/iPhone autoplay policy)
    void (async () => {
      if (voiceEnabled) {
        try {
          if (onPrepareSpeak) await onPrepareSpeak();
          else await getSharedSpeechEngine().unlock();
        } catch {
          // continue send even if unlock fails; Speak on can retry
        }
      }
      onSend(payload);
    })();
  };

  const atLimit = attachments.length >= MAX_ATTACHMENTS;
  const pickDisabled = disabled || adding || atLimit;

  return (
    <div className="safe-bottom mx-auto w-full max-w-2xl px-3 pt-1.5 sm:px-4">
      {attachments.length > 0 ? (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 animate-fade-up">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="relative flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1.5 pr-2"
            >
              {a.kind === "image" && a.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.dataUrl}
                  alt={a.name}
                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--line)]"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--mist)] text-[10px] font-medium text-[var(--ink)]">
                  FILE
                </div>
              )}
              <div className="max-w-[6rem]">
                <p className="truncate text-xs text-[var(--ink)]">{a.name}</p>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="text-[10px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <span className="text-[11px] text-[var(--ink-muted)]">
            {attachments.length}/{MAX_ATTACHMENTS}
          </span>
        </div>
      ) : null}

      {dialectPending ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-[var(--teal)]/30 bg-[var(--teal)]/5 px-3 py-2 text-xs text-[var(--ink)] animate-fade-up">
          <span aria-hidden>🪶</span>
          <span className="flex-1">正在校对方言转写…</span>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-2 shadow-[0_8px_32px_-20px_rgba(15,60,70,0.4)] backdrop-blur sm:p-2.5">
        <textarea
          value={text}
          disabled={disabled}
          rows={1}
          placeholder="Ask anything about your homework…"
          onChange={(e) => {
            setText(e.target.value);
            // 用户手动输入时视为放弃本次自动纠错覆盖
            dialectTokenRef.current += 1;
            setDialectPending(false);
            // Auto-expand height to a max of 4 lines
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            // Enter = send, Shift+Enter = newline
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full min-h-[2.75rem] resize-none bg-transparent px-1 py-1 text-lg leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] disabled:opacity-50 sm:text-base"
        />

        {speakStatus ? (
          <p
            className="mt-1 text-xs font-medium text-[var(--teal)]"
            aria-live="polite"
          >
            {speakStatus}
          </p>
        ) : null}

        {voiceConfirm ? (
          <div
            className="mt-1.5 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/5 px-3 py-2 animate-fade-up"
            role="group"
            aria-label="Confirm what you meant"
          >
            <p className="text-xs text-[var(--ink)]">{voiceConfirm.line}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {voiceConfirm.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => voiceConfirm.onPick(opt)}
                  className="min-h-11 rounded-xl bg-[var(--action-bg)] px-3 text-sm font-medium text-[var(--action-ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
                >
                  {opt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => voiceConfirm.onDismiss()}
                className="min-h-11 rounded-xl px-3 text-sm text-[var(--ink-muted)] underline-offset-2 hover:underline"
              >
                Keep as heard
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input
            id={fileId}
            type="file"
            multiple
            accept={fileAccept}
            className="sr-only"
            disabled={pickDisabled}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              void addFiles(files);
            }}
          />
          <label
            htmlFor={fileId}
            aria-disabled={pickDisabled}
            className={`inline-flex min-h-[2.75rem] w-10 cursor-pointer items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)] ${
              pickDisabled ? "pointer-events-none opacity-30" : ""
            }`}
            title="Upload file"
            aria-label="Upload file"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </label>

          {/* Camera — primary photo-first action */}
          <button
            type="button"
            disabled={pickDisabled}
            onClick={() => {
              setError("");
              setCameraOpen(true);
            }}
            className={`inline-flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--teal)] sm:px-4 ${
              cameraOpen
                ? "bg-[var(--coral)] text-white"
                : "bg-[var(--action-bg)] text-[var(--action-ink)] hover:opacity-90"
            }`}
            title="Snap homework"
            aria-label="Camera — snap homework"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="hidden sm:inline">Camera</span>
          </button>

          <VoiceControls
            disabled={disabled || adding}
            accountId={accountId}
            voiceEnabled={voiceEnabled}
            onVoiceEnabledChange={onVoiceEnabledChange}
            onVoiceIdChange={(id) => {
              setVoiceId(id);
              onVoiceIdChange?.(id);
            }}
            onSpeakApi={onSpeakApi}
            onSpeakingChange={onSpeakingChange}
            recentSkillIds={recentSkillIds}
            onConfirmIntent={setVoiceConfirm}
            voiceAutoSend={voiceAutoSend}
            onVoiceAutoSendChange={setVoiceAutoSend}
            onTranscript={(t) => {
              const lang = getTutorVoice(voiceId).lang;
              const needsConfirm =
                lang === "teo" ||
                lang === "hak" ||
                lang === "sha" ||
                lang === "yue" ||
                !voiceAutoSend;
              if (lang === "teo" || lang === "hak" || lang === "sha") {
                // 方言：填入输入框；teo/hak 可尝试纠错；sha 仅人工确认
                const token = dialectTokenRef.current + 1;
                dialectTokenRef.current = token;
                setText(t);
                if (lang === "sha") {
                  setDialectPending(false);
                  return;
                }
                setDialectPending(true);
                void (async () => {
                  try {
                    const res = await fetch("/api/dialect-correct", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: t, dialect: lang }),
                      signal: AbortSignal.timeout(20_000),
                    });
                    const data = (await res.json().catch(() => null)) as {
                      corrected?: string;
                    } | null;
                    if (token !== dialectTokenRef.current) return;
                    if (data?.corrected) setText(data.corrected);
                  } catch {
                    // keep original transcript
                  } finally {
                    if (token === dialectTokenRef.current) {
                      setDialectPending(false);
                    }
                  }
                })();
                return;
              }
              setText(t);
              if (!needsConfirm) {
                window.setTimeout(() => submit(t), 0);
              }
            }}
          />

          <div className="flex-1" />

          <button
            type="button"
            disabled={
              disabled ||
              adding ||
              (!text.trim() && attachments.length === 0)
            }
            onClick={() => submit()}
            className="inline-flex min-h-[2.75rem] items-center gap-1 rounded-full bg-[var(--teal)] px-4 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {disabled ? (
              "Thinking…"
            ) : (
              <>
                <span>Send</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22,2 15,22 11,13 2,9" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-1.5 text-sm text-[var(--coral)]">{error}</p>
      ) : null}
      {adding ? (
        <p className="mt-1 text-xs text-[var(--teal)]">Processing files…</p>
      ) : null}

      <CameraCapture
        open={cameraOpen}
        capturedCount={attachments.filter((a) => a.kind === "image").length}
        onClose={() => setCameraOpen(false)}
        onCapture={(payload) => {
          const item = attachmentFromCameraCapture({
            ...payload,
            index: attachmentsRef.current.length + 1,
          });
          setAttachments((prev) => [...prev, item].slice(0, MAX_ATTACHMENTS));
          setError("");
        }}
      />
    </div>
  );
}
