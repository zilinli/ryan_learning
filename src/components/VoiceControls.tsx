"use client";

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
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { sttLangFromVoice } from "@/lib/stt-lang";
import {
  getTutorVoice,
  loadSpeakEnabled,
  loadVoiceId,
  saveSpeakEnabled,
  saveVoiceId,
  TUTOR_VOICES,
  type TutorVoiceId,
} from "@/lib/voices";
import {
  blobLooksSilent,
  filenameForAudioBlob,
  startWavRecorder,
} from "@/lib/wav-recorder";

export type SpeakStreamApi = {
  prepare: () => Promise<void>;
  begin: () => void;
  push: (delta: string) => void;
  finish: (fullText: string) => void;
  stop: () => void;
  unlocked: () => boolean;
};

type Props = {
  disabled?: boolean;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (v: boolean) => void;
  onVoiceIdChange?: (id: TutorVoiceId) => void;
  onTranscript: (text: string) => void;
  onSpeakApi?: (api: SpeakStreamApi | null) => void;
};

type RecorderSession = {
  stop: () => Promise<Blob>;
};

export function VoiceControls({
  disabled,
  voiceEnabled,
  onVoiceEnabledChange,
  onVoiceIdChange,
  onTranscript,
  onSpeakApi,
}: Props) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hint, setHint] = useState("");
  const [httpsLink, setHttpsLink] = useState("");
  const [status, setStatus] = useState("");
  const [touchMode, setTouchMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceId, setVoiceId] = useState<TutorVoiceId>("auto");
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [speakError, setSpeakError] = useState(false);

  const pointerActiveRef = useRef(false);
  const recorderRef = useRef<RecorderSession | null>(null);
  const wantSpeakRef = useRef(voiceEnabled);
  const speakTokenRef = useRef(0);
  const voiceIdRef = useRef<TutorVoiceId>("auto");
  const onSpeakApiRef = useRef(onSpeakApi);
  const menuRef = useRef<HTMLDivElement | null>(null);
  onSpeakApiRef.current = onSpeakApi;

  useEffect(() => {
    const id = loadVoiceId();
    setVoiceId(id);
    voiceIdRef.current = id;
    onVoiceIdChange?.(id);
    const enabled = loadSpeakEnabled();
    wantSpeakRef.current = enabled;
    if (enabled !== voiceEnabled) onVoiceEnabledChange(enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wantSpeakRef.current = voiceEnabled;
    saveSpeakEnabled(voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    setTouchMode(isCoarsePointer());
    const secure = isSecureMediaContext();
    const upgrade = `https://${window.location.hostname}${window.location.pathname}`;
    if (!secure) {
      setSupported(false);
      setHttpsLink(upgrade);
      setHint("Needs HTTPS for mic & voice.");
      if (window.location.protocol === "http:") {
        window.location.replace(upgrade);
      }
      return;
    }
    if (!canRecordAudio()) {
      setHttpsLink("");
      setHint("Mic unavailable — typing works. Speak may still work.");
    }
    setSupported(true);
  }, []);

  // Close voice menu on outside click
  useEffect(() => {
    if (!voiceMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVoiceMenuOpen(false);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [voiceMenuOpen]);

  const makeHandlers = useCallback(() => {
    const token = speakTokenRef.current;
    const voice = getTutorVoice(voiceIdRef.current);
    return {
      voiceId: voice.id,
      voice: voice.edgeVoice,
      shouldContinue: () =>
        token === speakTokenRef.current && wantSpeakRef.current,
      onStatus: (s: string) => {
        if (token !== speakTokenRef.current) return;
        setStatus(s);
        setSpeaking(Boolean(s));
        setSpeakError(false);
      },
      onError: (message: string) => {
        if (token !== speakTokenRef.current) return;
        setHint(message.slice(0, 100));
        setStatus("");
        setSpeaking(false);
        setSpeakError(true);
      },
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
    setSpeaking(false);
    setStatus("");
    setSpeakError(false);
    getSharedSpeechEngine().stop();
  }, []);

  const runSpeak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      speakTokenRef.current += 1;
      const handlers = makeHandlers();
      setSpeaking(true);
      setSpeakError(false);
      setHint("");
      const result = await getSharedSpeechEngine().speak(text, handlers);
      if (handlers.shouldContinue?.() === false) return;
      if (result === "played") {
        setHint("");
        setStatus("");
        setSpeakError(false);
      }
      setSpeaking(false);
    },
    [makeHandlers],
  );

  useEffect(() => {
    const api: SpeakStreamApi = {
      prepare: async () => {
        if (!wantSpeakRef.current) return;
        try {
          await getSharedSpeechEngine().unlock();
        } catch {
          // Send still proceeds
        }
      },
      begin: () => {
        if (!wantSpeakRef.current) return;
        speakTokenRef.current += 1;
        setSpeaking(true);
        setSpeakError(false);
        setHint("");
        getSharedSpeechEngine().beginStream(makeHandlers());
      },
      push: (delta: string) => {
        if (!wantSpeakRef.current || !delta) return;
        getSharedSpeechEngine().streamPush(delta, makeHandlers());
      },
      finish: (fullText: string) => {
        if (!wantSpeakRef.current) return;
        getSharedSpeechEngine().finishReply(fullText, makeHandlers());
        setSpeaking(true);
      },
      stop: () => stopSpeaking(),
      unlocked: () => getSharedSpeechEngine().isUnlocked(),
    };
    onSpeakApiRef.current?.(api);
    return () => {
      onSpeakApiRef.current?.(null);
    };
  }, [makeHandlers, stopSpeaking]);

  useEffect(
    () => () => {
      stopSpeaking();
      void recorderRef.current?.stop().catch(() => undefined);
      recorderRef.current = null;
    },
    [stopSpeaking],
  );

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setStatus("Recognizing…");
      setHint("");
      try {
        if (await blobLooksSilent(blob)) {
          throw new Error("Too quiet — hold Mic closer and speak clearly");
        }
        const body = new FormData();
        body.append("audio", blob, filenameForAudioBlob(blob));
        body.append("language", sttLangFromVoice(voiceIdRef.current));
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
        onTranscript(text);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Recognition failed";
        setHint(
          /abort|timeout/i.test(msg)
            ? "Recognition timed out — try a shorter sentence"
            : msg,
        );
        setStatus("");
      } finally {
        setBusy(false);
      }
    },
    [onTranscript],
  );

  const startListening = useCallback(async () => {
    if (disabled || busy) return;
    if (!isSecureMediaContext()) {
      setHttpsLink(`https://${window.location.hostname}/`);
      setHint("Mic needs HTTPS");
      return;
    }
    stopSpeaking();
    try {
      await getSharedSpeechEngine().unlock();
    } catch {
      // ignore
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
  }, [busy, disabled, stopSpeaking]);

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

  const toggleSpeak = async () => {
    const next = !voiceEnabled;
    wantSpeakRef.current = next;
    onVoiceEnabledChange(next);
    saveSpeakEnabled(next);
    if (!next) {
      stopSpeaking();
      setHint("Speak off");
      return;
    }
    const voice = getTutorVoice(voiceIdRef.current);
    setHint(`Speak on \u00B7 ${voice.label}`);
    try {
      await getSharedSpeechEngine().unlock();
      void runSpeak(voice.preview);
    } catch {
      setHint("Could not start audio — tap Speak on again and raise media volume");
    }
  };

  const changeVoice = async (id: TutorVoiceId) => {
    setVoiceId(id);
    voiceIdRef.current = id;
    saveVoiceId(id);
    onVoiceIdChange?.(id);
    setVoiceMenuOpen(false);
    const voice = getTutorVoice(id);
    wantSpeakRef.current = true;
    if (!voiceEnabled) onVoiceEnabledChange(true);
    saveSpeakEnabled(true);
    try {
      await getSharedSpeechEngine().unlock();
      void runSpeak(voice.preview);
    } catch {
      setHint("Tap Speak on to enable sound for this voice");
    }
  };

  const currentVoice = getTutorVoice(voiceId);

  // ── RENDER as inline fragment (no flex-col wrapper) ──

  return (
    <>
      {/* Mic button — inline in toolbar */}
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
        className={`inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-1 rounded-full text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
          listening
            ? "bg-[var(--coral)] px-3 text-white"
            : busy
              ? "bg-[var(--teal)] px-3 text-white"
              : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)] px-2"
        } disabled:cursor-not-allowed disabled:opacity-40`}
        title={touchMode ? "Tap to talk \u00B7 tap again to send" : "Hold to talk"}
        aria-label="Mic \u2014 hold to talk"
        aria-pressed={listening}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="hidden sm:inline">
          {busy ? "..." : listening ? "Done" : touchMode ? "Mic" : "Hold to talk"}
        </span>
      </button>

      {/* Speak toggle — inline */}
      <button
        type="button"
        onClick={() => void toggleSpeak()}
        className={`inline-flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 items-center justify-center gap-1 rounded-full border text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
          voiceEnabled || speaking
            ? speaking
              ? "border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]"
              : speakError
                ? "border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--coral)]"
                : "border-[var(--teal)] bg-[var(--mist)] text-[var(--ink)]"
            : "border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
        }`}
        title={voiceEnabled ? "Speak on \u2014 tap to mute" : "Speak off \u2014 tap to read aloud"}
        aria-label={voiceEnabled ? "Speak on" : "Speak off"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
        <span className="hidden lg:inline">
          {speaking ? "Speaking..." : voiceEnabled ? "Speak on" : "Speak off"}
        </span>
      </button>

      {/* Voice selector — inline popover */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVoiceMenuOpen((o) => !o)}
          className={`inline-flex min-h-[2.75rem] shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:opacity-40 ${
            voiceMenuOpen
              ? "border-[var(--teal)] bg-[var(--mist)] text-[var(--ink)]"
              : "border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
          }`}
          title={`Voice: ${currentVoice.label}`}
          aria-label={`Voice: ${currentVoice.label}. Click to change.`}
        >
          <span className="hidden sm:inline">{currentVoice.label}</span>
          <span className="sm:hidden text-[11px]">
            {currentVoice.id === "auto" ? "Auto" : currentVoice.label.split("(")[0]!.trim()}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>

        {voiceMenuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 sm:hidden"
              aria-label="Close voice menu"
              onClick={() => setVoiceMenuOpen(false)}
            />
            <ul className="absolute bottom-full right-0 z-20 mb-1 w-52 rounded-xl border border-[var(--line)] bg-white/95 p-1 shadow-lg backdrop-blur">
              {TUTOR_VOICES.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void changeVoice(v.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      v.id === voiceId
                        ? "bg-[var(--mist)] font-medium text-[var(--ink)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span>{v.label}</span>
                    {v.id === voiceId ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </>
  );
}
