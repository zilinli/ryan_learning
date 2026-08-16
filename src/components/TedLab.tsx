"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  findTedTalk,
  tedEmbedUrl,
  tedTalkUrl,
  parseTedSlug,
  type TedTalk,
  type TedTopic,
} from "@/lib/entertain/ted-catalog";
import {
  formatTedAudienceChip,
  formatTedFitSortCaption,
  searchTedCatalogForLearner,
  uniqueTedTalks,
} from "@/lib/entertain/ted-fit";
import {
  appendVoiceTranscript,
  challengePromptSpeechText,
  choiceLetter,
  formatHybridAnswerNotes,
  formatTedDifficultyLabel,
  loadTedPromptListenEnabled,
  saveTedPromptListenEnabled,
  type TedChallenge,
  type ChallengeItem,
} from "@/lib/entertain/ted-challenge";
import {
  canSubmitHybrid,
  consumeTedChallengeResume,
  prepareTedChallengeHandoff,
  stashTedChallengeKickoff,
  stashTedChallengeResume,
  type TedChallengeKickoff,
  type TedChallengeResume,
} from "@/lib/entertain/ted-challenge-handoff";
import { TedDiscussDialogue } from "./TedDiscussDialogue";
import {
  recordStudioLearningTurn,
} from "@/lib/entertain/studio-learning";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";
import { CrossLabSuggest } from "./CrossLabSuggest";

type Phase = "browse" | "watch" | "challenge";
type ListSource = "ted-live" | "curated-fallback" | "loading";
type AnswerRecord = { selected: number[]; essay: string };

const TOPICS: Array<TedTopic | "all"> = [
  "all",
  "ideas",
  "science",
  "society",
  "education",
  "creativity",
  "technology",
];

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "";
  return ` · ${Math.round(sec / 60)} min`;
}

/** UI always allows multi-select; soft-score still uses item.choiceMode. */
function toggleChoice(prev: number[], index: number): number[] {
  return prev.includes(index)
    ? prev.filter((i) => i !== index)
    : [...prev, index].sort((a, b) => a - b);
}

