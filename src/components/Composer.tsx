"use client";

import { useRef, useState } from "react";
import { MAX_ATTACHMENTS } from "@/lib/attachments";
import {
  filesToAttachments,
  type ClientAttachment,
} from "@/lib/file-payload";
import { CameraCapture } from "./CameraCapture";
import { VoiceControls } from "./VoiceControls";

type Props = {
  disabled?: boolean;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (v: boolean) => void;
  speakText?: string;
  onSend: (payload: {
    text: string;
    attachments: ClientAttachment[];
  }) => void;
};

export function Composer({
  disabled,
  voiceEnabled,
  onVoiceEnabledChange,
  speakText,
  onSend,
}: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    const { items, errors } = await filesToAttachments(fileList, attachments.length);
    if (items.length) {
      setAttachments((prev) => [...prev, ...items].slice(0, MAX_ATTACHMENTS));
    }
    setError(errors.join(" ") || "");
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const submit = (overrideText?: string) => {
    const finalText = (overrideText ?? text).trim();
    if (!finalText && attachments.length === 0) return;
    onSend({ text: finalText, attachments });
    setText("");
    setAttachments([]);
    setError("");
  };

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
          placeholder="Ask anything, or add photos / PDF of your homework…"
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
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,application/pdf,text/plain"
              className="hidden"
              onChange={async (e) => {
                const list = e.target.files;
                e.target.value = "";
                await addFiles(list);
              }}
            />
            <input
              ref={cameraFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const list = e.target.files;
                e.target.value = "";
                await addFiles(list);
              }}
            />
            <button
              type="button"
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileRef.current?.click()}
              className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--teal)] disabled:opacity-40"
            >
              Upload
            </button>
            <button
              type="button"
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => {
                setError("");
                const coarse =
                  typeof window !== "undefined" &&
                  window.matchMedia("(pointer: coarse)").matches;
                if (coarse) {
                  cameraFileRef.current?.click();
                } else {
                  setCameraOpen(true);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
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
              disabled={disabled}
              speakText={speakText}
              voiceEnabled={voiceEnabled}
              onVoiceEnabledChange={onVoiceEnabledChange}
              onTranscript={(t) => {
                setText(t);
                submit(t);
              }}
            />
          </div>
          <button
            type="button"
            disabled={disabled || (!text.trim() && attachments.length === 0)}
            onClick={() => submit()}
            className="min-h-11 w-full rounded-full bg-[var(--teal)] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {disabled ? "Thinking…" : "Send"}
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--coral)]">{error}</p> : null}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(payload) => {
          const item: ClientAttachment = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: `camera-${attachments.length + 1}.jpg`,
            mimeType: payload.mimeType,
            kind: "image",
            dataUrl: payload.dataUrl,
            data: payload.data,
          };
          setAttachments((prev) =>
            [...prev, item].slice(0, MAX_ATTACHMENTS),
          );
          setError("");
        }}
      />
    </div>
  );
}
