"use client";

/**
 * Shared mic → STT control used by Dictionary / Translation.
 * Same pipeline as the main tutor: 16 kHz WAV + `/api/transcribe`
 * (Bailian Fun-ASR primary for teo/hak; iFlytek only if STT_BACKUP_IFYTEK=1).
 * MediaRecorder WebM is avoided — short clips often fail ffmpeg.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  canRecordAudio,
  isCoarsePointer,
  isSecureMediaContext,
} from "@/lib/media";
import {
  blobLooksSilent,
  filenameForAudioBlob,
  startWavRecorder,
} from "@/lib/wav-recorder";
import type { SttLang } from "@/lib/stt-lang";

type RecorderSession = {
  stop: () => Promise<Blob>;
};

type Props = {
  /** STT language hint forwarded to /api/transcribe */
  language?: SttLang;
  disabled?: boolean;
  onTranscript: (text: string) => void;
  className?: string;
};

export function MicTranscribeButton({
  language = "auto",
  disabled,
  onTranscript,
  className = "",
}: Props) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hint, setHint] = useState("");
  const [status, setStatus] = useState("");
  const [httpsLink, setHttpsLink] = useState("");
  const [touchMode, setTouchMode] = useState(false);

  const pointerActiveRef = useRef(false);
  const recorderRef = useRef<RecorderSession | null>(null);
  const languageRef = useRef(language);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    // Capability + coarse-pointer detection is corrected post-hydration.
    // Deferred so the initial SSR render isn't a setState-synchronously-in-effect.
    const t = setTimeout(() => {
      setTouchMode(isCoarsePointer());
      const secure = isSecureMediaContext();
      const upgrade = `https://${window.location.hostname}${window.location.pathname}`;
      if (!secure) {
        setSupported(false);
        setHttpsLink(upgrade);
        setHint("Needs HTTPS for mic.");
        return;
      }
      if (!canRecordAudio()) {
        setHint("Mic unavailable in this browser.");
      }
      setSupported(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      void recorderRef.current?.stop().catch(() => undefined);
      recorderRef.current = null;
    },
    [],
  );

  const transcribeBlob = useCallback(async (blob: Blob) => {
    setBusy(true);
    setStatus("Recognizing…");
    setHint("");
    try {
      if (await blobLooksSilent(blob)) {
        throw new Error("Too quiet — hold Mic closer and speak clearly");
      }
      const body = new FormData();
      body.append("audio", blob, filenameForAudioBlob(blob));
      body.append("language", languageRef.current);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(75_000),
      });
      const data = (await res.json().catch(() => null)) as {
        text?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(
          data?.error ||
            (res.status === 502 || res.status === 503
              ? "Voice service busy — wait a moment and try again"
              : "Recognition failed"),
        );
      }
      const text = (data?.text || "").trim();
      if (!text) throw new Error("Didn't catch that — try again louder");
      setStatus("");
      onTranscriptRef.current(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recognition failed";
      setHint(
        /abort|timeout/i.test(msg)
          ? "Recognition timed out — try a shorter word"
          : msg,
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (disabled || busy) return;
    if (!isSecureMediaContext()) {
      setHttpsLink(`https://${window.location.hostname}${window.location.pathname}`);
      setHint("Mic needs HTTPS");
      return;
    }
    setHint("");
    setStatus("Listening… speak now");
    try {
      const session = await startWavRecorder();
      recorderRef.current = session;
      setListening(true);
    } catch {
      recorderRef.current = null;
      setListening(false);
      setStatus("");
      setHint("Microphone blocked — allow mic in browser address bar");
    }
  }, [busy, disabled]);

  const stopListening = useCallback(async () => {
    const session = recorderRef.current;
    recorderRef.current = null;
    if (!session) {
      setListening(false);
      return;
    }
    setStatus("Finishing…");
    setListening(false);
    try {
      const blob = await session.stop();
      if (blob.size < 2500) {
        setHint("Too short — tap Mic, speak, then tap again");
        setStatus("");
        return;
      }
      await transcribeBlob(blob);
    } catch {
      setHint("Recording failed — try again");
      setStatus("");
    }
  }, [transcribeBlob]);

  const onMicClick = () => {
    if (busy) return;
    if (listening) void stopListening();
    else void startListening();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (touchMode || busy) return;
    if (e.button !== 0) return;
    pointerActiveRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    void startListening();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (touchMode || busy) return;
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    void stopListening();
  };

  return (
    <div className={`flex flex-col items-stretch gap-1 ${className}`}>
      <button
        type="button"
        disabled={disabled || !supported || busy}
        onClick={touchMode ? onMicClick : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          if (!touchMode && pointerActiveRef.current) {
            pointerActiveRef.current = false;
            void stopListening();
          }
        }}
        className={`relative inline-flex h-[3.25rem] w-[3.25rem] shrink-0 touch-manipulation select-none flex-col items-center justify-center rounded-xl border text-sm font-medium transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
          listening
            ? "border-[var(--coral)] bg-[var(--coral)] text-white animate-pulse-ring"
            : busy
              ? "border-[var(--teal)] bg-[var(--teal)] text-white"
              : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--teal)] dark:bg-[var(--surface-muted)]"
        } disabled:cursor-not-allowed disabled:opacity-40`}
        title={touchMode ? "Tap to talk · tap again to search" : "Hold to talk"}
        aria-label={
          touchMode
            ? "Mic — tap to talk, tap again to search"
            : "Mic — hold to talk"
        }
        aria-pressed={listening}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      {status ? (
        <p className="text-[11px] text-[var(--teal)]">{status}</p>
      ) : null}
      {hint ? (
        <p className="max-w-[10rem] text-[11px] leading-snug text-[var(--ink-muted)]">
          {hint}
        </p>
      ) : null}
      {httpsLink ? (
        <a
          href={httpsLink}
          className="text-[11px] font-medium text-[var(--teal)] underline underline-offset-2"
        >
          Open HTTPS
        </a>
      ) : null}
    </div>
  );
}
