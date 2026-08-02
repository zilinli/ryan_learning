"use client";

import { useCallback, useId, useRef, useState } from "react";
import { MAX_ATTACHMENTS } from "@/lib/attachments";
import {
  attachmentFromCameraCapture,
  filesToAttachments,
  type ClientAttachment,
} from "@/lib/file-payload";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { CameraCapture } from "./CameraCapture";
import { VoiceControls, type SpeakStreamApi } from "./VoiceControls";

type Props = {
  disabled?: boolean;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (v: boolean) => void;
  onSpeakApi?: (api: SpeakStreamApi | null) => void;
  /** Unlock audio inside the Send tap (required on iPhone/iPad) */
  onPrepareSpeak?: () => Promise<void>;
  onSend: (payload: {
    text: string;
    attachments: ClientAttachment[];
  }) => void;
};

export function Composer({
  disabled,
  voiceEnabled,
  onVoiceEnabledChange,
  onSpeakApi,
  onPrepareSpeak,
  onSend,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileId = useId();
  const photoId = useId();
  const attachmentsRef = useRef<ClientAttachment[]>([]);
  attachmentsRef.current = attachments;

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
    <div className="safe-bottom mx-auto w-full max-w-3xl px-3 pt-2 sm:px-4">
      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 animate-fade-up">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="relative flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white/80 p-1.5 pr-2"
            >
              {a.kind === "image" && a.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.dataUrl}
                  alt={a.name}
                  className="h-12 w-12 rounded-lg object-cover ring-1 ring-[var(--line)]"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--mist)] text-[10px] font-medium text-[var(--ink)]">
                  FILE
                </div>
              )}
              <div className="max-w-[7rem]">
                <p className="truncate text-xs text-[var(--ink)]">{a.name}</p>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <span className="text-xs text-[var(--ink-muted)]">
            {attachments.length}/{MAX_ATTACHMENTS}
          </span>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-2.5 shadow-[0_12px_40px_-24px_rgba(15,60,70,0.45)] backdrop-blur sm:p-3">
        <textarea
          value={text}
          disabled={disabled}
          rows={2}
          placeholder="Ask anything, or add homework photos / PDF…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none bg-transparent px-1 py-1 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] disabled:opacity-50 sm:text-[15px]"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* label+input beats button.click() on many Android/Huawei WebViews */}
            <input
              id={fileId}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,application/pdf,text/plain,text/csv"
              className="sr-only"
              disabled={pickDisabled}
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                void addFiles(files);
              }}
            />
            <input
              id={photoId}
              type="file"
              multiple
              accept="image/*"
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
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--teal)] ${
                pickDisabled ? "pointer-events-none opacity-40" : ""
              }`}
            >
              {adding ? "Adding…" : "Upload"}
            </label>
            <label
              htmlFor={photoId}
              aria-disabled={pickDisabled}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--teal)] ${
                pickDisabled ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Photos
            </label>
            <button
              type="button"
              disabled={pickDisabled}
              onClick={() => {
                setError("");
                setCameraOpen(true);
              }}
              className={`min-h-11 rounded-full px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                cameraOpen
                  ? "bg-[var(--coral)] text-white"
                  : "bg-[var(--ink)] text-white hover:opacity-90"
              }`}
            >
              Camera
            </button>
            <VoiceControls
              disabled={disabled || adding}
              voiceEnabled={voiceEnabled}
              onVoiceEnabledChange={onVoiceEnabledChange}
              onSpeakApi={onSpeakApi}
              onTranscript={(t) => {
                setText(t);
                window.setTimeout(() => submit(t), 0);
              }}
            />
          </div>
          <button
            type="button"
            disabled={
              disabled ||
              adding ||
              (!text.trim() && attachments.length === 0)
            }
            onClick={() => submit()}
            className="min-h-11 w-full rounded-full bg-[var(--teal)] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {disabled ? "Thinking…" : "Send"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--coral)]">{error}</p> : null}
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
