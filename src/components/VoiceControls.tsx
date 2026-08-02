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
import {
  getTutorVoice,
  loadSpeakEnabled,
  loadVoiceId,
  saveSpeakEnabled,
  saveVoiceId,
  TUTOR_VOICES,
  type TutorVoiceId,
} from "@/lib/voices";
import { startWavRecorder } from "@/lib/wav-recorder";

export type SpeakStreamApi = {
  /** Call from a user gesture (Send) before streaming starts */
  prepare: () => Promise<void>;
  begin: () => void;
  push: (delta: string) => void;
  /** Flush + speak full text if streaming produced nothing */
  finish: (fullText: string) => void;
  stop: () => void;
  unlocked: () => boolean;
};

type Props = {
  disabled?: boolean;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (v: boolean) => void;
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

  const pointerActiveRef = useRef(false);
  const recorderRef = useRef<RecorderSession | null>(null);
  const wantSpeakRef = useRef(voiceEnabled);
  const speakTokenRef = useRef(0);
  const voiceIdRef = useRef<TutorVoiceId>("auto");
  const onSpeakApiRef = useRef(onSpeakApi);
  onSpeakApiRef.current = onSpeakApi;

  useEffect(() => {
    const id = loadVoiceId();
    setVoiceId(id);
    voiceIdRef.current = id;
    // Sync parent if localStorage says speak on (default true)
    const enabled = loadSpeakEnabled();
    wantSpeakRef.current = enabled;
    if (enabled !== voiceEnabled) onVoiceEnabledChange(enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
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
      setHint(
        "Needs the secure page for mic & voice. Tap below, then allow the certificate warning.",
      );
      if (window.location.protocol === "http:") {
        window.location.replace(upgrade);
      }
      return;
    }
    // TTS works even if mic isn't available — don't disable Speak for that
    if (!canRecordAudio()) {
      setHttpsLink("");
      setHint("Mic unavailable — typing still works. Speak may still work.");
    }
    setSupported(true);
  }, []);

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
      },
      onError: (message: string) => {
        if (token !== speakTokenRef.current) return;
        setHint(
          /play|unlock|audio|NotAllowed|gesture/i.test(message)
            ? "Tap Speak on (or Send again) to allow sound, and check volume"
            : message.slice(0, 100),
        );
        setStatus("");
        setSpeaking(false);
      },
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
    setSpeaking(false);
    setStatus("");
    getSharedSpeechEngine().stop();
  }, []);

  const runSpeak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      speakTokenRef.current += 1;
      const handlers = makeHandlers();
      setSpeaking(true);
      setHint("");
      const result = await getSharedSpeechEngine().speak(text, handlers);
      if (handlers.shouldContinue?.() === false) return;
      if (result === "played") {
        setHint("");
        setStatus("");
      }
      setSpeaking(false);
    },
    [makeHandlers],
  );

  // Stable speak API for TutorShell (must NOT null-out on every parent re-render)
  useEffect(() => {
    const api: SpeakStreamApi = {
      prepare: async () => {
        if (!wantSpeakRef.current) return;
        try {
          await getSharedSpeechEngine().unlock();
        } catch {
          // Send still proceeds; finish() may surface a hint
        }
      },
      begin: () => {
        if (!wantSpeakRef.current) return;
        speakTokenRef.current += 1;
        setSpeaking(true);
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
        const body = new FormData();
        body.append("audio", blob, "speech.wav");
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body,
        });
        const data = (await res.json().catch(() => null)) as {
          text?: string;
          error?: string;
        } | null;
        if (!res.ok) {
          throw new Error(data?.error || "Recognition failed");
        }
        const text = (data?.text || "").trim();
        if (!text) throw new Error("Didn’t catch that — try again");
        setStatus("");
        onTranscript(text);
      } catch (err) {
        setHint(err instanceof Error ? err.message : "Recognition failed");
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
      setHint("Mic needs the secure HTTPS page");
      return;
    }

    stopSpeaking();
    // Unlock TTS in the same gesture as mic (helps next reply autoplay)
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
      setHint("Microphone blocked — allow mic in the browser address bar");
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
      if (blob.size < 4000) {
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
    setHint(`Speak on · ${voice.label}`);
    try {
      await getSharedSpeechEngine().unlock();
      void runSpeak(voice.preview);
    } catch {
      setHint(
        "Could not start audio — tap Speak on again and raise media volume",
      );
    }
  };

  const changeVoice = async (id: TutorVoiceId) => {
    setVoiceId(id);
    voiceIdRef.current = id;
    saveVoiceId(id);
    const voice = getTutorVoice(id);
    wantSpeakRef.current = true;
    if (!voiceEnabled) onVoiceEnabledChange(true);
    saveSpeakEnabled(true);
    try {
      await getSharedSpeechEngine().unlock();
      setHint(`Voice: ${voice.label}`);
      void runSpeak(voice.preview);
    } catch {
      setHint("Tap Speak on to enable sound for this voice");
    }
  };

  return (
    <div className="flex max-w-full flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
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
          className={`min-h-11 select-none rounded-full px-3 py-2 text-sm font-medium transition ${
            listening
              ? "bg-[var(--coral)] text-white shadow-lg shadow-[var(--coral)]/30"
              : busy
                ? "bg-[var(--teal)] text-white"
                : "bg-[var(--ink)] text-white hover:opacity-90"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          title={touchMode ? "Tap to talk / tap again to send" : "Hold to talk"}
          aria-pressed={listening}
        >
          {busy
            ? "Recognizing…"
            : listening
              ? touchMode
                ? "Tap to send"
                : "Release…"
              : touchMode
                ? "Mic"
                : "Hold to talk"}
        </button>
        <button
          type="button"
          onClick={() => void toggleSpeak()}
          className={`min-h-11 rounded-full border px-3 py-2 text-sm transition ${
            voiceEnabled || speaking
              ? "border-[var(--teal)] bg-[var(--mist)] text-[var(--ink)]"
              : "border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
          }`}
          title="Read replies aloud (on by default)"
        >
          {speaking ? "Speaking…" : voiceEnabled ? "Speak on" : "Speak off"}
        </button>
        <select
          value={voiceId}
          disabled={disabled}
          onChange={(e) => void changeVoice(e.target.value as TutorVoiceId)}
          className="min-h-11 max-w-[14rem] rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)]"
          title="Tutor voice / idioma"
          aria-label="Tutor voice"
        >
          {TUTOR_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      {status ? (
        <p className="max-w-[22rem] text-xs text-[var(--teal)]">{status}</p>
      ) : null}
      {hint ? (
        <span className="max-w-[22rem] text-xs leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      ) : null}
      {httpsLink ? (
        <a
          href={httpsLink}
          className="text-xs font-medium text-[var(--teal)] underline underline-offset-2"
        >
          Open secure page (HTTPS)
        </a>
      ) : null}
    </div>
  );
}
