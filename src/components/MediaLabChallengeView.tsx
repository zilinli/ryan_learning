"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  appendVoiceTranscript,
  challengePromptSpeechText,
  choiceLetter,
  type ChallengeItem,
} from "@/lib/entertain/ted-challenge";
import { canSubmitHybrid } from "@/lib/entertain/ted-challenge-handoff";
import { stashLabChallengeKickoff } from "@/lib/entertain/lab-challenge-handoff";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import type { LabDiscussId } from "@/lib/entertain/lab-discuss";
import { useRyanBritishListen } from "@/hooks/useRyanBritishListen";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { LabDiscussDialogue } from "./LabDiscussDialogue";

export type AnswerRecord = { selected: number[]; essay: string };

type DiscussKickoff = {
  talkTitle: string;
  speaker: string;
  kind: string;
  prompt: string;
  choices: string[];
  selected: number[];
  essay: string;
};

type Props = {
  lab: LabDiscussId;
  /** Learning turn source tag */
  source: "bbc" | "rsa" | "natgeo";
  title: string;
  speaker: string;
  items: ChallengeItem[];
  qi: number;
  setQi: (n: number) => void;
  answers: Record<string, AnswerRecord>;
  setAnswers: Dispatch<SetStateAction<Record<string, AnswerRecord>>>;
  accountId: string;
  busy?: boolean;
  onSave: () => void | Promise<void>;
  onBack: () => void;
  onBrowseAnother: () => void;
  anotherLabel: string;
};

