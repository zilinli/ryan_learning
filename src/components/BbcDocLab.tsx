"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLabCatalogSearch } from "./useLabCatalogSearch";
import {
  BBC_TOPICS,
  BBC_TOPIC_LABELS,
  searchBbcCatalog,
  type BbcClip,
  type BbcTopic,
} from "@/lib/entertain/bbc-catalog";
import type { ChallengeItem } from "@/lib/entertain/ted-challenge";
import {
  normalizeLearnerGrade,
  formatTedDifficultyLabel,
} from "@/lib/entertain/ted-challenge";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { youtubeEmbedUrl } from "@/lib/youtube-urls";
import { readResponseJson } from "@/lib/api-json";
import { useActiveStudioAccount } from "./StudioAccountBar";
import {
  MediaLabChallengeView,
  type AnswerRecord,
} from "./MediaLabChallengeView";
import { CrossLabSuggest } from "./CrossLabSuggest";

type Phase = "browse" | "watch" | "challenge";

const TOPICS: Array<BbcTopic | "all"> = ["all", ...BBC_TOPICS];

function formatDuration(sec: number): string {
  return ` · ${Math.round(sec / 60)} min`;
}

export function BbcDocLab() {
  const { accountId, grade, englishLevel } = useActiveStudioAccount();
  const [phase, setPhase] = useState<Phase>("browse");
  const [topic, setTopic] = useState<BbcTopic | "all">("all");
  const {
    query,
    setQuery,
    items: clips,
    listBusy,
    listSource,
    error: searchError,
    page,
    nbHits,
    hasNextPage,
    runSearch,
    refreshBatch,
  } = useLabCatalogSearch<BbcClip>({
    apiPath: "/api/bbc/search",
    resultKey: "clips",
    localSearch: (q, t) => searchBbcCatalog(q, t as BbcTopic | undefined),
    topic,
    grade,
  });
  const [selectedClip, setSelectedClip] = useState<BbcClip | null>(null);
  const [challengeReady, setChallengeReady] = useState(false);
  const [challenge, setChallenge] = useState<{
    items: ChallengeItem[];
  } | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const watchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const difficultyLabel = formatTedDifficultyLabel({ grade, englishLevel });

  useEffect(
    () => () => {
      if (watchTimer.current) clearTimeout(watchTimer.current);
    },
    [],
  );

  const openClip = useCallback((clip: BbcClip) => {
    setSelectedClip(clip);
    setChallenge(null);
    setQi(0);
    setAnswers({});
    setChallengeReady(false);
    setPhase("watch");
    if (watchTimer.current) clearTimeout(watchTimer.current);
    watchTimer.current = setTimeout(() => setChallengeReady(true), 45_000);
  }, []);

  const fetchChallenge = useCallback(async () => {
    if (!selectedClip) return null;
    const res = await fetch("/api/bbc/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: selectedClip.videoId,
        clip: selectedClip,
        learner: {
          grade: normalizeLearnerGrade(grade || undefined),
          englishLevel,
        },
      }),
    });
    const data = await readResponseJson<{
      ok?: boolean;
      error?: string;
      challenge?: { items: ChallengeItem[] };
    }>(res);
    if (!data.ok) throw new Error(data.error || "Failed");
    return data.challenge ?? null;
  }, [selectedClip, grade, englishLevel]);

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

  const saveChallenge = useCallback(async () => {
    if (!challenge || !selectedClip) return;
    try {
      const notes = challenge.items
        .map((item) => {
          const a = answers[item.id];
          return `${item.prompt}\nChoice: ${a?.selected.map((i) => item.choices[i]).join(", ") || "(none)"}\nEssay: ${a?.essay || "(none)"}`;
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
    } catch {
      setError("Could not save");
    }
  }, [challenge, selectedClip, answers, accountId]);

  if (phase === "browse") {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search BBC on YouTube — title, topic, keyword…"
            className="flex-1 min-h-11 rounded-xl border border-[var(--line)] bg-white/90 px-4 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10"
          />
          <button
            type="button"
            disabled={listBusy}
            onClick={() => void refreshBatch()}
            className="shrink-0 min-h-11 rounded-xl border border-[var(--coral)]/40 px-3 text-xs font-medium text-[var(--coral)] disabled:opacity-40"
          >
            {listBusy ? "⟳" : "Refresh batch"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
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
        <div className="flex items-center gap-2">
          {listSource === "loading" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              ⟳ Searching YouTube…
            </span>
          ) : listSource === "live" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
              ▶ YouTube Live · EN captions
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              📋 Curated
            </span>
          )}
          <span className="text-[11px] text-[var(--ink-muted)]">{nbHits} clips</span>
        </div>
        {searchError ? (
          <p className="text-xs text-[var(--coral)]">{searchError}</p>
        ) : null}
        {clips.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {clips.map((c) => (
              <li key={c.videoId}>
                <button
                  type="button"
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
                    <span>
                      G{c.gradeMin}-{c.gradeMax}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : !listBusy ? (
          <p className="py-8 text-center text-sm text-[var(--ink-muted)]">
            No clips found.
          </p>
        ) : null}
        {hasNextPage ? (
          <button
            type="button"
            disabled={listBusy}
            onClick={() => void runSearch({ page: page + 1, append: true })}
            className="w-full rounded-xl border border-[var(--line)] py-2 text-sm text-[var(--ink-muted)] hover:border-[var(--teal)] disabled:opacity-40"
          >
            Load more
          </button>
        ) : null}
      </div>
    );
  }

  if (phase === "watch" && selectedClip) {
    return (
      <div className="flex flex-1 flex-col bg-[#141210] text-[#e8e2d8]">
        <div className="shrink-0 border-b border-teal-800/40 px-3 py-2.5 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6db8a8]">
                BBC Doc Lab · listen · {difficultyLabel}
              </p>
              <h2 className="mt-0.5 truncate font-[family-name:var(--font-display,Georgia,serif)] text-base font-semibold sm:text-lg">
                {selectedClip.title}
              </h2>
              <p className="truncate text-xs text-[#a89f92]">
                {selectedClip.series} · {selectedClip.channel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPhase("browse");
                if (watchTimer.current) clearTimeout(watchTimer.current);
              }}
              className="shrink-0 min-h-9 rounded-lg px-2 text-xs text-[#a89f92] hover:text-white"
            >
              Catalog
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto w-full max-w-2xl shrink-0 overflow-hidden bg-black">
            <div
              className="relative w-full"
              style={{ height: "min(36vh, 240px)" }}
            >
              <iframe
                title={selectedClip.title}
                src={youtubeEmbedUrl(selectedClip.videoId)}
                className="absolute inset-0 h-full w-full border-0"
                allow="fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          <p className="px-3 py-2 text-center text-[11px] text-[#a89f92] sm:text-xs">
            Listen first — challenge uses English captions (CC), then discuss
            with the AI teacher.
          </p>
        </div>

        {/* P2-4 — cross-lab next stop */}
        <CrossLabSuggest
          from="bbc"
          tags={[selectedClip.topic, selectedClip.title]}
        />

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/15 bg-[#141210]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={!challengeReady || busy}
              onClick={() => void startChallenge()}
              className={`min-h-12 w-full rounded-xl px-5 text-sm font-semibold transition sm:w-auto sm:min-w-[12rem] ${
                challengeReady
                  ? "animate-pulse bg-[#4f7356] text-white hover:bg-[#3d5c44]"
                  : "cursor-not-allowed bg-white/10 text-white/45"
              }`}
            >
              {busy
                ? "Fetching EN captions & building…"
                : challengeReady
                  ? "Ready for challenge"
                  : "Ready for challenge (soon)"}
            </button>
            <button
              type="button"
              onClick={() => setChallengeReady(true)}
              className="min-h-11 w-full rounded-xl border border-white/20 px-4 text-sm transition hover:border-[#6db8a8] sm:w-auto"
            >
              I&apos;ve listened enough — unlock now
            </button>
          </div>
          {!challengeReady && (
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[#a89f92]">
              Challenge unlocks after ~45s, or tap unlock now.
            </p>
          )}
          {error && (
            <p className="mx-auto mt-2 max-w-3xl text-sm text-[#e09a7a]">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "challenge" && challenge && selectedClip) {
    return (
      <MediaLabChallengeView
        lab="bbc"
        source="bbc"
        title={selectedClip.title}
        speaker={selectedClip.channel}
        items={challenge.items}
        qi={qi}
        setQi={setQi}
        answers={answers}
        setAnswers={setAnswers}
        accountId={accountId || "acct_ryan"}
        busy={busy}
        onSave={saveChallenge}
        onBack={() => setPhase("browse")}
        onBrowseAnother={() => setPhase("browse")}
        anotherLabel="Watch another"
      />
    );
  }
  return null;
}