export function TedLab() {
  const {
    accountId,
    name: accountName,
    age,
    grade,
    gradeBand,
    englishLevel,
  } = useActiveStudioAccount();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<TedTopic | "all">("all");
  const [paste, setPaste] = useState("");
  const [phase, setPhase] = useState<Phase>("browse");
  const [talk, setTalk] = useState<TedTalk | null>(null);
  const [challengeReady, setChallengeReady] = useState(false);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [challenge, setChallenge] = useState<TedChallenge | null>(null);
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [submittingDiscuss, setSubmittingDiscuss] = useState(false);
  const [discussKickoff, setDiscussKickoff] = useState<TedChallengeKickoff | null>(null);
  const [discussSessionKey, setDiscussSessionKey] = useState(0);
  const resumeConsumedRef = useRef(false);
  const pendingTedResumeRef = useRef<TedChallengeResume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** Auto Listen for English challenge prompts (homepage Listen, not Speak). */
  const [promptListenAuto, setPromptListenAuto] = useState(true);
  const [promptListening, setPromptListening] = useState(false);
  const promptListenTokenRef = useRef(0);

  const [results, setResults] = useState<TedTalk[]>(() =>
    searchTedCatalogForLearner("", "all", { grade: 4, age: 9 }).slice(0, 18),
  );
  const [listSource, setListSource] = useState<ListSource>("loading");
  const [listBusy, setListBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [nbPages, setNbPages] = useState(1);
  const [nbHits, setNbHits] = useState(0);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [officialSearchUrl, setOfficialSearchUrl] = useState(
    "https://www.ted.com/talks?sort=newest",
  );
  const [officialBrowseUrl, setOfficialBrowseUrl] = useState(
    "https://www.ted.com/talks?sort=newest",
  );

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchGenRef = useRef(0);
  const skipDebouncedSearchRef = useRef(false);

  const difficultyLabel = formatTedDifficultyLabel({
    age,
    grade,
    gradeBand,
    englishLevel,
  });
  const gradeKnown = typeof grade === "number" && Number.isFinite(grade);

  useEffect(() => {
    setPromptListenAuto(loadTedPromptListenEnabled(accountId));
  }, [accountId]);

  const stopPromptListen = useCallback(() => {
    promptListenTokenRef.current += 1;
    setPromptListening(false);
    getSharedSpeechEngine().stop();
  }, []);

  const playPromptListen = useCallback(async (item: ChallengeItem) => {
    const text = challengePromptSpeechText(item);
    if (!text) return;
    const token = ++promptListenTokenRef.current;
    setPromptListening(true);
    try {
      await getSharedSpeechEngine().unlock();
      if (token !== promptListenTokenRef.current) return;
      await getSharedSpeechEngine().speak(text, {
        voiceId: "ryan",
        // Hard-lock British Ryan — do not let resolveEdgeVoice switch on CJK hints
        voice: "en-GB-RyanNeural",
        shouldContinue: () => token === promptListenTokenRef.current,
        onStatus: (s) => {
          if (token !== promptListenTokenRef.current) return;
          setPromptListening(Boolean(s));
        },
        onError: () => {
          if (token !== promptListenTokenRef.current) return;
          setPromptListening(false);
        },
      });
    } catch {
      // unlock / play blocked — manual Listen still available
    } finally {
      if (token === promptListenTokenRef.current) {
        setPromptListening(false);
      }
    }
  }, []);

  const togglePromptListenAuto = useCallback(() => {
    const next = !promptListenAuto;
    setPromptListenAuto(next);
    saveTedPromptListenEnabled(next, accountId);
    if (!next) stopPromptListen();
  }, [promptListenAuto, accountId, stopPromptListen]);

  // Auto-read English prompt when the question changes (Listen, not Speak).
  useEffect(() => {
    if (phase !== "challenge" || !challenge) return;
    const item = challenge.items[qi];
    if (!item) {
      stopPromptListen();
      return;
    }
    if (!promptListenAuto) return;
    void playPromptListen(item);
    return () => {
      stopPromptListen();
    };
  }, [phase, challenge, qi, promptListenAuto, playPromptListen, stopPromptListen]);

  useEffect(() => {
    return () => {
      stopPromptListen();
    };
  }, [stopPromptListen]);

  const openTalk = useCallback((t: TedTalk) => {
    setTalk(t);
    setPhase("watch");
    setChallengeReady(false);
    setChallenge(null);
    setQi(0);
    setAnswer("");
    setSelected([]);
    setAnswers({});
    setSaved(false);
    setError(null);
    window.setTimeout(() => setChallengeReady(true), 45_000);
  }, []);

  // Resume challenge after homepage Q&A (“Next TED question”)
  useEffect(() => {
    if (resumeConsumedRef.current) return;
    resumeConsumedRef.current = true;
    const resume = consumeTedChallengeResume();
    if (!resume) return;
    const t: TedTalk =
      findTedTalk(resume.talkSlug) || {
        slug: resume.talkSlug,
        title: resume.talkTitle,
        speaker: resume.speaker,
        durationSec: 0,
        topics: ["ideas"] as TedTopic[],
        blurb: "Resumed TED Challenge",
      };
    setTalk(t);
    setChallenge(resume.challenge);
    setQi(
      Math.min(
        Math.max(0, resume.qi),
        Math.max(0, resume.challenge.items.length),
      ),
    );
    setAnswers(resume.answers || {});
    setAnswer("");
    setSelected([]);
    setChallengeReady(true);
    setPhase("challenge");
    setSaved(false);
    setError(null);
  }, []);

  const runSearch = useCallback(
    async (opts?: { page?: number; append?: boolean }) => {
      const nextPage = opts?.page ?? 0;
      const append = opts?.append === true;
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      const gen = ++searchGenRef.current;
      setListBusy(true);
      if (!append) setListSource("loading");
      try {
        const params = new URLSearchParams({
          mode: "search",
          q: query.trim(),
          topic,
          page: String(nextPage),
          pageSize: "18",
        });
        if (typeof grade === "number" && Number.isFinite(grade)) {
          params.set("grade", String(grade));
        }
        if (typeof age === "number" && Number.isFinite(age)) {
          params.set("age", String(age));
        }
        const res = await fetch(`/api/ted/search?${params}`, {
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          talks?: TedTalk[];
          page?: number;
          nbPages?: number;
          nbHits?: number;
          source?: ListSource;
          officialSearchUrl?: string;
          officialBrowseUrl?: string;
          error?: string;
        };
        if (gen !== searchGenRef.current) return;
        if (!res.ok || !data.ok || !data.talks) {
          throw new Error(data.error || "Search failed");
        }
        setResults((prev) =>
          uniqueTedTalks(append ? [...prev, ...data.talks!] : data.talks!),
        );
        setPage(data.page ?? nextPage);
        setNbPages(Math.max(1, data.nbPages ?? 1));
        setNbHits(data.nbHits ?? data.talks.length);
        setListSource(
          data.source === "curated-fallback" ? "curated-fallback" : "ted-live",
        );
        if (data.officialSearchUrl) setOfficialSearchUrl(data.officialSearchUrl);
        if (data.officialBrowseUrl) setOfficialBrowseUrl(data.officialBrowseUrl);
        setHasNextPage((data.page ?? nextPage) + 1 < (data.nbPages ?? 1));
        setEndCursor(null);
        setError(null);
      } catch (e) {
        if (ac.signal.aborted) return;
        if (gen !== searchGenRef.current) return;
        const local = searchTedCatalogForLearner(query, topic, { grade, age });
        setResults(local.slice(0, 18));
        setPage(0);
        setNbPages(Math.max(1, Math.ceil(local.length / 18)));
        setNbHits(local.length);
        setListSource("curated-fallback");
        setHasNextPage(local.length > 18);
        setError(
          e instanceof Error
            ? `${e.message} — showing curated picks`
            : "Search unavailable — curated picks",
        );
      } finally {
        if (gen === searchGenRef.current) setListBusy(false);
      }
    },
    [query, topic, grade, age],
  );

  const refreshBatch = useCallback(async () => {
    searchAbortRef.current?.abort();
    const ac = new AbortController();
    searchAbortRef.current = ac;
    const gen = ++searchGenRef.current;
    setListBusy(true);
    setListSource("loading");
    if (query.trim()) {
      skipDebouncedSearchRef.current = true;
      setQuery("");
    }
    try {
      const params = new URLSearchParams({
        mode: "refresh",
        pageSize: "18",
      });
      if (typeof grade === "number" && Number.isFinite(grade)) {
        params.set("grade", String(grade));
      }
      if (typeof age === "number" && Number.isFinite(age)) {
        params.set("age", String(age));
      }
      // Chain GraphQL pages while browsing newest
      if (endCursor) params.set("after", endCursor);
      const res = await fetch(`/api/ted/search?${params}`, { signal: ac.signal });
      const data = (await res.json()) as {
        ok?: boolean;
        talks?: TedTalk[];
        endCursor?: string | null;
        hasNextPage?: boolean;
        source?: ListSource;
        officialBrowseUrl?: string;
        officialSearchUrl?: string;
        error?: string;
      };
      if (gen !== searchGenRef.current) return;
      if (!res.ok || !data.ok || !data.talks?.length) {
        throw new Error(data.error || "Refresh failed");
      }
      setResults(data.talks);
      setPage(0);
      setNbPages(data.hasNextPage ? 2 : 1);
      setNbHits(data.talks.length);
      setEndCursor(data.endCursor ?? null);
      setHasNextPage(Boolean(data.hasNextPage));
      setListSource(
        data.source === "curated-fallback" ? "curated-fallback" : "ted-live",
      );
      if (data.officialBrowseUrl) {
        setOfficialBrowseUrl(data.officialBrowseUrl);
        setOfficialSearchUrl(data.officialBrowseUrl);
      }
      setError(null);
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Refresh failed");
      setListSource("curated-fallback");
    } finally {
      if (gen === searchGenRef.current) setListBusy(false);
    }
  }, [endCursor, query, grade, age]);

  // Debounced live search whenever query/topic change
  useEffect(() => {
    if (skipDebouncedSearchRef.current) {
      skipDebouncedSearchRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch({ page: 0, append: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, topic, runSearch]);

  useEffect(() => {
    return () => searchAbortRef.current?.abort();
  }, []);

  const openFromPaste = useCallback(() => {
    const slug = parseTedSlug(paste);
    if (!slug) {
      setError("Paste a ted.com/talks/… URL or a talk slug.");
      return;
    }
    const found = findTedTalk(slug) ||
      results.find((t) => t.slug === slug) || {
        slug,
        title: slug.replace(/_/g, " "),
        speaker: "TED speaker",
        durationSec: 0,
        topics: ["ideas"] as TedTopic[],
        blurb: "Opened from TED URL",
      };
    openTalk(found);
  }, [paste, openTalk, results]);

  const startChallenge = useCallback(async () => {
    if (!talk) return;
    setLoadingChallenge(true);
    setError(null);
    try {
      const res = await fetch("/api/ted/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: talk.slug,
          learner: { age, grade, gradeBand, englishLevel },
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        challenge?: TedChallenge;
        error?: string;
      };
      if (!res.ok || !data.challenge) {
        throw new Error(data.error || "Could not build challenge");
      }
      setChallenge(data.challenge);
      setPhase("challenge");
      setQi(0);
      setAnswer("");
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setLoadingChallenge(false);
    }
  }, [talk, age, grade, gradeBand, englishLevel]);

  /** Optional MCQ + required essay → inline discuss panel (stay on Lab). */
  const submitAndDiscuss = useCallback(() => {
    if (!challenge || !talk || submittingDiscuss || discussKickoff) return;
    const item = challenge.items[qi];
    if (!item) return;
    const essay = answer.trim();
    const gate = canSubmitHybrid(essay, selected);
    if (!gate.ok) {
      setError(gate.reason || "Write your essay first.");
      return;
    }
    setError(null);
    setSubmittingDiscuss(true);
    const nextAnswers = {
      ...answers,
      [item.id]: { selected: [...selected], essay },
    };
    setAnswers(nextAnswers);
    const { kickoff, resume } = prepareTedChallengeHandoff({
      talkSlug: talk.slug,
      talkTitle: talk.title,
      speaker: talk.speaker,
      item,
      selected,
      essay,
      qi,
      challenge,
      answers: nextAnswers,
      accountId,
    });
    pendingTedResumeRef.current = resume;
    const choiceNote =
      selected.length > 0
        ? selected.map(choiceLetter).join(", ")
        : "(none — own view)";
    void recordStudioLearningTurn({
      accountId,
      source: "ted",
      title: talk.title,
      userText: `Prompt (${item.kind}): ${item.prompt}\nChoices: ${choiceNote}\nEssay: ${essay}`,
      assistantText: "Opened inline TED discuss on Lab (prompt kept visible).",
      tedTopics: talk.topics,
      outcome: "practice",
    });
    setDiscussKickoff(kickoff);
    setDiscussSessionKey((k) => k + 1);
    setSubmittingDiscuss(false);
  }, [
    challenge,
    talk,
    submittingDiscuss,
    discussKickoff,
    qi,
    answer,
    selected,
    answers,
    accountId,
  ]);

  const closeDiscuss = useCallback(() => {
    setDiscussKickoff(null);
  }, []);

  const goNextAfterDiscuss = useCallback(() => {
    if (!challenge) return;
    const next = qi + 1;
    setDiscussKickoff(null);
    if (next >= challenge.items.length) {
      setError(null);
      return;
    }
    setQi(next);
    const nextItem = challenge.items[next];
    const rec = nextItem ? answers[nextItem.id] : undefined;
    setSelected(rec?.selected ?? []);
    setAnswer(rec?.essay ?? "");
    setError(null);
  }, [challenge, qi, answers]);

  const saveAttempt = useCallback(async () => {
    if (!talk || !challenge) return;
    const notes = challenge.items
      .map((it) => {
        const rec = answers[it.id];
        const body = rec
          ? formatHybridAnswerNotes(it, rec.selected, rec.essay)
          : "Choices: (skipped)\nEssay: (skipped)";
        return `Q (${it.kind}): ${it.prompt}\n${body}`;
      })
      .join("\n\n");
    try {
      await fetch("/api/creations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          type: "ted_challenge",
          title: `TED · ${talk.title}`,
          talkSlug: talk.slug,
          notes,
          challengeScore: `${Object.keys(answers).length}/${challenge.items.length} answered`,
        }),
      });
      setSaved(true);
      notifyCreationsChanged(accountId);
      void recordStudioLearningTurn({
        accountId,
        source: "ted",
        title: talk.title,
        userText: notes.slice(0, 4000),
        assistantText: "TED challenge saved to My Creations",
        tedTopics: talk.topics,
      });
    } catch {
      setError("Could not save to My Creations");
    }
  }, [talk, challenge, answers, accountId]);

  if (phase === "watch" && talk) {
    return (
      <div className="flex flex-1 flex-col bg-[#141210] text-[#e8e2d8]">
        {/* Compact title — listening first */}
        <div className="shrink-0 border-b border-teal-800/40 px-3 py-2.5 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6db8a8]">
                TED Lab · listen · {difficultyLabel}
              </p>
              <h2 className="mt-0.5 truncate font-[family-name:var(--font-display,Georgia,serif)] text-base font-semibold sm:text-lg">
                {talk.title}
              </h2>
              <p className="truncate text-xs text-[#a89f92]">{talk.speaker}</p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("browse")}
              className="shrink-0 min-h-9 rounded-lg px-2 text-xs text-[#a89f92] hover:text-white"
            >
              Catalog
            </button>
          </div>
        </div>

        {/* Player capped so challenge CTA stays on-screen (esp. mobile) */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto w-full max-w-2xl shrink-0 overflow-hidden bg-black">
            <div
              className="relative w-full"
              style={{ height: "min(36vh, 240px)" }}
            >
              <iframe
                title={talk.title}
                src={tedEmbedUrl(talk.slug)}
                className="absolute inset-0 h-full w-full border-0"
                allow="fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          <p className="px-3 py-2 text-center text-[11px] text-[#a89f92] sm:text-xs">
            Listen on TED — then take the challenge. Video stays compact so the next step stays visible.
          </p>
        </div>

        {/* P2-4 — cross-lab next stop */}
        <CrossLabSuggest from="ted" tags={talk.topics} />

        {/* Sticky challenge actions — always visible */}
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/15 bg-[#141210]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={!challengeReady || loadingChallenge}
              onClick={() => void startChallenge()}
              className={`min-h-12 w-full rounded-xl px-5 text-sm font-semibold transition sm:w-auto sm:min-w-[12rem] ${
                challengeReady
                  ? "animate-pulse bg-[#4f7356] text-white hover:bg-[#3d5c44]"
                  : "cursor-not-allowed bg-white/10 text-white/45"
              }`}
            >
              {loadingChallenge
                ? "Fetching transcript & building…"
                : challengeReady
                  ? "Ready for challenge"
                  : "Ready for challenge (soon)"}
            </button>
            <button
              type="button"
              onClick={() => setChallengeReady(true)}
              className="min-h-11 w-full rounded-xl border border-white/20 px-4 text-sm transition hover:border-[#6db8a8] sm:w-auto"
            >
              I&apos;ve watched enough — unlock now
            </button>
            <a
              href={tedTalkUrl(talk.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm text-[#6db8a8] underline-offset-2 hover:underline sm:ml-auto"
            >
              Open on TED.com
            </a>
          </div>
          {!challengeReady && (
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[#a89f92]">
              Challenge unlocks after ~45s of listening, or tap unlock now.
            </p>
          )}
          {error && (
            <p className="mx-auto mt-2 max-w-3xl text-sm text-[#e09a7a]">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "challenge" && challenge && talk) {
    const item = challenge.items[qi];
    const done = !item;
    return (
      <div className="flex flex-1 flex-col bg-[#141210] text-[#e8e2d8]">
        <div className="border-b border-teal-800/40 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6db8a8]">
            Challenge · {difficultyLabel} · {talk.title}
          </p>
          <div className="mt-3 flex gap-1.5">
            {challenge.items.map((it, i) => (
              <span
                key={it.id}
                className={`h-1.5 flex-1 rounded-full ${
                  i < qi ? "bg-[#6db8a8]" : i === qi ? "bg-[#a85f42]" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          {done ? (
            <div className="space-y-4 animate-[fade-up_0.4s_ease]">
              <h3 className="text-xl font-semibold">Challenge complete</h3>
              <p className="text-sm text-[#a89f92]">
                You argued with the talk — save the attempt, or keep exploring the catalog.
              </p>
              <button
                type="button"
                onClick={() => void saveAttempt()}
                disabled={saved}
                className="min-h-11 rounded-lg bg-[#4f7356] px-5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saved ? "Saved" : "Save to My Creations"}
              </button>
              <button
                type="button"
                onClick={() => setPhase("browse")}
                className="ml-3 min-h-11 text-sm text-[#a89f92]"
              >
                Back to catalog
              </button>
            </div>
          ) : (
            <div
              key={item.id}
              className="space-y-4 animate-[fade-up_0.35s_ease]"
            >
              <p className="text-[11px] uppercase tracking-wider text-[#a85f42]">
                {item.kind}
              </p>
              <h3 className="text-lg font-medium leading-snug md:text-xl">
                {item.prompt}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (promptListening) {
                      stopPromptListen();
                      return;
                    }
                    void playPromptListen(item);
                  }}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    promptListening
                      ? "bg-[#6db8a8]/25 text-[#6db8a8]"
                      : "border border-white/20 text-[#a89f92] hover:border-[#6db8a8] hover:text-[#e8e2d8]"
                  }`}
                  aria-label={promptListening ? "Stop reading" : "Listen to prompt"}
                  title={promptListening ? "Stop reading" : "Listen to prompt (Ryan British)"}
                >
                  {promptListening ? (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
                    </svg>
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden
                    >
                      <path
                        d="M2.5 6.5v3h2.2L8 12.5V3.5L4.7 6.5H2.5Z"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 5.8a2.6 2.6 0 0 1 0 4.4M11.7 4.2a4.6 4.6 0 0 1 0 7.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  {promptListening ? "Stop" : "Listen"}
                </button>
                <button
                  type="button"
                  onClick={togglePromptListenAuto}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    promptListenAuto
                      ? "border-[#6db8a8]/60 bg-[#6db8a8]/15 text-[#6db8a8]"
                      : "border-white/20 text-[#a89f92] hover:border-[#6db8a8]/50"
                  }`}
                  aria-pressed={promptListenAuto}
                  aria-label={promptListenAuto ? "Auto Listen on" : "Auto Listen off"}
                  title={
                    promptListenAuto
                      ? "Auto Listen on — tap to mute prompt reading"
                      : "Auto Listen off — tap to auto-read English prompts"
                  }
                >
                  {promptListenAuto ? "Auto Listen on" : "Auto Listen off"}
                </button>
              </div>
              {item.choices && item.choices.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-[#a89f92]">
                    Select any that apply (optional)
                  </p>
                  <p className="text-xs text-[#a89f92]">
                    Multi-select OK — explain your logic in the essay. If your view
                    isn&apos;t listed, skip selection.
                  </p>
                  {item.choices.map((ch, idx) => {
                    const on = selected.includes(idx);
                    return (
                      <button
                        key={`${item.id}-c${idx}`}
                        type="button"
                        disabled={submittingDiscuss || !!discussKickoff}
                        onClick={() =>
                          setSelected((prev) => toggleChoice(prev, idx))
                        }
                        className={`min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                          on
                            ? "border-[#6db8a8] bg-[#6db8a8]/15 text-[#e8e2d8]"
                            : "border-white/15 bg-black/30 text-[#c4b8a8] hover:border-[#6db8a8]/50"
                        } disabled:opacity-50`}
                      >
                        <span className="mr-2 font-semibold text-[#6db8a8]">
                          {choiceLetter(idx)}.
                        </span>
                        {ch}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={submittingDiscuss || !!discussKickoff || selected.length === 0}
                    onClick={() => setSelected([])}
                    className="min-h-9 w-fit text-left text-xs text-[#a89f92] underline-offset-2 hover:text-[#6db8a8] hover:underline disabled:opacity-40"
                  >
                    None of these — I&apos;ll explain in the essay
                  </button>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-wider text-[#a89f92]">
                  Essay / 论述 (required)
                </p>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={5}
                  disabled={submittingDiscuss || !!discussKickoff}
                  placeholder="Argue from your choice(s) — or your own view if you skipped. Type or speak…"
                  className="w-full rounded-xl border border-white/15 bg-black/40 p-4 text-sm text-[#e8e2d8] outline-none focus:border-[#6db8a8] disabled:opacity-60"
                />
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#6db8a8]/35 bg-black/35 px-3 py-2.5">
                  <MicTranscribeButton
                    language="auto"
                    tone="onDark"
                    disabled={submittingDiscuss || !!discussKickoff}
                    onRecordingStart={stopPromptListen}
                    onTranscript={(t) => {
                      setAnswer((prev) => appendVoiceTranscript(prev, t));
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#e8e2d8]">Speak answer</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#a89f92]">
                      Hold mic (tap twice on phone). Words append — typed text stays.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={submitAndDiscuss}
                  disabled={
                    submittingDiscuss ||
                    !!discussKickoff ||
                    !canSubmitHybrid(answer, selected).ok
                  }
                  className="min-h-11 w-fit rounded-lg bg-[#4f7356] px-5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {submittingDiscuss
                    ? "Opening discuss…"
                    : discussKickoff
                      ? "Discussing below…"
                      : "Submit & discuss with AI teacher"}
                </button>
                <p className="text-[11px] leading-snug text-[#a89f92]">
                  Opens a chat under this question so you can still see the prompt,
                  your choices, and your essay. Keep chatting or go to the next
                  question when your thinking holds together.
                </p>
                {discussKickoff ? (
                  <div className="space-y-3">
                    <TedDiscussDialogue
                      accountId={accountId}
                      kickoff={discussKickoff}
                      sessionKey={discussSessionKey}
                      hasNext={!!challenge && qi + 1 < challenge.items.length}
                      onNextQuestion={goNextAfterDiscuss}
                      onClose={closeDiscuss}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!discussKickoff) return;
                        stashTedChallengeKickoff(discussKickoff);
                        if (pendingTedResumeRef.current) {
                          stashTedChallengeResume(pendingTedResumeRef.current);
                        }
                        window.location.href = "/";
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#6db8a8]/40 bg-black/20 px-3 py-2.5 text-xs font-medium text-[#6db8a8] transition hover:border-[#6db8a8]"
                    >
                      Continue in the main chat
                      <span aria-hidden>↗</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#1a1814] text-[#e8e2d8]">
      <div className="border-b border-white/10 px-4 py-6">
        <p className="text-center text-[11px] uppercase tracking-[0.25em] text-[#6db8a8]">
          Studio · TED Lab
        </p>
        <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight">
          Watch a talk. Then argue with it.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-[#a89f92]">
          Search the full TED catalog live. The list is sorted for your grade
          and age
          {gradeKnown ? (
            <>
              {" "}
              (
              <span className="font-semibold text-[#6db8a8]">
                {formatTedFitSortCaption({ grade, age })}
              </span>
              )
            </>
          ) : (
            <> (set grade on Account)</>
          )}
          . Challenge difficulty follows {difficultyLabel} — not one-size
          quizzes.
        </p>
        <p className="mt-3 text-center text-[11px] text-[#8fb896]/90">
          Tracking for {accountName}
          {gradeKnown ? ` · G${grade}` : ""} · answers update subject skills on
          Dashboard
        </p>
        <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2">
          <a
            href={officialBrowseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-10 rounded-xl border border-[#6db8a8]/50 bg-[#6db8a8]/10 px-4 text-sm font-medium text-[#6db8a8] hover:bg-[#6db8a8]/20"
          >
            Browse TED.com →
          </a>
          <a
            href={officialSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-10 rounded-xl border border-white/20 px-4 text-sm text-[#c4b8a8] hover:border-[#6db8a8]/50"
          >
            Open this search on TED
          </a>
        </div>
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-auto px-4 py-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all TED talks — title, speaker, idea…"
          className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm outline-none focus:border-[#6db8a8]"
        />
        <div className="flex flex-wrap items-center gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className={`min-h-9 rounded-lg px-3 text-xs capitalize ${
                topic === t
                  ? "bg-[#4f7356] text-white"
                  : "border border-white/15 text-[#a89f92]"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            disabled={listBusy}
            onClick={() => void refreshBatch()}
            className="min-h-9 rounded-lg border border-[#a85f42]/60 px-3 text-xs font-medium text-[#e09a7a] hover:bg-[#a85f42]/15 disabled:opacity-40"
          >
            {listBusy ? "Loading…" : "Refresh batch"}
          </button>
        </div>
        <p className="text-[11px] text-[#a89f92]">
          {listSource === "loading"
            ? "Searching TED…"
            : listSource === "ted-live"
              ? `${formatTedFitSortCaption({ grade, age })} · TED live · ${nbHits.toLocaleString()} talks · page ${page + 1}/${nbPages}`
              : `${formatTedFitSortCaption({ grade, age })} · curated backup · ${nbHits} talks`}
        </p>
        <div className="flex gap-2">
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste ted.com/talks/… URL"
            className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 text-sm outline-none focus:border-[#6db8a8]"
          />
          <button
            type="button"
            onClick={openFromPaste}
            className="min-h-11 rounded-xl bg-[#a85f42] px-4 text-sm font-medium text-white"
          >
            Open
          </button>
        </div>
        {error && <p className="text-sm text-[#e09a7a]">{error}</p>}
        <ul className="space-y-2">
          {results.map((t) => (
            <li key={t.slug}>
              <div className="rounded-xl border border-white/10 bg-black/25 p-4 transition hover:border-[#6db8a8]/50">
                <button
                  type="button"
                  onClick={() => openTalk(t)}
                  className="w-full text-left"
                >
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="mt-0.5 text-xs text-[#a89f92]">
                    {t.speaker}
                    {formatDuration(t.durationSec)}
                    {" · "}
                    {formatTedAudienceChip(t)}
                  </div>
                  <p className="mt-2 text-[12px] leading-snug text-[#c4b8a8]">
                    {t.blurb}
                  </p>
                </button>
                <a
                  href={tedTalkUrl(t.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[11px] text-[#6db8a8] underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Official TED page ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
        {(hasNextPage || page + 1 < nbPages) && (
          <button
            type="button"
            disabled={listBusy}
            onClick={() => void runSearch({ page: page + 1, append: true })}
            className="mb-8 min-h-11 w-full rounded-xl border border-white/20 text-sm text-[#c4b8a8] hover:border-[#6db8a8] disabled:opacity-40"
          >
            {listBusy ? "Loading…" : "Load more from TED"}
          </button>
        )}
      </div>
    </div>
  );
}
