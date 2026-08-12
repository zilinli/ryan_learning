"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BBC_TOPICS,
  BBC_TOPIC_LABELS,
  searchBbcCatalog,
  type BbcClip,
  type BbcTopic,
} from "@/lib/entertain/bbc-catalog";
import type { ChallengeItem } from "@/lib/entertain/ted-challenge";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { youtubeEmbedUrl } from "@/lib/youtube-urls";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";

type Phase = "browse" | "watch" | "challenge";
type AnswerRecord = { selected: number[]; essay: string };

const TOPICS: Array<BbcTopic | "all"> = ["all", ...BBC_TOPICS];

function formatDuration(sec: number): string {
  return ` · ${Math.round(sec / 60)} min`;
}

function choiceLetter(i: number): string {
  return "ABCD"[i] ?? String(i);
}

export function BbcDocLab() {
  const { accountId, grade } = useActiveStudioAccount();
  const [phase, setPhase] = useState<Phase>("browse");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<BbcTopic | "all">("all");
  const [clips, setClips] = useState<BbcClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<BbcClip | null>(null);
  const [challenge, setChallenge] = useState<Awaited<
    ReturnType<typeof fetchChallenge>
  > | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const embedRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const all = topic === "all"
      ? searchBbcCatalog("")
      : searchBbcCatalog("", topic);
    setClips(all);
  }, [topic]);

  const openClip = useCallback((clip: BbcClip) => {
    setSelectedClip(clip);
    setChallenge(null);
    setQi(0);
    setAnswers({});
    setPhase("watch");
  }, []);

  const fetchChallenge = useCallback(async () => {
    if (!selectedClip) return null;
    const res = await fetch("/api/bbc/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: selectedClip.videoId,
        learner: { grade: normalizeLearnerGrade(grade || undefined) },
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to load challenge");
    return data.challenge;
  }, [selectedClip, grade]);

  const startChallenge = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const ch = await fetchChallenge();
      setChallenge(ch);
      setQi(0);
      setAnswers({});
      setPhase("challenge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load challenge");
    } finally {
      setBusy(false);
    }
  }, [fetchChallenge]);

  const submitAnswer = useCallback(
    async (item: ChallengeItem, selected: number[], essay: string) => {
      if (!challenge || !selectedClip) return;
      setAnswers((prev) => ({ ...prev, [item.id]: { selected, essay } }));
      void recordStudioLearningTurn({
        accountId: accountId || "acct_ryan",
        source: "bbc",
        title: selectedClip.title,
        userText: [
          "[BBC Doc Lab]",
          selectedClip.title,
          `Q: ${item.prompt}`,
          `A: ${essay || selected.map((i) => item.choices[i]).join(", ")}`,
        ].join("\n"),
        outcome: "practice",
      });
    },
    [challenge, selectedClip, accountId],
  );

  const saveChallenge = useCallback(async () => {
    if (!challenge || !selectedClip) return;
    try {
      const notes = challenge.items
        .map((item: ChallengeItem) => {
          const a = answers[item.id];
          const chosen =
            a?.selected.map((i) => item.choices[i]).join(", ") || "(none)";
          return `${item.prompt}\nChoice: ${chosen}\nEssay: ${a?.essay || "(none)"}`;
        })
        .join("\n\n---\n\n");
      await fetch("/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bbc_challenge",
          title: selectedClip.title,
          notes,
          accountId,
        }),
      });
      notifyCreationsChanged();
      setError("");
    } catch {
      setError("Could not save — try again");
    }
  }, [challenge, selectedClip, answers, accountId]);

  const goBrowse = useCallback(() => {
    setPhase("browse");
    setChallenge(null);
    setSelectedClip(null);
  }, []);

  // ---- BROWSE ----
  if (phase === "browse") {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setClips(searchBbcCatalog(e.target.value, topic === "all" ? undefined : topic));
          }}
          placeholder="Search BBC documentaries about nature, science, history…"
          className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
        />
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                t === topic
                  ? "bg-[var(--teal)] text-white"
                  : "border border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] dark:bg-white/5"
              }`}
            >
              {t === "all" ? "All" : BBC_TOPIC_LABELS[t]}
            </button>
          ))}
        </div>
        {clips.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {clips.map((c) => (
              <li key={c.videoId}>
                <button
                  onClick={() => openClip(c)}
                  className="flex w-full flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] hover:shadow-sm dark:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)]">
                      {c.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--mist)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                      {c.channel}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                    {c.blurb}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--ink-muted)]/70">
                    <span>{c.series}</span>
                    <span>{formatDuration(c.durationSec)}</span>
                    <span>G{c.gradeMin}-{c.gradeMax}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--ink-muted)]">
            No clips found for "{query || topic}".
          </p>
        )}
      </div>
    );
  }

  // ---- WATCH ----
  if (phase === "watch" && selectedClip) {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <button
          onClick={goBrowse}
          className="flex items-center gap-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to documentaries
        </button>
        <div>
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {selectedClip.title}
          </h2>
          <p className="mt-1 flex gap-2 text-xs text-[var(--ink-muted)]">
            <span>{selectedClip.series}</span>
            <span>{selectedClip.channel}</span>
            <span>{formatDuration(selectedClip.durationSec)}</span>
          </p>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
          <iframe
            ref={embedRef}
            src={youtubeEmbedUrl(selectedClip.videoId)}
            title={selectedClip.title}
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={startChallenge}
            disabled={busy}
            className="flex items-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-40"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Loading…
              </>
            ) : (
              "Take the Challenge"
            )}
          </button>
        </div>
        {error ? (
          <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // ---- CHALLENGE ----
  if (phase === "challenge" && challenge) {
    const item = challenge.items[qi];
    if (!item) {
      return (
        <div className="mt-4 space-y-4 animate-fade-up text-center">
          <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-8 dark:bg-white/5">
            <p className="text-lg font-semibold text-[var(--ink)]">
              Challenge complete!
            </p>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              Great viewing! You answered {challenge.items.length} questions on "
              {challenge.title}".
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => void saveChallenge()}
                className="rounded-xl bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Save to My Creations
              </button>
              <button
                onClick={goBrowse}
                className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)] dark:bg-white/5"
              >
                Watch another documentary
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <button
          onClick={goBrowse}
          className="flex items-center gap-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to documentaries
        </button>
        <div className="flex gap-1">
          {challenge.items.map((_: ChallengeItem, i: number) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < qi
                  ? answers[challenge.items[i].id]
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
            Question {qi + 1} of {challenge.items.length} &middot; {item.kind}
          </p>
          <p className="text-[15px] leading-relaxed text-[var(--ink)]">
            {item.prompt}
          </p>
        </div>
        <div className="space-y-2">
          {item.choices.map((choice: string, ci: number) => {
            const isSelected = answers[item.id]?.selected?.includes(ci);
            return (
              <button
                key={ci}
                onClick={() => {
                  const prev = answers[item.id]?.selected || [];
                  const next = prev.includes(ci)
                    ? prev.filter((i) => i !== ci)
                    : [...prev, ci];
                  setAnswers((a) => ({
                    ...a,
                    [item.id]: {
                      ...(a[item.id] || { essay: "", selected: [] }),
                      selected: next,
                    },
                  }));
                }}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
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
        <div className="flex gap-2">
          <textarea
            value={answers[item.id]?.essay || ""}
            onChange={(e) =>
              setAnswers((a) => ({
                ...a,
                [item.id]: {
                  ...(a[item.id] || { selected: [], essay: "" }),
                  essay: e.target.value,
                },
              }))
            }
            placeholder="Explain your answer…"
            rows={3}
            className="min-h-[5rem] w-full flex-1 resize-y rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
          />
          <MicTranscribeButton
            language="en"
            disabled={busy}
            onTranscript={(t: string) =>
              setAnswers((a) => ({
                ...a,
                [item.id]: {
                  ...(a[item.id] || { selected: [], essay: "" }),
                  essay: ((a[item.id]?.essay || "") + " " + t).trim(),
                },
              }))
            }
          />
        </div>
        <button
          onClick={() => {
            const record = answers[item.id];
            void submitAnswer(item, record?.selected || [], record?.essay || "");
            if (qi < challenge.items.length - 1) setQi(qi + 1);
          }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45"
        >
          {qi < challenge.items.length - 1
            ? "Submit & Next"
            : "Complete Challenge"}
        </button>
        {error ? (
          <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}
