"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PodcastShow } from "@/lib/entertain/podcast-catalog";
import type { PodcastEpisode } from "@/lib/entertain/podcast-rss";
import { episodeDurationLabel } from "@/lib/entertain/podcast-challenge";
import type { ChallengeItem } from "@/lib/entertain/ted-challenge";
import { formatTedDifficultyLabel } from "@/lib/entertain/ted-challenge";
import { readResponseJson } from "@/lib/api-json";
import { useActiveStudioAccount } from "./StudioAccountBar";
import {
  MediaLabChallengeView,
  type AnswerRecord,
} from "./MediaLabChallengeView";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { CrossLabSuggest } from "./CrossLabSuggest";

type Phase = "shows" | "episodes" | "listen" | "challenge";

type TranscriptJob = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  error?: string;
};

const TOPIC_FILTERS = ["all", "kids", "science", "ideas", "history", "society"] as const;
type TopicFilter = (typeof TOPIC_FILTERS)[number];

const TOPIC_LABELS: Record<TopicFilter, string> = {
  all: "All",
  kids: "Kids",
  science: "Science",
  ideas: "Ideas",
  history: "History",
  society: "Society",
};

export function PodcastLab() {
  const { accountId, age, grade, gradeBand, englishLevel } = useActiveStudioAccount();
  const [phase, setPhase] = useState<Phase>("shows");
  const [shows, setShows] = useState<PodcastShow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<TopicFilter>("all");

  const [selectedShow, setSelectedShow] = useState<PodcastShow | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [episodesBusy, setEpisodesBusy] = useState(false);

  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transcriptJob, setTranscriptJob] = useState<TranscriptJob | null>(null);
  const [challenge, setChallenge] = useState<{ items: ChallengeItem[] } | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const pollAbortRef = useRef<AbortController | null>(null);

  const learner = useMemo(
    () => ({ age, grade, gradeBand, englishLevel }),
    [age, grade, gradeBand, englishLevel],
  );
  const difficultyLabel = formatTedDifficultyLabel(learner);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/podcast/search");
        const data = await readResponseJson<{
          ok?: boolean;
          shows?: PodcastShow[];
          error?: string;
        }>(res);
        if (cancelled) return;
        if (!data.ok || !data.shows) throw new Error(data.error || "Failed");
        setShows(data.shows);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load shows");
      }
    })();
    return () => {
      cancelled = true;
      pollAbortRef.current?.abort();
    };
  }, []);

  const visibleShows = shows.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      s.topics.some((t) => t.toLowerCase().includes(q));
    const matchTopic =
      topicFilter === "all" ||
      s.topics.includes(topicFilter) ||
      (topicFilter === "kids" && s.kidFriendly);
    return matchQ && matchTopic;
  });

  const openShow = useCallback(async (show: PodcastShow) => {
    setSelectedShow(show);
    setEpisodes([]);
    setEpisodesBusy(true);
    setLoadError("");
    setPhase("episodes");
    try {
      const res = await fetch(`/api/podcast/search?show=${encodeURIComponent(show.id)}`);
      const data = await readResponseJson<{
        ok?: boolean;
        episodes?: PodcastEpisode[];
        error?: string;
      }>(res);
      if (!data.ok || !data.episodes) throw new Error(data.error || "Failed");
      setEpisodes(data.episodes);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load episodes");
    } finally {
      setEpisodesBusy(false);
    }
  }, []);

  const backToShows = useCallback(() => {
    pollAbortRef.current?.abort();
    setPhase("shows");
    setSelectedShow(null);
    setEpisode(null);
    setChallenge(null);
    setTranscriptJob(null);
    setError("");
  }, []);

  const openEpisode = useCallback((ep: PodcastEpisode) => {
    setEpisode(ep);
    setChallenge(null);
    setTranscriptJob(null);
    setError("");
    setPhase("listen");
  }, []);

  const buildChallenge = useCallback(async () => {
    if (!selectedShow || !episode || busy) return;
    setBusy(true);
    setError("");
    setTranscriptJob({ id: "", status: "queued", progress: 0 });
    try {
      const startRes = await fetch("/api/podcast/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show: selectedShow, episode }),
      });
      const startData = await readResponseJson<{
        ok?: boolean;
        job?: TranscriptJob;
        error?: string;
      }>(startRes);
      if (!startData.ok || !startData.job) {
        throw new Error(startData.error || "Could not start transcription");
      }
      let job = startData.job;
      setTranscriptJob(job);
      while (job.status === "queued" || job.status === "running") {
        await new Promise((r) => setTimeout(r, 5000));
        const ac = new AbortController();
        pollAbortRef.current = ac;
        const pollRes = await fetch(
          `/api/podcast/transcribe?id=${encodeURIComponent(job.id)}`,
          { signal: ac.signal },
        );
        const pollData = await readResponseJson<{
          ok?: boolean;
          job?: TranscriptJob;
        }>(pollRes);
        if (!pollData.ok || !pollData.job) throw new Error("Lost transcript job");
        job = pollData.job;
        setTranscriptJob(job);
      }
      if (job.status === "error") throw new Error(job.error || "Transcription failed");

      const chRes = await fetch("/api/podcast/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show: selectedShow, episode, learner }),
      });
      const chData = await readResponseJson<{
        ok?: boolean;
        challenge?: { items: ChallengeItem[] };
        status?: string;
        error?: string;
      }>(chRes);
      if (!chData.ok || !chData.challenge) {
        throw new Error(chData.error || "Could not build challenge");
      }
      setChallenge(chData.challenge);
      setQi(0);
      setAnswers({});
      setPhase("challenge");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed");
      setTranscriptJob(null);
    } finally {
      setBusy(false);
    }
  }, [selectedShow, episode, busy, learner]);

  const saveChallenge = useCallback(async () => {
    if (!challenge || !selectedShow || !episode) return;
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
          type: "podcast_challenge",
          title: `${selectedShow.title} · ${episode.title}`,
          talkSlug: `podcast:${selectedShow.id}:${episode.guid}`,
          notes,
          accountId,
        }),
      });
      notifyCreationsChanged(accountId);
    } catch {
      setError("Could not save to My Creations");
    }
  }, [challenge, selectedShow, episode, answers, accountId]);

  // ── Shows grid ────────────────────────────────────────────────────────
  if (phase === "shows" || phase === "episodes") {
    return (
      <div className="flex flex-1 flex-col bg-[#1a1814] text-[#e8e2d8]">
        <div className="border-b border-white/10 px-4 py-6">
          <p className="text-center text-[11px] uppercase tracking-[0.25em] text-[#6db8a8]">
            Studio · Podcast Lab
          </p>
          <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight">
            Listen. Then argue with it.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-[#a89f92]">
            Real podcast episodes — audio only. We turn the audio into text,
            then build a challenge at {difficultyLabel}.
          </p>
          <p className="mt-3 text-center text-[11px] text-[#8fb896]/90">
            First challenge on an episode needs a few minutes to transcribe.
            Later visits are instant.
          </p>
        </div>

        {phase === "shows" ? (
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-auto px-4 py-6">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shows — title, host, topic…"
              className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm outline-none focus:border-[#6db8a8]"
            />
            <div className="flex flex-wrap items-center gap-2">
              {TOPIC_FILTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopicFilter(t)}
                  className={`min-h-9 rounded-lg px-3 text-xs capitalize ${
                    topicFilter === t
                      ? "bg-[#4f7356] text-white"
                      : "border border-white/15 text-[#a89f92]"
                  }`}
                >
                  {TOPIC_LABELS[t]}
                </button>
              ))}
            </div>
            {loadError ? <p className="text-sm text-[#e09a7a]">{loadError}</p> : null}
            <ul className="space-y-2">
              {visibleShows.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void openShow(s)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-[#6db8a8]/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.title}</div>
                        <div className="mt-0.5 text-xs text-[#a89f92]">{s.host}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#6db8a8]/15 px-2 py-0.5 text-[10px] font-medium text-[#6db8a8]">
                        {s.kidFriendly ? "Kids" : "Listen"}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-snug text-[#c4b8a8]">
                      {s.blurb}
                    </p>
                  </button>
                </li>
              ))}
              {visibleShows.length === 0 && !loadError ? (
                <p className="py-8 text-center text-sm text-[#a89f92]">No shows found.</p>
              ) : null}
            </ul>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-auto px-4 py-6">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={backToShows}
                className="min-h-9 rounded-lg px-2 text-xs text-[#a89f92] hover:text-white"
              >
                ← All shows
              </button>
              <button
                type="button"
                disabled={episodesBusy}
                onClick={() => selectedShow && void openShow(selectedShow)}
                className="min-h-9 rounded-lg border border-white/15 px-3 text-xs text-[#a89f92] hover:border-[#6db8a8] disabled:opacity-40"
              >
                {episodesBusy ? "Loading…" : "Refresh episodes"}
              </button>
            </div>
            {selectedShow ? (
              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                <h3 className="text-sm font-semibold">{selectedShow.title}</h3>
                <p className="mt-1 text-[12px] leading-snug text-[#a89f92]">
                  {selectedShow.blurb}
                </p>
              </div>
            ) : null}
            {loadError ? <p className="text-sm text-[#e09a7a]">{loadError}</p> : null}
            {episodesBusy && episodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#a89f92]">
                Loading latest episodes…
              </p>
            ) : (
              <ul className="space-y-2">
                {episodes.map((ep) => (
                  <li key={ep.guid}>
                    <button
                      type="button"
                      onClick={() => openEpisode(ep)}
                      className="w-full rounded-xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-[#6db8a8]/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{ep.title}</div>
                          <div className="mt-1 text-[11px] text-[#a89f92]">
                            {episodeDurationLabel(ep.durationSec) || "Audio"}
                          </div>
                        </div>
                        <span aria-hidden className="shrink-0 text-[#6db8a8]">
                          ▶
                        </span>
                      </div>
                      {ep.description ? (
                        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[#c4b8a8]">
                          {ep.description}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
                {episodes.length === 0 && !episodesBusy ? (
                  <p className="py-8 text-center text-sm text-[#a89f92]">
                    No episodes with playable audio found.
                  </p>
                ) : null}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Listen phase ──────────────────────────────────────────────────────
  if (phase === "listen" && selectedShow && episode) {
    const transcribing = busy && transcriptJob;
    const progressPct = transcribing
      ? Math.round((transcriptJob?.progress ?? 0) * 100)
      : 0;
    return (
      <div className="flex flex-1 flex-col bg-[#141210] text-[#e8e2d8]">
        <div className="shrink-0 border-b border-teal-800/40 px-3 py-2.5 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6db8a8]">
                Podcast Lab · listen · {difficultyLabel}
              </p>
              <h2 className="mt-0.5 truncate font-[family-name:var(--font-display,Georgia,serif)] text-base font-semibold sm:text-lg">
                {episode.title}
              </h2>
              <p className="truncate text-xs text-[#a89f92]">
                {selectedShow.title} · {selectedShow.host}
                {episode.durationSec ? ` · ${episodeDurationLabel(episode.durationSec)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("episodes")}
              className="shrink-0 min-h-9 rounded-lg px-2 text-xs text-[#a89f92] hover:text-white"
            >
              Episodes
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-2xl shrink-0 px-4 py-4">
            <audio
              controls
              preload="metadata"
              src={episode.audioUrl}
              className="w-full"
              controlsList="nodownload"
            />
            {episode.description ? (
              <p className="mt-3 text-[12px] leading-relaxed text-[#a89f92]">
                {episode.description.slice(0, 600)}
              </p>
            ) : null}
          </div>

          {/* Cross-lab next stop */}
          <CrossLabSuggest from="podcast" tags={[...selectedShow.topics, episode.title]} />

          <div className="mx-auto w-full max-w-2xl px-4 pb-2">
            {transcribing ? (
              <div className="rounded-xl border border-[#6db8a8]/35 bg-black/35 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#e8e2d8]">
                    {transcriptJob?.status === "running"
                      ? "Turning audio into text…"
                      : "Starting transcription…"}
                  </p>
                  <span className="text-xs text-[#6db8a8]">{progressPct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#6db8a8] transition-all"
                    style={{ width: `${Math.max(6, progressPct)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-[#a89f92]">
                  Episodes can take a few minutes. You can keep listening while it works.
                </p>
              </div>
            ) : null}
            {error ? (
              <p className="mt-2 text-sm text-[#e09a7a]">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/15 bg-[#141210]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void buildChallenge()}
              className={`min-h-12 w-full rounded-xl px-5 text-sm font-semibold transition sm:w-auto sm:min-w-[12rem] ${
                busy
                  ? "cursor-wait bg-white/10 text-white/45"
                  : "animate-pulse bg-[#4f7356] text-white hover:bg-[#3d5c44]"
              }`}
            >
              {busy ? "Transcribing & building…" : "Ready for challenge"}
            </button>
            <p className="text-[11px] text-[#a89f92] sm:ml-2">
              Transcribe this episode, then answer questions with the AI teacher.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Challenge phase (TED-parity shared view) ──────────────────────────
  if (phase === "challenge" && challenge && selectedShow && episode) {
    return (
      <MediaLabChallengeView
        lab="podcast"
        source="podcast"
        title={episode.title}
        speaker={selectedShow.host || selectedShow.title}
        items={challenge.items}
        qi={qi}
        setQi={setQi}
        answers={answers}
        setAnswers={setAnswers}
        accountId={accountId || "acct_ryan"}
        busy={busy}
        onSave={saveChallenge}
        onBack={() => setPhase("listen")}
        onBrowseAnother={() => setPhase("episodes")}
        anotherLabel="Another episode"
      />
    );
  }

  return null;
}