export function MediaLabChallengeView({
  lab,
  source,
  title,
  speaker,
  items,
  qi,
  setQi,
  answers,
  setAnswers,
  accountId,
  busy = false,
  onSave,
  onBack,
  onBrowseAnother,
  anotherLabel,
}: Props) {
  const [error, setError] = useState("");
  const [discussKickoff, setDiscussKickoff] = useState<DiscussKickoff | null>(
    null,
  );
  const [discussSessionKey, setDiscussSessionKey] = useState(0);
  const [submittingDiscuss, setSubmittingDiscuss] = useState(false);
  const {
    auto: promptListenAuto,
    listening: promptListening,
    play: playPromptListen,
    stop: stopPromptListen,
    toggleAuto: togglePromptListenAuto,
  } = useRyanBritishListen(accountId || "acct_ryan");

  const item = items[qi];
  const frozen = Boolean(discussKickoff);
  const record = item ? answers[item.id] : undefined;
  const selected = record?.selected ?? [];
  const essay = record?.essay ?? "";

  const setSelected = useCallback(
    (next: number[]) => {
      if (!item || frozen) return;
      setAnswers((a) => ({
        ...a,
        [item.id]: { essay: a[item.id]?.essay || "", selected: next },
      }));
    },
    [item, frozen, setAnswers],
  );

  const setEssay = useCallback(
    (next: string) => {
      if (!item || frozen) return;
      setAnswers((a) => ({
        ...a,
        [item.id]: {
          selected: a[item.id]?.selected || [],
          essay: next,
        },
      }));
    },
    [item, frozen, setAnswers],
  );

  const submitAndDiscuss = useCallback(() => {
    if (!item || submittingDiscuss || discussKickoff) return;
    const gate = canSubmitHybrid(essay, selected);
    if (!gate.ok) {
      setError(gate.reason || "Write your essay first.");
      return;
    }
    stopPromptListen();
    setError("");
    setSubmittingDiscuss(true);
    const essayTrim = essay.trim();
    setAnswers((prev) => ({
      ...prev,
      [item.id]: { selected: [...selected], essay: essayTrim },
    }));
    const choiceNote =
      selected.length > 0
        ? selected.map(choiceLetter).join(", ")
        : "(none — own view)";
    void recordStudioLearningTurn({
      accountId: accountId || "acct_ryan",
      source,
      title,
      userText: [
        `[${lab.toUpperCase()} Lab]`,
        title,
        `Prompt (${item.kind}): ${item.prompt}`,
        `Choices: ${choiceNote}`,
        `Essay: ${essayTrim}`,
      ].join("\n"),
      assistantText: `Opened inline ${lab} discuss on Lab (prompt kept visible).`,
      outcome: "practice",
    });
    setDiscussKickoff({
      talkTitle: title,
      speaker,
      kind: item.kind,
      prompt: item.prompt,
      choices: item.choices,
      selected: [...selected],
      essay: essayTrim,
    });
    setDiscussSessionKey((k) => k + 1);
    setSubmittingDiscuss(false);
  }, [
    item,
    submittingDiscuss,
    discussKickoff,
    essay,
    selected,
    setAnswers,
    accountId,
    source,
    title,
    speaker,
    lab,
    stopPromptListen,
  ]);

  const closeDiscuss = useCallback(() => {
    stopPromptListen();
    setDiscussKickoff(null);
  }, [stopPromptListen]);

  const goNextAfterDiscuss = useCallback(() => {
    stopPromptListen();
    setDiscussKickoff(null);
    const next = qi + 1;
    if (next >= items.length) {
      setError("");
      setQi(next);
      return;
    }
    setQi(next);
    setError("");
  }, [qi, items.length, setQi, stopPromptListen]);

  // Auto-read English prompt when the question changes (TED Listen parity).
  useEffect(() => {
    if (!item || discussKickoff) {
      if (!item) stopPromptListen();
      return;
    }
    if (!promptListenAuto) return;
    void playPromptListen(challengePromptSpeechText(item), item.id);
    return () => {
      stopPromptListen();
    };
  }, [
    item,
    qi,
    discussKickoff,
    promptListenAuto,
    playPromptListen,
    stopPromptListen,
  ]);

  if (!item) {
    return (
      <div className="mt-4 space-y-4 animate-fade-up text-center">
        <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-8 dark:bg-white/5">
          <p className="text-lg font-semibold text-[var(--ink)]">
            Challenge complete!
          </p>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            You worked through {items.length} questions with coaching.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void onSave()}
              className="rounded-xl bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Save to My Creations
            </button>
            <button
              type="button"
              onClick={onBrowseAnother}
              className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)] dark:bg-white/5"
            >
              {anotherLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 animate-fade-up">
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
      >
        &larr; Back
      </button>
      <div className="flex gap-1">
        {items.map((it, i) => (
          <div
            key={it.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < qi
                ? answers[it.id]
                  ? "bg-[var(--teal)]"
                  : "bg-[var(--coral)]/50"
                : i === qi
                  ? "bg-[var(--teal)]/40"
                  : "bg-[var(--line)]"
            }`}
          />
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
          Q{qi + 1}/{items.length} · {item.kind}
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--ink)]">
          {item.prompt}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (promptListening) {
                stopPromptListen();
                return;
              }
              void playPromptListen(challengePromptSpeechText(item), item.id);
            }}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              promptListening
                ? "bg-[var(--teal)]/20 text-[var(--teal)]"
                : "border border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--teal)] hover:text-[var(--teal)]"
            }`}
            aria-label={promptListening ? "Stop reading" : "Listen to prompt"}
            title={
              promptListening
                ? "Stop reading"
                : "Listen to prompt (Ryan British)"
            }
          >
            {promptListening ? "Stop" : "Listen"}
          </button>
          <button
            type="button"
            onClick={togglePromptListenAuto}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              promptListenAuto
                ? "border-[var(--teal)]/60 bg-[var(--teal)]/10 text-[var(--teal)]"
                : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--teal)]/50"
            }`}
            aria-pressed={promptListenAuto}
            aria-label={
              promptListenAuto ? "Auto Listen on" : "Auto Listen off"
            }
            title={
              promptListenAuto
                ? "Auto Listen on — tap to mute prompt reading"
                : "Auto Listen off — tap to auto-read English prompts"
            }
          >
            {promptListenAuto ? "Auto Listen on" : "Auto Listen off"}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {item.choices.map((choice, ci) => {
          const isSelected = selected.includes(ci);
          return (
            <button
              key={ci}
              type="button"
              disabled={frozen}
              onClick={() => {
                const prev = selected;
                const next = prev.includes(ci)
                  ? prev.filter((i) => i !== ci)
                  : [...prev, ci];
                setSelected(next);
              }}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:opacity-80 ${
                isSelected
                  ? "border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--ink)]"
                  : "border-[var(--line)] bg-white/70 text-[var(--ink-muted)] hover:border-[var(--teal)]/50 dark:bg-white/5"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isSelected
                    ? "bg-[var(--teal)] text-white"
                    : "bg-[var(--mist)] text-[var(--ink-muted)]"
                }`}
              >
                {choiceLetter(ci)}
              </span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-[var(--ink-muted)]">
          Explain your reasoning · Speak or type
        </p>
        <div className="flex gap-2">
          <textarea
            value={essay}
            disabled={frozen}
            onChange={(e) => setEssay(e.target.value)}
            placeholder="Explain your answer (论述)…"
            rows={3}
            className="min-h-[5rem] w-full flex-1 resize-y rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] disabled:opacity-80 dark:bg-white/10"
          />
          <MicTranscribeButton
            language="en"
            disabled={busy || frozen}
            onRecordingStart={stopPromptListen}
            onTranscript={(t) =>
              setEssay(appendVoiceTranscript(essay, t))
            }
          />
        </div>
      </div>
      {!discussKickoff ? (
        <button
          type="button"
          onClick={submitAndDiscuss}
          disabled={busy || submittingDiscuss}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45"
        >
          {submittingDiscuss ? "Opening discuss…" : "Submit & discuss"}
        </button>
      ) : null}
      {discussKickoff ? (
        <div className="space-y-3">
          <LabDiscussDialogue
            lab={lab}
            accountId={accountId}
            kickoff={discussKickoff}
            sessionKey={discussSessionKey}
            hasNext={qi < items.length - 1}
            onNextQuestion={goNextAfterDiscuss}
            onClose={closeDiscuss}
          />
          <button
            type="button"
            onClick={() => {
              if (!discussKickoff) return;
              stashLabChallengeKickoff({
                lab,
                title,
                speaker,
                kind: discussKickoff.kind,
                prompt: discussKickoff.prompt,
                choices: discussKickoff.choices,
                selected: discussKickoff.selected,
                essay: discussKickoff.essay,
                accountId: accountId || "acct_ryan",
              });
              window.location.href = "/";
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--teal)]/40 bg-[var(--teal)]/8 px-3 py-2.5 text-xs font-medium text-[var(--teal)] transition hover:border-[var(--teal)]/70"
          >
            Continue in the main chat
            <span aria-hidden>↗</span>
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
