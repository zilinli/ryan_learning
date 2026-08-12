"use client";

/**
 * P2 (report §8.11) — "read a passage to me" oral reading practice.
 * Flow: pick a passage → Listen (TTS) → read aloud (Mic/STT) → accuracy feedback.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { MicTranscribeButton } from "./MicTranscribeButton";
import {
  readingFeedback,
  scoreReading,
  type ReadingScore,
} from "@/lib/reading-assessment";

type Passage = {
  id: string;
  title: string;
  text: string;
  /** TTS language hint: "en" / "zh" */
  lang: "en" | "zh";
};

const PASSAGES: Passage[] = [
  {
    id: "cat",
    title: "The cat",
    lang: "en",
    text: "The cat sat on the mat. The dog sat on the log. The cat and the dog are happy.",
  },
  {
    id: "sun",
    title: "The sun",
    lang: "en",
    text: "The sun is up. The birds sing in the trees. I can hear them from my window.",
  },
  {
    id: "frog",
    title: "The frog",
    lang: "en",
    text: "A green frog jumps in the pond. It says ribbit, ribbit. Then it swims away.",
  },
  {
    id: "catsit",
    title: "小猫咪",
    lang: "zh",
    text: "小猫咪坐在垫子上，看着窗外的小鸟。它很开心。",
  },
  {
    id: "moong",
    title: "月亮",
    lang: "zh",
    text: "月亮挂在天空上，像一个弯弯的香蕉。小兔抬头看月亮。",
  },
];

function voiceIdForLang(lang: "en" | "zh"): "ava" | "yunxi" {
  return lang === "zh" ? "yunxi" : "ava";
}

export function ReadAlongPractice() {
  const [passage, setPassage] = useState<Passage>(PASSAGES[0]!);
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState("");
  const [score, setScore] = useState<ReadingScore | null>(null);
  const [error, setError] = useState("");
  const passageRef = useRef(passage);
  passageRef.current = passage;

  const speakPassage = useCallback(() => {
    const engine = getSharedSpeechEngine();
    if (speaking) {
      engine.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    void engine.unlock().catch(() => undefined);
    engine
      .speak(passageRef.current.text, {
        voiceId: voiceIdForLang(passageRef.current.lang),
        onError: () => setSpeaking(false),
      })
      .then(() => setSpeaking(false))
      .catch(() => setSpeaking(false));
  }, [speaking]);

  const onTranscript = useCallback((text: string) => {
    setHeard(text);
    setScore(scoreReading(text, passageRef.current.text));
    setError("");
  }, []);

  useEffect(
    () => () => {
      getSharedSpeechEngine().stop();
    },
    [],
  );

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Read it aloud
        </p>
        <select
          value={passage.id}
          onChange={(e) => {
            const next = PASSAGES.find((p) => p.id === e.target.value) ?? PASSAGES[0]!;
            getSharedSpeechEngine().stop();
            setSpeaking(false);
            setPassage(next);
            setHeard("");
            setScore(null);
            setError("");
          }}
          className="min-h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 text-[13px]"
          aria-label="Choose a passage"
        >
          {PASSAGES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)]/70 bg-[var(--surface-muted)] p-3">
        <p className="text-[16px] leading-relaxed text-[var(--ink)]">
          {passage.text}
        </p>
        <button
          type="button"
          onClick={speakPassage}
          className={`mt-3 min-h-10 rounded-xl px-4 text-[13px] font-semibold transition ${
            speaking
              ? "bg-[var(--coral)] text-white"
              : "border border-[var(--line)] bg-[var(--surface)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
          }`}
        >
          {speaking ? "Stop" : "Listen first"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <MicTranscribeButton
          language={passage.lang}
          onTranscript={onTranscript}
          compact
        />
        <p className="max-w-[16rem] text-[12px] text-[var(--ink-muted)]">
          Tap the mic and read the passage out loud.
        </p>
      </div>

      {heard ? (
        <div className="mt-3 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            What I heard
          </p>
          <p className="mt-1 text-[14px] text-[var(--ink)]">{heard}</p>
          {score ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--mist)]">
                  <div
                    className="h-full rounded-full bg-[var(--teal)]"
                    style={{ width: `${score.accuracy}%` }}
                  />
                </div>
                <span className="tabular-nums text-[12px] font-semibold text-[var(--teal)]">
                  {score.accuracy}%
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink)]">
                {readingFeedback(score)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[13px] text-[var(--coral)]">{error}</p>
      ) : null}
    </section>
  );
}
