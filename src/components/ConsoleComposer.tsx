"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { filesToAttachments, attachmentFromCameraCapture, type ClientAttachment } from "@/lib/file-payload";
import { startWavRecorder } from "@/lib/wav-recorder";
import { CONSOLE_FILE_INPUT_ACCEPT, MAX_ATTACHMENTS } from "@/lib/attachments";
import { CameraCapture } from "./CameraCapture";

export type ComposerSubmit = {
  text: string;
  attachments: ClientAttachment[];
  voiceLang?: string;
};

type Props = {
  disabled?: boolean;
  placeholder?: string;
  singleLine?: boolean;
  onSubmit: (payload: ComposerSubmit) => void;
};

type RecorderSession = { stop: () => Promise<Blob> };

export function ConsoleComposer({ disabled, placeholder, singleLine, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState<ClientAttachment[]>([]);
  const [voiceLang, setVoiceLang] = useState<string>("zh-CN");
  const [listening, setListening] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micHint, setMicHint] = useState("");
  const [err, setErr] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attsRef = useRef(atts);
  const recorderRef = useRef<RecorderSession | null>(null);

  useEffect(() => () => { void recorderRef.current?.stop().catch(() => undefined); }, []);

  useEffect(() => { attsRef.current = atts; }, [atts]);

  const clearInput = useCallback(() => {
    setText("");
    setAtts([]);
    setErr("");
    if (ref.current) ref.current.style.height = "auto";
  }, []);

  const submit = useCallback(() => {
    const t = text.trim();
    if ((!t && atts.length === 0) || disabled) return;
    onSubmit({ text: t, attachments: atts, voiceLang });
    clearInput();
  }, [text, atts, voiceLang, disabled, onSubmit, clearInput]);

  const kd = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    setErr("");
    try {
      const { items, errors } = await filesToAttachments(fileList, atts.length);
      setAtts((prev) => [...prev, ...items].slice(0, MAX_ATTACHMENTS));
      if (errors.length) setErr(errors.join(" · "));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read files");
    }
  }, [atts.length]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (files?.length) void addFiles(files);
  }, [addFiles]);

  const removeAtt = useCallback((id: string) => {
    setAtts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleLang = useCallback(() => {
    setVoiceLang((prev) => (prev === "zh-CN" ? "en-US" : "zh-CN"));
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    setMicBusy(true);
    setMicHint("Recognizing…");
    try {
      const body = new FormData();
      body.append("audio", blob, "recording.wav");
      body.append("language", voiceLang);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(75_000),
      });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Recognition failed");
      }
      const t = (data?.text || "").trim();
      if (!t) throw new Error("Didn't catch that — try again");
      setMicHint("");
      setText((prev) => (prev ? prev + " " + t : t));
      if (ref.current) {
        ref.current.style.height = "auto";
        ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
        ref.current.focus();
      }
    } catch (e) {
      setMicHint(e instanceof Error ? e.message : "Recognition failed");
    } finally {
      setMicBusy(false);
    }
  }, [voiceLang]);

  const toggleMic = useCallback(async () => {
    if (disabled || micBusy) return;
    if (listening) {
      const session = recorderRef.current;
      recorderRef.current = null;
      setListening(false);
      if (!session) return;
      setMicHint("Finishing…");
      try {
        const blob = await session.stop();
        if (blob.size < 2500) {
          setMicHint("Too short — tap Mic, speak, tap again");
          return;
        }
        await transcribeBlob(blob);
      } catch {
        setMicHint("Recording failed — try again");
      }
      return;
    }
    setMicHint("");
    try {
      const session = await startWavRecorder();
      recorderRef.current = session;
      setListening(true);
      setMicHint("Listening… speak now");
    } catch {
      setMicHint("Microphone blocked — allow mic in browser address bar");
    }
  }, [disabled, micBusy, listening, transcribeBlob]);

  const canSend = !disabled && (text.trim().length > 0 || atts.length > 0);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 shadow-sm backdrop-blur">
      {/* Attachment pills */}
      {atts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {atts.map((a) => (
            <span key={a.id} className="inline-flex max-w-[160px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--mist)] py-0.5 pl-1 pr-1.5 text-[11px] text-[var(--ink)]">
              {a.kind === "image" && a.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.dataUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="text-[11px]">{a.kind === "image" ? "🖼" : "📄"}</span>
              )}
              <span className="truncate">{a.name}</span>
              <button type="button" onClick={() => removeAtt(a.id)} className="text-[var(--ink-muted)] hover:text-[var(--coral)]" aria-label={`Remove ${a.name}`}>✕</button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        value={text}
        disabled={disabled}
        rows={singleLine ? 1 : 3}
        placeholder={placeholder ?? "Tell Spark what to improve…"}
        onChange={(e) => {
          setText(e.target.value);
          if (!singleLine) {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }
        }}
        onKeyDown={kd}
        className="w-full resize-none bg-transparent py-1 text-[15px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] disabled:opacity-50"
      />

      {(err || micHint) && (
        <p className={`mt-1 text-[11px] leading-snug ${err ? "text-[var(--coral)]" : "text-[var(--teal)]"}`}>
          {err || micHint}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* Attach file */}
          <button type="button" disabled={disabled || atts.length >= MAX_ATTACHMENTS}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)] disabled:opacity-40"
            title="Attach file / PDF / image" aria-label="Attach file">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <input ref={fileRef} type="file" multiple accept={CONSOLE_FILE_INPUT_ACCEPT} className="hidden" onChange={onFileInput} />

          {/* Camera — opens live viewfinder for photo capture */}
          <button type="button" disabled={disabled || atts.length >= MAX_ATTACHMENTS}
            onClick={() => setCameraOpen(true)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
              cameraOpen
                ? "bg-[var(--coral)] text-white"
                : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
            } disabled:opacity-40`}
            title="Take a photo" aria-label="Take a photo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          </button>

          {/* Voice lang toggle */}
          <button type="button" onClick={toggleLang}
            className="inline-flex h-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold text-[var(--teal)] hover:bg-[var(--mist)]"
            title="Voice language: Chinese / English" aria-label="Toggle voice language">
            {voiceLang === "zh-CN" ? "zh" : "en"}
          </button>

          {/* Mic */}
          <button type="button" disabled={disabled || micBusy}
            onClick={() => void toggleMic()}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${listening ? "bg-[var(--coral)] text-white" : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"} disabled:opacity-40`}
            title={listening ? "Tap to stop and send" : "Voice input"} aria-label="Voice input">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--ink-muted)]">
            {singleLine ? "Enter to send" : "Enter send · Shift+Enter newline"}
          </span>
          <button type="button" disabled={!canSend} onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-40">
            Send
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22,2 15,22 11,13 2,9" /></svg>
          </button>
        </div>
      </div>

      <CameraCapture
        open={cameraOpen}
        capturedCount={atts.filter((a) => a.kind === "image").length}
        onClose={() => setCameraOpen(false)}
        onCapture={(payload) => {
          const item = attachmentFromCameraCapture({
            ...payload,
            index: attsRef.current.length + 1,
          });
          setAtts((prev) => [...prev, item].slice(0, MAX_ATTACHMENTS));
          setErr("");
        }}
      />
    </div>
  );
}
