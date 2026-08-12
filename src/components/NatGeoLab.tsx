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
import type { ChallengeItem } from "@/lib/entertain/ted-challenge";
import { normalizeLearnerGrade } from "@/lib/entertain/ted-challenge";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { notifyCreationsChanged } from "@/lib/entertain/creations-sync";
import { youtubeEmbedUrl } from "@/lib/youtube-urls";
import { readResponseJson } from "@/lib/api-json";
import { useLabCatalogSearch } from "./useLabCatalogSearch";
import { MicTranscribeButton } from "./MicTranscribeButton";
import { useActiveStudioAccount } from "./StudioAccountBar";

type Phase = "browse" | "read" | "challenge";
type AnswerRecord = { selected: number[]; essay: string };

const TOPICS: Array<NatGeoTopic | "all"> = ["all", ...NATGEO_TOPICS];

function formatGradeBand(article: NatGeoArticle): string { return `G${article.gradeMin}-G${article.gradeMax}`; }
function choiceLetter(i: number): string { return "ABCD"[i] ?? String(i); }

export function NatGeoLab() {
  const { accountId, grade } = useActiveStudioAccount();
  const [phase, setPhase] = useState<Phase>("browse");
  const [topic, setTopic] = useState<NatGeoTopic | "all">("all");
  const {
    query,
    setQuery,
    items: articles,
    listBusy,
    listSource,
    error: searchError,
    page,
    nbHits,
    hasNextPage,
    runSearch,
    refreshBatch,
  } = useLabCatalogSearch<NatGeoArticle>({
    apiPath: "/api/natgeo/search",
    resultKey: "articles",
    localSearch: (q, t) => searchNatGeoCatalog(q, t as NatGeoTopic | undefined),
    topic,
    grade,
  });
  const [selectedArticle, setSelectedArticle] = useState<NatGeoArticle | null>(null);
  const [challenge, setChallenge] = useState<NatGeoChallenge | null>(null);
  const [qi, setQi] = useState(0); const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [readSecs, setReadSecs] = useState(0); const [readReady, setReadReady] = useState(false);
  const readTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (readTimer.current) clearInterval(readTimer.current); }, []);

  const openArticle = useCallback((article: NatGeoArticle) => {
    const full = findNatGeoArticle(article.slug) ?? article;
    setSelectedArticle(full); setChallenge(null); setQi(0); setAnswers({});
    setReadSecs(0); setReadReady(false); setPhase("read");
    if (readTimer.current) clearInterval(readTimer.current);
    readTimer.current = setInterval(() => { setReadSecs(s => { if (s + 1 >= 30) { setReadReady(true); if (readTimer.current) clearInterval(readTimer.current); return 30; } return s + 1; }); }, 1000);
  }, []);

  const startChallenge = useCallback(async () => {
    if (!selectedArticle) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/natgeo/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: selectedArticle.slug, learner: { grade: normalizeLearnerGrade(grade || undefined) } }) });
      const data = await readResponseJson<{ ok?: boolean; error?: string; challenge?: NatGeoChallenge }>(res);
      if (!data.ok || !data.challenge) throw new Error(data.error || "Failed");
      setChallenge(data.challenge); setQi(0); setAnswers({}); setPhase("challenge");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load challenge"); }
    finally { setBusy(false); }
  }, [selectedArticle, grade]);

  const submitAnswer = useCallback(async (item: ChallengeItem, selected: number[], essay: string) => {
    if (!challenge || !selectedArticle) return;
    setAnswers(prev => ({ ...prev, [item.id]: { selected, essay } }));
    void recordStudioLearningTurn({ accountId: accountId || "acct_ryan", source: "natgeo", title: selectedArticle.title, userText: [`[NatGeo Lab]`, selectedArticle.title, `Q: ${item.prompt}`, `A: ${essay || selected.map(i => item.choices[i]).join(", ")}`].join("\n"), outcome: "practice" });
  }, [challenge, selectedArticle, accountId]);

  const saveChallenge = useCallback(async () => {
    if (!challenge || !selectedArticle) return;
    try {
      const notes = challenge.items.map((item) => { const a = answers[item.id]; return `${item.prompt}\nChoice: ${a?.selected.map((i: number) => item.choices[i]).join(", ") || "(none)"}\nEssay: ${a?.essay || "(none)"}`; }).join("\n\n---\n\n");
      await fetch("/api/creations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "natgeo_challenge", title: selectedArticle.title, notes, accountId }) });
      notifyCreationsChanged(); setError("");
    } catch { setError("Could not save — try again"); }
  }, [challenge, selectedArticle, answers, accountId]);

  const goBrowse = useCallback(() => { setPhase("browse"); setChallenge(null); setSelectedArticle(null); if (readTimer.current) clearInterval(readTimer.current); }, []);

  // ── BROWSE ──
  if (phase === "browse") {
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search articles about animals, space, history..." className="w-full rounded-xl border border-[var(--line)] bg-white/90 px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10" />
        <div className="flex flex-wrap items-center gap-1.5">{TOPICS.map(t => (<button key={t} onClick={() => setTopic(t)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${t === topic ? "bg-[var(--teal)] text-white" : "border border-[var(--line)] bg-white/60 text-[var(--ink-muted)] hover:border-[var(--teal)] dark:bg-white/5"}`}>{t === "all" ? "All" : NATGEO_TOPIC_LABELS[t]}</button>))}
          <button type="button" disabled={listBusy} onClick={() => void refreshBatch()} className="rounded-full border border-[var(--coral)]/40 px-3 py-1 text-xs font-medium text-[var(--coral)] disabled:opacity-40">{listBusy ? "Loading…" : "Refresh batch"}</button>
        </div>
        <p className="text-[11px] text-[var(--ink-muted)]">{listSource === "loading" ? "Searching NatGeo Kids…" : listSource === "live" ? `NatGeo live · ${nbHits} articles` : `Curated backup · ${nbHits} articles`}</p>
        {searchError ? <p className="text-xs text-[var(--coral)]">{searchError}</p> : null}
        {articles.length > 0 ? (<ul className="grid gap-3 sm:grid-cols-2">{articles.map(a => (
          <li key={a.slug}><button onClick={() => openArticle(a)} className="flex w-full flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/85 p-4 text-left transition hover:border-[var(--teal)] hover:shadow-sm dark:bg-white/5">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-[var(--ink)]">{a.title}</span><span className="shrink-0 rounded-full bg-[var(--mist)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">{NATGEO_TOPIC_LABELS[a.topic]}</span></div>
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">{a.blurb}</p>
            <div className="flex items-center gap-2 text-[10px] text-[var(--ink-muted)]/70">{a.videoId && <span className="text-[var(--coral)]">▶ video</span>}<span>{formatGradeBand(a)}</span><span>{a.readingTimeMin} min read</span></div>
          </button></li>
        ))}</ul>) : !listBusy ? (<p className="py-8 text-center text-sm text-[var(--ink-muted)]">No articles found.</p>) : null}
        {hasNextPage ? (<button type="button" disabled={listBusy} onClick={() => void runSearch({ page: page + 1, append: true })} className="w-full rounded-xl border border-[var(--line)] py-2 text-sm text-[var(--ink-muted)] hover:border-[var(--teal)] disabled:opacity-40">Load more</button>) : null}
      </div>
    );
  }

  // ── READ (article + optional compact video) ──
  if (phase === "read" && selectedArticle) {
    const hasVideo = !!selectedArticle.videoId;
    return (
      <div className="flex flex-1 flex-col bg-[#141210] text-[#e8e2d8]">
        {/* Header bar */}
        <div className="shrink-0 border-b border-teal-800/40 px-3 py-2.5 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6db8a8]">NatGeo Lab · {hasVideo ? "watch & read" : "read"} · {formatGradeBand(selectedArticle)}</p>
              <h2 className="mt-0.5 truncate font-[family-name:var(--font-display,Georgia,serif)] text-base font-semibold sm:text-lg">{selectedArticle.title}</h2>
              <p className="truncate text-xs text-[#a89f92]">{NATGEO_TOPIC_LABELS[selectedArticle.topic]} · {selectedArticle.readingTimeMin} min read</p>
            </div>
            <button type="button" onClick={goBrowse} className="shrink-0 min-h-9 rounded-lg px-2 text-xs text-[#a89f92] hover:text-white">Catalog</button>
          </div>
        </div>

        {/* Article content area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Compact video if available */}
          {hasVideo && (
            <div className="relative mx-auto w-full max-w-2xl shrink-0 overflow-hidden bg-black">
              <div className="relative w-full" style={{ height: "min(36vh, 240px)" }}>
                <iframe title={selectedArticle.title} src={youtubeEmbedUrl(selectedArticle.videoId!)} className="absolute inset-0 h-full w-full border-0" allow="fullscreen; picture-in-picture" allowFullScreen />
              </div>
            </div>
          )}

          {/* Article text */}
          <div className="px-3 py-4 sm:px-4">
            {hasVideo && <p className="text-[11px] text-[#a89f92] text-center mb-2">Watch the video above, then read the article below.</p>}
            <div className="text-[14px] leading-relaxed text-[#e8e2d8] space-y-2">
              {selectedArticle.body.split("\n\n").map((p, i) => (<p key={i}>{p}</p>))}
            </div>
          </div>
        </div>

        {/* Sticky unlock bar */}
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-white/15 bg-[#141210]/95 px-3 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="button" disabled={!readReady || busy} onClick={() => void startChallenge()} className={`min-h-12 w-full rounded-xl px-5 text-sm font-semibold transition sm:w-auto sm:min-w-[12rem] ${readReady ? "animate-pulse bg-[#4f7356] text-white hover:bg-[#3d5c44]" : "cursor-not-allowed bg-white/10 text-white/45"}`}>{busy ? "Reading source & building…" : readReady ? "Ready for challenge" : "Ready for challenge (soon)"}</button>
            {!readReady && (<button type="button" onClick={() => { if (readTimer.current) clearInterval(readTimer.current); setReadReady(true); setReadSecs(30); }} className="min-h-11 w-full rounded-xl border border-white/20 px-4 text-sm transition hover:border-[#6db8a8] sm:w-auto">I've read enough — unlock now</button>)}
          </div>
          {!readReady && <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[#a89f92]">Reading for {readSecs}s — challenge unlocks at 30s</p>}
          {error && <p className="mx-auto mt-2 max-w-3xl text-sm text-[#e09a7a]">{error}</p>}
        </div>
      </div>
    );
  }

  // ── CHALLENGE ──
  if (phase === "challenge" && challenge) {
    const item = challenge.items[qi];
    if (!item) {
      return (<div className="mt-4 space-y-4 animate-fade-up text-center"><div className="rounded-2xl border border-[var(--line)] bg-white/85 p-8 dark:bg-white/5"><p className="text-lg font-semibold text-[var(--ink)]">Challenge complete!</p><p className="mt-2 text-sm text-[var(--ink-muted)]">Great reading! You answered {challenge.items.length} questions on "{challenge.title}".</p><div className="mt-4 flex flex-wrap justify-center gap-3"><button onClick={() => void saveChallenge()} className="rounded-xl bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">Save to My Creations</button><button onClick={goBrowse} className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)] dark:bg-white/5">Read another article</button></div></div></div>);
    }
    return (
      <div className="mt-4 space-y-4 animate-fade-up">
        <button onClick={goBrowse} className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]">&larr; Back</button>
        <div className="flex gap-1">{challenge.items.map((_, i) => (<div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < qi ? (answers[challenge.items[i]!.id] ? "bg-[var(--teal)]" : "bg-[var(--coral)]/50") : i === qi ? "bg-[var(--teal)]/40" : "bg-[var(--line)]"}`} />))}</div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/85 p-5 dark:bg-white/5"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]/70">Question {qi + 1} of {challenge.items.length} · {item.kind}</p><p className="text-[15px] leading-relaxed text-[var(--ink)]">{item.prompt}</p></div>
        <div className="space-y-2">{item.choices.map((choice, ci) => { const isSelected = answers[item.id]?.selected?.includes(ci); return (<button key={ci} onClick={() => { const prev = answers[item.id]?.selected || []; const next = prev.includes(ci) ? prev.filter(i => i !== ci) : [...prev, ci]; setAnswers(a => ({ ...a, [item.id]: { ...(a[item.id] || { essay: "", selected: [] }), selected: next } })); }} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${isSelected ? "border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--ink)]" : "border-[var(--line)] bg-white/70 text-[var(--ink-muted)] hover:border-[var(--teal)]/50 dark:bg-white/5"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${isSelected ? "bg-[var(--teal)] text-white" : "bg-[var(--mist)] text-[var(--ink-muted)]"}`}>{choiceLetter(ci)}</span><span>{choice}</span></button>); })}</div>
        <div className="flex gap-2"><textarea value={answers[item.id]?.essay || ""} onChange={e => setAnswers(a => ({ ...a, [item.id]: { ...(a[item.id] || { selected: [], essay: "" }), essay: e.target.value } }))} placeholder="Explain your answer..." rows={3} className="min-h-[5rem] w-full flex-1 resize-y rounded-xl border border-[var(--line)] bg-white/90 px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)] dark:bg-white/10" /><MicTranscribeButton language="en" disabled={busy} onTranscript={(t: string) => setAnswers(a => ({ ...a, [item.id]: { ...(a[item.id] || { selected: [], essay: "" }), essay: ((a[item.id]?.essay || "") + " " + t).trim() } }))} /></div>
        <button onClick={() => { const r = answers[item.id]; void submitAnswer(item, r?.selected || [], r?.essay || ""); if (qi < challenge.items.length - 1) setQi(qi + 1); }} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-45">{qi < challenge.items.length - 1 ? "Submit & Next" : "Complete"}</button>
        {error ? <p className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2 text-sm text-[var(--coral)]">{error}</p> : null}
      </div>
    );
  }
  return null;
}
