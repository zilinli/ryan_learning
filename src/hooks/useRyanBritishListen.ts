"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadTedPromptListenEnabled,
  saveTedPromptListenEnabled,
} from "@/lib/entertain/ted-challenge";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { cleanTutorSpeechText } from "@/lib/tts-text";

/** Hard-lock Edge ShortName — same as TED Challenge / homepage Ryan British. */
export const LAB_RYAN_EDGE_VOICE = "en-GB-RyanNeural";

/**
 * Shared British Ryan Listen for studio labs (prompt + discuss coach turns).
 * Reuses TED Auto Listen prefs so one habit covers all labs.
 */
export function useRyanBritishListen(accountId: string) {
  const [auto, setAuto] = useState(true);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    setAuto(loadTedPromptListenEnabled(accountId));
  }, [accountId]);

  const stop = useCallback(() => {
    tokenRef.current += 1;
    setListening(false);
    setSpeakingId(null);
    getSharedSpeechEngine().stop();
  }, []);

  const play = useCallback(async (raw: string, id?: string) => {
    const text = cleanTutorSpeechText(raw).trim();
    if (!text) return;
    const token = ++tokenRef.current;
    setListening(true);
    setSpeakingId(id ?? null);
    try {
      await getSharedSpeechEngine().unlock();
      if (token !== tokenRef.current) return;
      await getSharedSpeechEngine().speak(text, {
        voiceId: "ryan",
        voice: LAB_RYAN_EDGE_VOICE,
        shouldContinue: () => token === tokenRef.current,
        onStatus: (s) => {
          if (token !== tokenRef.current) return;
          setListening(Boolean(s));
          if (!s) setSpeakingId(null);
        },
        onError: () => {
          if (token !== tokenRef.current) return;
          setListening(false);
          setSpeakingId(null);
        },
      });
    } catch {
      // unlock / play blocked — manual Listen still available
    } finally {
      if (token === tokenRef.current) {
        setListening(false);
        setSpeakingId(null);
      }
    }
  }, []);

  const toggleAuto = useCallback(() => {
    const next = !auto;
    setAuto(next);
    saveTedPromptListenEnabled(next, accountId);
    if (!next) stop();
  }, [auto, accountId, stop]);

  useEffect(() => () => stop(), [stop]);

  return { auto, listening, speakingId, play, stop, toggleAuto };
}
