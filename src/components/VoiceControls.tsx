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
  loadVoiceId,
  saveVoiceId,
  TUTOR_VOICES,
  type TutorVoiceId,
} from "@/lib/voices";
import { startWavRecorder } from "@/lib/wav-recorder";

export type SpeakStreamApi = {
  begin: () => void;
  push: (delta: string) => void;
  flush: () => void;
  stop: () => void;
  unlocked: () => boolean;
};

type Props = {
  disabled?: boolean;
  voiceEnabled: boolean;
  onVoiceEnabledChange: (v: boolean) => void;
  onTranscript: (text: string) => void;
  /** Parent registers streaming TTS (speak while reply is generating) */
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
  const [voiceId, setVoiceId] = useState<TutorVoiceId>("ava");

  const pointerActiveRef = useRef(false);
  const recorderRef = useRef<RecorderSession | null>(null);
  const wantSpeakRef = useRef(false);
  const speakTokenRef = useRef(0);
  const voiceIdRef = useRef<TutorVoiceId>("ava");

  useEffect(() => {
    const id = loadVoiceId();
    setVoiceId(id);
    voiceIdRef.current = id;
  }, []);

  useEffect(() => {
    wantSpeakRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    setTouchMode(isCoarsePointer());
    const secure = isSecureMediaContext();
    const upgrade = `https://${window.location.hostname}${window.location.pathname}`;
    if (!secure) {
      setSupported(false);
      setHttpsLink(upgrade);
      setHint(
        "Mic needs the secure page. Tap below, then allow the certificate warning.",
      );
      if (window.location.protocol === "http:") {
        window.location.replace(upgrade);
      }
      return;
    }
    if (!canRecordAudio()) {
      setSupported(false);
      setHttpsLink("");
      setHint("This browser can’t record audio — try Chrome / Safari");
      return;
    }
    setHttpsLink("");
    setSupported(true);
  }, []);

  const makeHandlers = useCallback(() => {
    const token = speakTokenRef.current;
    const voice = getTutorVoice(voiceIdRef.current);
    return {
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
          /play|unlock|audio|decode|NotAllowed/i.test(message)
            ? "No sound — tap Speak on again, check iPad volume (not mute), then retry"
            : message.slice(0, 80),
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
      const engine = getSharedSpeechEngine();
      speakTokenRef.current += 1;
      const handlers = makeHandlers();
      setSpeaking(true);
      setHint("");
      const result = await engine.speak(text, handlers);
      if (handlers.shouldContinue?.() === false) return;
      if (result === "played") {
        setHint("");
        setStatus("");
      }
      setSpeaking(false);
    },
    [makeHandlers],
  );

  // Expose streaming TTS API to parent (TutorShell)
  useEffect(() => {
    if (!onSpeakApi) return;
    const api: SpeakStreamApi = {
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
        setSpeaking(true);
      },
      flush: () => {
        if (!wantSpeakRef.current) return;
        getSharedSpeechEngine().streamFlush(makeHandlers());
      },
      stop: () => stopSpeaking(),
      unlocked: () => getSharedSpeechEngine().isUnlocked(),
    };
    onSpeakApi(api);
    return () => onSpeakApi(null);
  }, [onSpeakApi, makeHandlers, stopSpeaking]);

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

    if (!next) {
      stopSpeaking();
      setHint("");
      return;
    }

    const voice = getTutorVoice(voiceIdRef.current);
    setHint(`Voice on · ${voice.label} · turn iPad volume up`);
    try {
      // Critical: unlock HTMLAudioElement inside this tap (iPad Safari/Chrome)
      await getSharedSpeechEngine().unlock();
      void runSpeak(voice.preview);
    } catch {
      setHint(
        "Could not start audio — tap Speak on again, disable silent mode, raise volume",
      );
      wantSpeakRef.current = false;
      onVoiceEnabledChange(false);
    }
  };

  const changeVoice = async (id: TutorVoiceId) => {
    setVoiceId(id);
    voiceIdRef.current = id;
    saveVoiceId(id);
    const voice = getTutorVoice(id);
    if (wantSpeakRef.current || voiceEnabled) {
      wantSpeakRef.current = true;
      if (!voiceEnabled) onVoiceEnabledChange(true);
      try {
        await getSharedSpeechEngine().unlock();
      } catch {
        // ignore
      }
      setHint(`Voice: ${voice.label}`);
      void runSpeak(voice.preview);
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
          title="Read replies aloud as they stream in"
        >
          {speaking ? "Speaking…" : voiceEnabled ? "Speak on" : "Speak off"}
        </button>
        <select
          value={voiceId}
          disabled={disabled}
          onChange={(e) => void changeVoice(e.target.value as TutorVoiceId)}
          className="min-h-11 max-w-[11rem] rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)]"
          title="Tutor voice"
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
