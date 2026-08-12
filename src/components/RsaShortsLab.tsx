"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RSA_TOPICS, RSA_TOPIC_LABELS, searchRsaCatalog, type RsaVideo, type RsaTopic,
} from "@/lib/entertain/rsa-catalog";
import type { ChallengeItem } from "@/lib/entertain/ted-challenge";
import { normalizeLearnerGrade, formatTedDifficultyLabel } from "@/lib/entertain/ted-challenge";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { youtubeEmbedUrl } from "@/lib/youtube-urls";
import { readResponseJson } from "@/lib/api-json";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";

type Phase = "browse" | "watch" | "challenge";
type AnswerRecord = { selected: number[]; essay: string };
const TOPICS: Array<RsaTopic | "all"> = ["all", ...RSA_TOPICS];

function formatDuration(sec: number): string { return ` · ${Math.round(sec / 60)} min`; }
function choiceLetter(i: number): string { return "ABCD"[i] ?? String(i); }

export function RsaShortsLab() {
  const { accountId, grade, englishLevel } = useActiveStudioAccount();
  const [phase, setPhase] = useState<Phase>("browse");
  const [query, setQuery] = useState(""); const [topic, setTopic] = useState<RsaTopic | "all">("all");
  const [videos, setVideos] = useState<RsaVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<RsaVideo | null>(null);
  const [challengeReady, setChallengeReady] = useState(false);
  const [challenge, setChallenge] = useState<any>(null);
  const [qi, setQi] = useState(0); const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const watchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const difficultyLabel = formatTedDifficultyLabel({ grade, englishLevel });

  useEffect(() => { setVideos(topic === "all" ? searchRsaCatalog("") : searchRsaCatalog("", topic)); }, [topic]);
  useEffect(() => () => { if (watchTimer.current) clearTimeout(watchTimer.current); }, []);

  const openVideo = useCallback((video: RsaVideo) => {
    setSelectedVideo(video); setChallenge(null); setQi(0); setAnswers({});
    setChallengeReady(false); setPhase("watch");
    if (watchTimer.current) clearTimeout(watchTimer.current);
    watchTimer.current = setTimeout(() => setChallengeReady(true), 45_000);
  }, []);

  const fetchChallenge = useCallback(async () => {
    if (!selectedVideo) return null;
    const res = await fetch("/api/rsa/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: selectedVideo.videoId, learner: { grade: normalizeLearnerGrade(grade || undefined), englishLevel } }) });
    const data = await readResponseJson<{ ok?: boolean; error?: string; challenge?: unknown }>(res);
    if (!data.ok) throw new Error(data.error || "Failed");
    return data.challenge;
  }, [selectedVideo, grade, englishLevel]);

  const startChallenge = useCallback(async () => {
    setBusy(true); setError("");
    try { const ch = await fetchChallenge(); setChallenge(ch); setQi(0); setAnswers({}); setPhase("challenge"); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load challenge"); }
    finally { setBusy(false); }
  }, [fetchChallenge]);

  const submitAnswer = useCallback(async (item: ChallengeItem, selected: number[], essay: string) => {
    if (!challenge || !selectedVideo) return;
    setAnswers(prev => ({ ...prev, [item.id]: { selected, essay } }));
    void recordStudioLearningTurn({ accountId: accountId || "acct_ryan", source: "rsa", title: selectedVideo.title, userText: ["[RSA Lab]", selectedVideo.title, `Q: ${item.prompt}`, `A: ${essay || selected.map(i => item.choices[i]).join(", ")}`].join("\n"), outcome: "practice" });
  }, [challenge, selectedVideo, accountId]);

  const saveChallenge = useCallback(async () => {
    if (!challenge || !selectedVideo) return;
    try {
      const notes = challenge.items.map((item: ChallengeItem) => {
        const a = answers[item.id];
        return `${item.prompt}\nChoice: ${a?.selected.map((i: number) => item.choices[i]).join(", ") || "(none)"}\nEssay: ${a?.essay || "(none)"}`;
      }).join("\n\n---\n\n");
      await fetch("/api/creations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "rsa_challenge", title: selectedVideo.title, notes, accountId }) });
      notifyCreationsChanged();
    } catch { setError("Could not save"); }
  }, [challenge, selectedVideo, answers, accountId]);

  // ── BROWSE ──
  if (phase === "browse") {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <input value={query} onChange={e => { setQuery(e.target.value); setVideos(searchRsaCatalog(e.target.value, topic === "all" ? undefined : topic)); }} placeholder="Search RSA talks..." className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10" />
        <div className="flex flex-wrap gap-1.5">{TOPICS.map(t => (<button key={t} onClick={() => setTopic(t)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${t === topic ? "bg-[var(--teal)] text-white" : "border border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] dark:bg-white/5"}`}>{t === "all" ? "All" : RSA_TOPIC_LABELS[t]}</button>))}</div>
        {videos.length > 0 ? (<ul className="grid gap-3 sm:grid-cols-2">{videos.map(v => (<li key={v.videoId}><button onClick={() => openVideo(v)} className="flex w-full flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] hover:shadow-sm dark:bg-white/5"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-[var(--ink)]">{v.title}</span><span className="shrink-0 rounded-full bg-[var(--mist)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">{v.series}</span></div><p className="text-xs font-medium text-[var(--ink-muted)]">by {v.speaker}</p><p className="line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">{v.blurb}</p><div className="flex items-center gap-2 text-[10px] text-[var(--ink-muted)]/70"><span>{formatDuration(v.durationSec)}</span><span>G{v.gradeMin}-{v.gradeMax}</span></div></button></li>))}</ul>) : (<p className="py-8 text-center text-sm text-[var(--ink-muted)]">No videos found.</p>)}
      </div>
    );
  }

  // ── WATCH (compact, TED-style) ──
  if (phase === "watch" && selectedVideo) {
    return (
      <div className="flex flex-1 flex-col bg-[#141210] text-[#e8e2d8]">
        <div className="shrink-0 border-b border-teal-800/40 px-3 py-2.5 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6db8a8]">RSA Lab · listen · {difficultyLabel}</p>
              <h2 className="mt-0.5 truncate font-[family-name:var(--font-display,Georgia,serif)] text-base font-semibold sm:text-lg">{selectedVideo.title}</h2>
              <p className="truncate text-xs text-[#a89f92]">by {selectedVideo.speaker} · {selectedVideo.series}</p>
            </div>
            <button type="button" onClick={() => { setPhase("browse"); if (watchTimer.current) clearTimeout(watchTimer.current); }} className="shrink-0 min-h-9 rounded-lg px-2 text-xs text-[#a89f92] hover:text-white">Catalog</button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto w-full max-w-2xl shrink-0 overflow-hidden bg-black">
            <div className="relative w-full" style={{ height: "min(36vh, 240px)" }}>
              <iframe title={selectedVideo.title} src={youtubeEmbedUrl(selectedVideo.videoId)} className="absolute inset-0 h-full w-full border-0" allow="fullscreen; picture-in-picture" allowFullScreen />
            </div>
          </div>
          <p className="px-3 py-2 text-center text-[11px] text-[#a89f92] sm:text-xs">Listen first — then take the challenge. Video stays compact.</p>
        </div>
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/15 bg-[#141210]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="button" disabled={!challengeReady || busy} onClick={() => void startChallenge()} className={`min-h-12 w-full rounded-xl px-5 text-sm font-semibold transition sm:w-auto sm:min-w-[12rem] ${challengeReady ? "animate-pulse bg-[#4f7356] text-white hover:bg-[#3d5c44]" : "cursor-not-allowed bg-white/10 text-white/45"}`}>{busy ? "Building challenge..." : challengeReady ? "Ready for challenge" : "Ready for challenge (soon)"}</button>
            <button type="button" onClick={() => setChallengeReady(true)} className="min-h-11 w-full rounded-xl border border-white/20 px-4 text-sm transition hover:border-[#6db8a8] sm:w-auto">I've listened enough — unlock now</button>
          </div>
          {!challengeReady && <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[#a89f92]">Challenge unlocks after ~45s, or tap unlock now.</p>}
          {error && <p className="mx-auto mt-2 max-w-3xl text-sm text-[#e09a7a]">{error}</p>}
        </div>
      </div>
    );
  }

  // ── CHALLENGE ──
  if (phase === "challenge" && challenge) {
    const item = challenge.items[qi] as ChallengeItem | undefined;
    if (!item) {
      return (<div className="mt-4 space-y-4 animate-fade-up text-center"><div className="rounded-2xl border border-[var(--line)] bg-white/85 p-8 dark:bg-white/5"><p className="text-lg font-semibold text-[var(--ink)]">Challenge complete!</p><p className="mt-2 text-sm text-[var(--ink-muted)]">You answered {challenge.items.length} questions.</p><div className="mt-4 flex flex-wrap justify-center gap-3"><button onClick={() => void saveChallenge()} className="rounded-xl bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">Save to My Creations</button><button onClick={() => setPhase("browse")} className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)] dark:bg-white/5">Watch another</button></div></div></div>);
    }
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <button onClick={() => setPhase("browse")} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back</button>
        <div className="flex gap-1">{challenge.items.map((_: any, i: number) => (<div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < qi ? (answers[challenge.items[i].id] ? "bg-[var(--teal)]" : "bg-[var(--coral)]/50") : i === qi ? "bg-[var(--teal)]/40" : "bg-[var(--line)]"}`} />))}</div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">Q{qi + 1}/{challenge.items.length} · {item.kind}</p><p className="text-[15px] leading-relaxed text-[var(--ink)]">{item.prompt}</p></div>
        <div className="space-y-2">{item.choices.map((choice: string, ci: number) => { const isSelected = answers[item.id]?.selected?.includes(ci); return (<button key={ci} onClick={() => { const prev = answers[item.id]?.selected || []; const next = prev.includes(ci) ? prev.filter(i => i !== ci) : [...prev, ci]; setAnswers(a => ({ ...a, [item.id]: { ...(a[item.id] || { essay: "", selected: [] }), selected: next } })); }} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${isSelected ? "border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--ink)]" : "border-[var(--line)] bg-white/70 text-[var(--ink-muted)] hover:border-[var(--teal)]/50 dark:bg-white/5"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${isSelected ? "bg-[var(--teal)] text-white" : "bg-[var(--mist)] text-[var(--ink-muted)]"}`}>{choiceLetter(ci)}</span><span>{choice}</span></button>); })}</div>
        <div className="flex gap-2"><textarea value={answers[item.id]?.essay || ""} onChange={e => setAnswers(a => ({ ...a, [item.id]: { ...(a[item.id] || { selected: [], essay: "" }), essay: e.target.value } }))} placeholder="Explain your answer..." rows={3} className="min-h-[5rem] w-full flex-1 resize-y rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10" /><MicTranscribeButton language="en" disabled={busy} onTranscript={(t: string) => setAnswers(a => ({ ...a, [item.id]: { ...(a[item.id] || { selected: [], essay: "" }), essay: ((a[item.id]?.essay || "") + " " + t).trim() } }))} /></div>
        <button onClick={() => { const r = answers[item.id]; void submitAnswer(item, r?.selected || [], r?.essay || ""); if (qi < challenge.items.length - 1) setQi(qi + 1); }} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45">{qi < challenge.items.length - 1 ? "Submit & Next" : "Complete"}</button>
        {error ? <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">{error}</p> : null}
      </div>
    );
  }
  return null;
}
