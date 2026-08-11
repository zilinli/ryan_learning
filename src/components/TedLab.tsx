"use client";

import { useCallback, useMemo, useState } from "react";
import {
  searchTedCatalog,
  tedEmbedUrl,
  tedTalkUrl,
  parseTedSlug,
  type TedTalk,
  type TedTopic,
} from "@/lib/entertain/ted-catalog";
import type { TedChallenge, ChallengeItem } from "@/lib/entertain/ted-challenge";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { useActiveStudioAccount } from "./StudioAccountBar";

type Phase = "browse" | "watch" | "challenge";

const TOPICS: Array<TedTopic | "all"> = [
  "all",
  "ideas",
  "science",
  "society",
  "education",
  "creativity",
  "technology",
];

function softFeedback(item: ChallengeItem, answer: string): string {
  const n = answer.trim().split(/\s+/).filter(Boolean).length;
  if (n < 8) {
    return "Short answers can be sharp — but this one needs more evidence or a clearer claim. Try one more sentence.";
  }
  if (item.kind === "critique" && !/because|however|although|but|yet/i.test(answer)) {
    return "Nice start. Push the critique: name the tension (because / however) so the objection lands.";
  }
  if (item.kind === "retell" && n < 40) {
    return "Retell should carry the arc. Add one beat from the middle or end of the talk.";
  }
  return `Solid draft for a ${item.kind} prompt. Rubric nudge: ${item.rubricHint}`;
}

export function TedLab() {
  const { accountId, name: accountName } = useActiveStudioAccount();
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const results = useMemo(
    () => searchTedCatalog(query, topic),
    [query, topic],
  );

  const openTalk = useCallback((t: TedTalk) => {
    setTalk(t);
    setPhase("watch");
    setChallengeReady(false);
    setChallenge(null);
    setQi(0);
    setAnswer("");
    setFeedback(null);
    setAnswers({});
    setSaved(false);
    setError(null);
    window.setTimeout(() => setChallengeReady(true), 45_000);
  }, []);

  const openFromPaste = useCallback(() => {
    const slug = parseTedSlug(paste);
    if (!slug) {
      setError("Paste a ted.com/talks/… URL or a talk slug.");
      return;
    }
    const found = searchTedCatalog(slug)[0] || {
      slug,
      title: slug.replace(/_/g, " "),
      speaker: "TED speaker",
      durationSec: 0,
      topics: ["ideas"] as TedTopic[],
      blurb: "Opened from URL",
    };
    openTalk(found);
  }, [paste, openTalk]);

  const startChallenge = useCallback(async () => {
    if (!talk) return;
    setLoadingChallenge(true);
    setError(null);
    try {
      const res = await fetch("/api/ted/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: talk.slug }),
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
      setFeedback(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setLoadingChallenge(false);
    }
  }, [talk]);

  const submitAnswer = useCallback(() => {
    if (!challenge || !talk) return;
    const item = challenge.items[qi];
    if (!item) return;
    const fb = softFeedback(item, answer);
    setFeedback(fb);
    setAnswers((prev) => ({ ...prev, [item.id]: answer.trim() }));
    void recordStudioLearningTurn({
      accountId,
      source: "ted",
      title: talk.title,
      userText: `Prompt (${item.kind}): ${item.prompt}\nStudent: ${answer.trim()}`,
      assistantText: fb,
      tedTopics: talk.topics,
    });
  }, [challenge, qi, answer, talk, accountId]);

  const nextQuestion = useCallback(() => {
    setFeedback(null);
    setAnswer("");
    setQi((i) => i + 1);
  }, []);

  const saveAttempt = useCallback(async () => {
    if (!talk || !challenge) return;
    const notes = challenge.items
      .map((it) => `Q (${it.kind}): ${it.prompt}\nA: ${answers[it.id] || "(skipped)"}`)
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
                TED Lab · listen
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
                ? "Building challenge…"
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
            Challenge · {talk.title}
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
                You argued with the talk — keep the attempt in My Creations.
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
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder="Argue carefully…"
                className="w-full rounded-xl border border-white/15 bg-black/40 p-4 text-sm text-[#e8e2d8] outline-none focus:border-[#6db8a8]"
              />
              {feedback && (
                <p className="rounded-lg border border-[#6db8a8]/30 bg-[#6db8a8]/10 p-3 text-sm leading-relaxed">
                  {feedback}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {!feedback ? (
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={answer.trim().length < 3}
                    className="min-h-11 rounded-lg bg-[#a85f42] px-5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Check thinking
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="min-h-11 rounded-lg bg-[#4f7356] px-5 text-sm font-medium text-white"
                  >
                    Next
                  </button>
                )}
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
          Official TED player only. Challenges probe claim, structure, and critique —
          not baby quizzes.
        </p>
        <p className="mt-3 text-center text-[11px] text-[#8fb896]/90">
          Tracking for {accountName} · answers update subject skills on Dashboard
        </p>
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-auto px-4 py-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, speaker, topic…"
          className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-sm outline-none focus:border-[#6db8a8]"
        />
        <div className="flex flex-wrap gap-2">
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
        </div>
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
        <ul className="space-y-2 pb-8">
          {results.map((t) => (
            <li key={t.slug}>
              <button
                type="button"
                onClick={() => openTalk(t)}
                className="w-full rounded-xl border border-white/10 bg-black/25 p-4 text-left transition hover:border-[#6db8a8]/50"
              >
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="mt-0.5 text-xs text-[#a89f92]">
                  {t.speaker}
                  {t.durationSec
                    ? ` · ${Math.round(t.durationSec / 60)} min`
                    : ""}
                </div>
                <p className="mt-2 text-[12px] leading-snug text-[#c4b8a8]">
                  {t.blurb}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
