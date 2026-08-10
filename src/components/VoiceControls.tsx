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
import { interruptHint, planBargeIn } from "@/lib/speech-barge-in";
import {
  applyConfusableChoice,
  confirmOptions,
  confirmTimeoutMs,
  detectConfusable,
  type ConfusablePair,
} from "@/lib/voice-confusables";

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
  /** UI-B2a — parent shows composer status line while TTS is active */
  onSpeakingChange?: (speaking: boolean) => void;
  /** B3 — recent skill ids for confusable gating (voice path only) */
  recentSkillIds?: string[];
  /** B3 — surface confirm chips outside the toolbar row */
  onConfirmIntent?: (
    state: {
      line: string;
      options: string[];
      onPick: (chosen: string) => void;
      onDismiss: () => void;
    } | null,
  ) => void;
  /** Surface mic status/errors outside the toolbar flex row */
  onFeedback?: (feedback: {
    status: string;
    hint: string;
    httpsLink: string;
  }) => void;
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
  onSpeakingChange,
  recentSkillIds = [],
  onConfirmIntent,
}: Props) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    transcript: string;
    pair: ConfusablePair;
  } | null>(null);
  const [supported, setSupported] = useState(true);
  const [hint, setHint] = useState("");
  const [httpsLink, setHttpsLink] = useState("");
  const [status, setStatus] = useState("");
  const [touchMode, setTouchMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceId, setVoiceId] = useState<TutorVoiceId>("auto");
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [speakError, setSpeakError] = useState(false);
  const [dialectNotice, setDialectNotice] = useState<string | null>(null);

  const pointerActiveRef = useRef(false);
  const recorderRef = useRef<RecorderSession | null>(null);
  const wantSpeakRef = useRef(voiceEnabled);
  const speakTokenRef = useRef(0);
  const voiceIdRef = useRef<TutorVoiceId>("auto");
  const onSpeakApiRef = useRef(onSpeakApi);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    onSpeakApiRef.current = onSpeakApi;
  }, [onSpeakApi]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      const id = loadVoiceId();
      setVoiceId(id);
      voiceIdRef.current = id;
      onVoiceIdChange?.(id);
      const enabled = loadSpeakEnabled();
      wantSpeakRef.current = enabled;
      if (enabled !== voiceEnabled) onVoiceEnabledChange(enabled);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wantSpeakRef.current = voiceEnabled;
    saveSpeakEnabled(voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    onSpeakingChange?.(speaking);
  }, [speaking, onSpeakingChange]);

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
    }, 0);
    return () => clearTimeout(t);
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
        const token = speakTokenRef.current;
        getSharedSpeechEngine().finishReply(fullText, makeHandlers());
        setSpeaking(true);
        // 流式朗读结束时 pump 异步；轮询到空闲再熄灭 Speaking，避免假卡死
        const watch = window.setInterval(() => {
          if (token !== speakTokenRef.current) {
            window.clearInterval(watch);
            return;
          }
          if (!getSharedSpeechEngine().isBusy()) {
            window.clearInterval(watch);
            setSpeaking(false);
            setStatus("");
          }
        }, 200);
        window.setTimeout(() => window.clearInterval(watch), 180_000);
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

  const recentSkillsRef = useRef(recentSkillIds);
  useEffect(() => {
    recentSkillsRef.current = recentSkillIds;
  }, [recentSkillIds]);

  const confirmTimerRef = useRef<number | null>(null);
  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current != null) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  const resolveConfirm = useCallback(
    (transcript: string, pair: ConfusablePair | null, chosen?: string) => {
      clearConfirmTimer();
      setConfirm(null);
      onConfirmIntent?.(null);
      const out =
        pair && chosen
          ? applyConfusableChoice(transcript, pair, chosen)
          : transcript;
      onTranscript(out);
    },
    [clearConfirmTimer, onTranscript, onConfirmIntent],
  );

  useEffect(() => {
    if (!confirm) {
      onConfirmIntent?.(null);
      return;
    }
    const { transcript, pair } = confirm;
    onConfirmIntent?.({
      line: pair.confirmLine,
      options: confirmOptions(pair),
      onPick: (chosen) => resolveConfirm(transcript, pair, chosen),
      onDismiss: () => resolveConfirm(transcript, null),
    });
  }, [confirm, onConfirmIntent, resolveConfirm]);

  useEffect(
    () => () => {
      clearConfirmTimer();
      onConfirmIntent?.(null);
    },
    [clearConfirmTimer, onConfirmIntent],
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
        // B3 — voice-only confirm-intent (typed path never hits this)
        const pair = detectConfusable(text, recentSkillsRef.current);
        if (pair) {
          setConfirm({ transcript: text, pair });
          clearConfirmTimer();
          confirmTimerRef.current = window.setTimeout(() => {
            // VC5 — fail-open: send original transcript
            resolveConfirm(text, null);
          }, confirmTimeoutMs());
          return;
        }
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
    [onTranscript, clearConfirmTimer, resolveConfirm],
  );

  const startListening = useCallback(async () => {
    if (disabled || busy) return;
    if (!isSecureMediaContext()) {
      setHttpsLink(`https://${window.location.hostname}/`);
      setHint("Mic needs HTTPS");
      return;
    }
    // CA-4 / 4.1a — barge-in: stop TTS before recording (order from planBargeIn)
    const barge = planBargeIn();
    if (barge.stopSpeech) stopSpeaking();
    try {
      await getSharedSpeechEngine().unlock();
    } catch {
      // ignore
    }
    setHint("");
    setStatus("Listening… speak now");
    try {
      // Always prefer 16 kHz WAV (ScriptProcessor) for STT accuracy.
      // MediaRecorder WebM often fails ffmpeg EBML parse on short clips.
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
    const picked = getTutorVoice(id);
    if (picked.lang === "teo" || picked.lang === "hak" || picked.lang === "sha") {
      try {
        if (!window.localStorage.getItem("spark-dialect-notice-v11")) {
          window.localStorage.setItem("spark-dialect-notice-v11", "1");
          setDialectNotice(
            picked.lang === "teo"
              ? "闽南话：识别走讯飞 + 百炼 + 本地 SenseVoice 三层兜底；朗读走百炼闽南 TTS，无密钥时用粤语 edge 临时兜底。"
              : picked.lang === "hak"
              ? "客家话：识别走本地 SenseVoice + 百炼（如有密钥）；朗读走 FormoSpeech 真客语（繁体用字）。"
              : "上海话：识别走百炼 Fun-ASR（兜底: 讯飞→本地）；朗读走粤语 edge TTS + 吴语字符映射（暂无上海话 TTS 商业 API）。",
          );
        }
      } catch {
        // ignore
      }
    }
    const voice = picked;
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
      {/* Mic — large fixed tap target on phones (Chrome Android misses shifting targets) */}
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
        className={`relative inline-flex h-16 w-16 shrink-0 touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-full text-sm font-medium transition active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--teal)] sm:h-auto sm:min-h-[2.75rem] sm:w-auto sm:min-w-0 sm:flex-row sm:gap-1 sm:px-3 sm:active:scale-100 ${
          listening
            ? "bg-[var(--coral)] text-white"
            : busy
              ? "bg-[var(--teal)] text-white"
              : speaking
                ? "bg-[var(--teal)]/15 text-[var(--teal)] ring-2 ring-[var(--teal)]/50 animate-pulse"
                : "bg-[var(--mist)] text-[var(--ink)] hover:bg-[var(--mist)] hover:text-[var(--ink)] sm:bg-transparent sm:text-[var(--ink-muted)]"
        } disabled:cursor-not-allowed disabled:opacity-40`}
        title={
          speaking
            ? interruptHint(true)
            : touchMode
              ? "Tap to talk \u00B7 tap again to send"
              : "Hold to talk"
        }
        aria-label={
          speaking
            ? "Mic — tap to interrupt speech and talk"
            : touchMode
              ? "Mic \u2014 tap to talk, tap again to send"
              : "Mic \u2014 hold to talk"
        }
        aria-pressed={listening}
      >
        <svg className="h-7 w-7 sm:h-[18px] sm:w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        {/* Mobile: status under icon inside fixed box (no layout shift). Desktop: side label. */}
        <span
          className={
            listening || busy || speaking
              ? "text-[10px] leading-none sm:text-sm sm:leading-normal"
              : "hidden sm:inline"
          }
        >
          {busy
            ? "..."
            : listening
              ? "Done"
              : speaking
                ? "Interrupt"
                : "Hold to talk"}
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
            : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
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
              : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
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
            <ul className="absolute bottom-full right-0 z-20 mb-1 w-52 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1 shadow-lg backdrop-blur">
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

      {/* One-time dialect mode notice */}
      {dialectNotice ? (
        <div className="basis-full w-full flex items-start gap-2 rounded-lg border border-[var(--teal)]/30 bg-[var(--teal)]/5 px-3 py-2 text-xs leading-snug text-[var(--ink)]">
          <span aria-hidden>🪶</span>
          <span className="flex-1">{dialectNotice}</span>
          <button
            type="button"
            onClick={() => setDialectNotice(null)}
            className="shrink-0 rounded p-0.5 text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
            aria-label="Dismiss notice"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Status/errors must stay visible — toolbar is flex-wrap so basis-full drops to next line */}
      {status ? (
        <p className="basis-full w-full text-xs text-[var(--teal)]">{status}</p>
      ) : null}
      {hint ? (
        <p className="basis-full w-full text-xs leading-snug text-[var(--ink-muted)]">
          {hint}
        </p>
      ) : null}
      {httpsLink ? (
        <a
          href={httpsLink}
          className="basis-full w-full text-xs font-medium text-[var(--teal)] underline underline-offset-2"
        >
          Open secure page (HTTPS)
        </a>
      ) : null}
    </>
  );
}
