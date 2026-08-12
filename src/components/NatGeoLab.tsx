"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  findNatGeoArticle,
  searchNatGeoCatalog,
  type NatGeoArticle,
  type NatGeoTopic,
  NATGEO_TOPICS,
  NATGEO_TOPIC_LABELS,
} from "@/lib/entertain/natgeo-catalog";
import type { NatGeoChallenge } from "@/lib/entertain/natgeo-challenge";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";
import type { ChallengeItem } from "@/lib/entertain/ted-challenge";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";

type Phase = "browse" | "read" | "challenge";
type AnswerRecord = { selected: number[]; essay: string };

const TOPICS: Array<NatGeoTopic | "all"> = ["all", ...NATGEO_TOPICS];

function formatGradeBand(article: NatGeoArticle): string {
  return `G${article.gradeMin}-G${article.gradeMax}`;
}

function choiceLetter(i: number): string {
  return "ABCD"[i] ?? String(i);
}

export function NatGeoLab() {
  const { accountId, grade } = useActiveStudioAccount();
  const [phase, setPhase] = useState<Phase>("browse");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<NatGeoTopic | "all">("all");
  const [articles, setArticles] = useState<NatGeoArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NatGeoArticle | null>(null);
  const [challenge, setChallenge] = useState<NatGeoChallenge | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [readSecs, setReadSecs] = useState(0);
  const [readReady, setReadReady] = useState(false);
  const searchRef = useRef(0);
  const readTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Browse: initial load
  useEffect(() => {
    const all = topic === "all"
      ? searchNatGeoCatalog("")
      : searchNatGeoCatalog("", topic);
    setArticles(all);
  }, [topic]);

  // Cleanup read timer
  useEffect(() => {
    return () => {
      if (readTimer.current) clearInterval(readTimer.current);
    };
  }, []);

  // Search handler
  const doSearch = useCallback(
    (q: string) => {
      const gen = ++searchRef.current;
      const filtered = searchNatGeoCatalog(q, topic === "all" ? undefined : topic);
      if (gen === searchRef.current) setArticles(filtered);
    },
    [topic],
  );

  // Open article
  const openArticle = useCallback((article: NatGeoArticle) => {
    setSelectedArticle(article);
    setChallenge(null);
    setQi(0);
    setAnswers({});
    setReadSecs(0);
    setReadReady(false);
    setPhase("read");

    if (readTimer.current) clearInterval(readTimer.current);
    // Auto-unlock at 30s
    readTimer.current = setInterval(() => {
      setReadSecs((s) => {
        if (s + 1 >= 30) {
          setReadReady(true);
          if (readTimer.current) clearInterval(readTimer.current);
          return 30;
        }
        return s + 1;
      });
    }, 1000);
  }, []);

  // Challenge generation
  const startChallenge = useCallback(async () => {
    if (!selectedArticle) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/natgeo/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedArticle.slug,
          learner: {
            grade: normalizeLearnerGrade(grade || undefined),
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load challenge");
      setChallenge(data.challenge);
      setQi(0);
      setAnswers({});
      setPhase("challenge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load challenge");
    } finally {
      setBusy(false);
    }
  }, [selectedArticle, grade]);

  // Submit single question for inline discussion
  const submitAnswer = useCallback(
    async (item: ChallengeItem, selected: number[], essay: string) => {
      if (!challenge || !selectedArticle) return;
      const key = item.id;
      setAnswers((prev) => ({ ...prev, [key]: { selected, essay } }));

      // Record BKT
      void recordStudioLearningTurn({
        accountId: accountId || "acct_ryan",
        source: "natgeo",
        title: selectedArticle.title,
        userText: [
          `[NatGeo Lab]`,
          selectedArticle.title,
          `Q: ${item.prompt}`,
          `A: ${essay || selected.map((i) => item.choices[i]).join(", ")}`,
        ].join("\n"),
        outcome: "practice",
      });
    },
    [challenge, selectedArticle, accountId],
  );

  // Save challenge
  const saveChallenge = useCallback(async () => {
    if (!challenge || !selectedArticle) return;
    try {
      const notes = challenge.items
        .map((item) => {
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
          type: "natgeo_challenge",
          title: selectedArticle.title,
          notes,
          accountId,
        }),
      });
      notifyCreationsChanged();
      setError("");
    } catch {
      setError("Could not save — try again");
    }
  }, [challenge, selectedArticle, answers, accountId]);

  // Back to browse
  const goBrowse = useCallback(() => {
    setPhase("browse");
    setChallenge(null);
    setSelectedArticle(null);
    if (readTimer.current) clearInterval(readTimer.current);
  }, []);

  // ---- BROWSE PHASE ----
  if (phase === "browse") {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        {/* Search */}
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              doSearch(e.target.value);
            }}
            placeholder="Search articles about animals, space, history…"
            className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
          />
        </div>

        {/* Topic chips */}
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
              {t === "all" ? "All" : NATGEO_TOPIC_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Article list */}
        {articles.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {articles.map((a) => (
              <li key={a.slug}>
                <button
                  onClick={() => openArticle(a)}
                  className="flex w-full flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] hover:shadow-sm dark:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)]">
                      {a.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--mist)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                      {NATGEO_TOPIC_LABELS[a.topic]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">
                    {a.blurb}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--ink-muted)]/70">
                    <span>{formatGradeBand(a)}</span>
                    <span>{a.readingTimeMin} min read</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--ink-muted)]">
            No articles found for "{query || topic}".
          </p>
        )}
      </div>
    );
  }

  // ---- READ PHASE ----
  if (phase === "read" && selectedArticle) {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        {/* Back */}
        <button
          onClick={goBrowse}
          className="flex items-center gap-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to articles
        </button>

        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {selectedArticle.title}
          </h2>
          <p className="mt-1 flex gap-2 text-xs text-[var(--ink-muted)]">
            <span>{NATGEO_TOPIC_LABELS[selectedArticle.topic]}</span>
            <span>{formatGradeBand(selectedArticle)}</span>
            <span>{selectedArticle.readingTimeMin} min read</span>
          </p>
        </div>

        {/* Article body */}
        <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white/85 p-5 text-[14px] leading-relaxed text-[var(--ink)] dark:bg-white/5">
          {selectedArticle.body.split("\n\n").map((p, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {p}
            </p>
          ))}
        </div>

        {/* Reading progress + CTA */}
        <div className="flex items-center justify-between gap-3">
          {!readReady ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Reading for {readSecs}s — challenge unlocks at 30s
            </p>
          ) : (
            <p className="text-xs font-medium text-[var(--teal)]">
              Ready for the challenge!
            </p>
          )}
          <div className="flex gap-2">
            {!readReady && (
              <button
                onClick={() => {
                  if (readTimer.current) clearInterval(readTimer.current);
                  setReadReady(true);
                  setReadSecs(30);
                }}
                className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] transition hover:bg-[var(--mist)] dark:bg-white/5"
              >
                I&apos;ve read enough — unlock now
              </button>
            )}
            <button
              onClick={startChallenge}
              disabled={!readReady || busy}
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
        </div>
        {error ? (
          <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // ---- CHALLENGE PHASE ----
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
              Great reading, {accountId ? "Ryan" : "student"}! You answered{" "}
              {challenge.items.length} questions on &quot;{challenge.title}&quot;.
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
                Read another article
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        {/* Back */}
        <button
          onClick={goBrowse}
          className="flex items-center gap-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
        >
          &larr; Back to articles
        </button>

        {/* Progress bar */}
        <div className="flex gap-1">
          {challenge.items.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < qi
                  ? answers[challenge.items[i]!.id]
                    ? "bg-[var(--teal)]"
                    : "bg-[var(--coral)]/50"
                  : i === qi
                    ? "bg-[var(--teal)]/40"
                    : "bg-[var(--line)]"
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">
            Question {qi + 1} of {challenge.items.length} &middot; {item.kind}
          </p>
          <p className="text-[15px] leading-relaxed text-[var(--ink)]">
            {item.prompt}
          </p>
        </div>

        {/* Choices */}
        <div className="space-y-2">
          {item.choices.map((choice, ci) => {
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
                    [item.id]: { ...(a[item.id] || { essay: "", selected: [] }), selected: next },
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

        {/* Essay + Mic */}
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
            placeholder="Explain your answer in your own words…"
            rows={3}
            className="min-h-[5rem] w-full flex-1 resize-y rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
          />
          <MicTranscribeButton
            language="en"
            disabled={busy}
            onTranscript={(t) =>
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

        {/* Submit */}
        <button
          onClick={() => {
            const record = answers[item.id];
            void submitAnswer(item, record?.selected || [], record?.essay || "");
            if (qi < challenge.items.length - 1) setQi(qi + 1);
          }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45"
        >
          {qi < challenge.items.length - 1 ? "Submit & Next" : "Complete Challenge"}
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
