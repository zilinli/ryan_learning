"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  difficultyFromPKnown,
  pickFallbackCase,
  splitPassageSentences,
  validateTimeVault,
  vaultSkillSeed,
  type TimeVaultCase,
} from "@/lib/entertain/time-vault";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";
import { loadLearningMemory } from "@/lib/learning-memory";

type Phase = "loading" | "dossier" | "timeline" | "result";

export function TimeVaultGame() {
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [phase, setPhase] = useState<Phase>("loading");
  const [caseData, setCaseData] = useState<TimeVaultCase | null>(null);
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [queue, setQueue] = useState<string[]>([]); // event ids not yet placed
  const [rail, setRail] = useState<string[]>([]);   // event ids in timeline order
  const [evidence, setEvidence] = useState<Record<string, number>>({});
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof validateTimeVault> | null>(null);
  const [score, setScore] = useState(0);
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const loadToken = useRef(0);
  const phaseRef = useRef<Phase>("loading");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const loadCase = useCallback(async () => {
    const token = ++loadToken.current;
    setPhase("loading");
    setResult(null);
    setSelectedEvent(null);
    setEvidence({});

    const mem = loadLearningMemory(accountId);
    const readingSkill = mem.skills?.find(
      (s) => s.id === "reading-evidence" || s.id === "ancient-civ",
    );
    const pKnown = readingSkill?.pKnown ?? 0.5;
    const difficulty = difficultyFromPKnown(pKnown);

    // Enter instantly with a static case so the game never blocks.
    let vc = { ...pickFallbackCase(), difficulty };
    setCaseData(vc);
    setQueue(
      [...vc.events.map((e) => e.id)].sort(() => Math.random() - 0.5),
    );
    setRail([]);
    setSource("fallback");
    setPhase("dossier");

    // Ask for an AI case in the background; swap it in only while the player
    // is still reading the dossier (before they start placing events).
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25_000);
    setAiLoading(true);
    try {
      const res = await fetch("/api/time-vault/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learner: {
            grade: 4,
            readingEvidencePKnown: pKnown,
          },
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        case?: TimeVaultCase;
        error?: string;
      };
      if (
        res.ok &&
        data.case &&
        token === loadToken.current &&
        phaseRef.current === "dossier"
      ) {
        vc = data.case;
        setCaseData(vc);
        setQueue(
          [...vc.events.map((e) => e.id)].sort(() => Math.random() - 0.5),
        );
        setRail([]);
        setEvidence({});
        setResult(null);
        setSelectedEvent(null);
        setSource("ai");
      }
    } catch {
      // static case already shown — keep it
    } finally {
      window.clearTimeout(timer);
      setAiLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    // Async case load; the sync setState reset in loadCase is intentional
    // (same deferral pattern as JournalTimeline/useTutorSession).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCase();
  }, [loadCase]);

  const sentences = useMemo(
    () => (caseData ? splitPassageSentences(caseData.passage) : []),
    [caseData],
  );

  const placeNext = useCallback((eventId: string) => {
    setQueue((prev) => prev.filter((id) => id !== eventId));
    setRail((prev) => [...prev, eventId]);
  }, []);

  const popRail = useCallback((index: number) => {
    setRail((prev) => {
      const id = prev[index];
      if (!id) return prev;
      setQueue((q) => [...q, id]);
      return prev.filter((_, i) => i !== index);
    });
    setSelectedEvent(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!caseData) return;
    const r = validateTimeVault(caseData, { order: rail, evidence });
    setResult(r);
    setPhase("result");
    if (r.correct) {
      setScore((s) => s + 20);
      setArtifacts((prev) =>
        prev.includes(caseData.civilization) ? prev : [...prev, caseData.civilization],
      );
    }
    void recordStudioLearningTurn({
      accountId,
      source: "natgeo",
      title: `Time Vault · ${caseData.title}`,
      userText: vaultSkillSeed(caseData),
      outcome: r.correct ? "correct" : "incorrect",
    });
  }, [caseData, rail, evidence, accountId]);

  if (phase === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#1f1710] text-[#e8dcc8]">
        <p className="text-4xl animate-pulse" aria-hidden>📜</p>
        <p className="mt-3 text-sm text-[#a8966f]">Opening the archive…</p>
      </div>
    );
  }

  if (phase === "dossier" && caseData) {
    return (
      <div className="flex min-h-dvh flex-col bg-[#1f1710] text-[#e8dcc8]">
        <header className="shrink-0 border-b border-[#4a3a26]/60 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
          <div className="mx-auto flex max-w-xl items-center justify-between">
            <button
              type="button"
              onClick={() => void loadCase()}
              className="rounded-lg border border-[#5a4a36] px-3 py-1.5 text-xs text-[#c8b08a]"
            >
              New case
            </button>
            <span className="text-xs text-[#8a7a5f]">
              {source === "ai"
                ? "Case file · AI generated"
                : aiLoading
                  ? "Case file · preparing AI case…"
                  : "Case file · archived"}
            </span>
          </div>
        </header>
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b89862]">
            Classified · {caseData.civilization}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
            {caseData.title}
          </h2>
          <p className="mt-1.5 text-sm italic text-[#c8b08a]">{caseData.intro}</p>

          <div className="mt-6 rounded-xl border border-[#5a4a36] bg-[#241a11] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b89862]">
              Reading passage · {caseData.events.length} events to date
            </p>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#e8dcc8]">
              {sentences.map((sentence, idx) => (
                <p key={idx}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[#3a2e1c] text-[10px] tabular-nums text-[#b89862]">
                    {idx + 1}
                  </span>
                  {sentence}
                </p>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPhase("timeline")}
            className="mt-5 min-h-12 w-full rounded-xl bg-[#8a6a3a] text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:bg-[#9a7a4a]"
          >
            Begin reconstruction →
          </button>
        </div>
      </div>
    );
  }

  if ((phase === "timeline" || phase === "result") && caseData) {
    const eventById = (id: string) => caseData.events.find((e) => e.id === id);
    const selectedEv = selectedEvent ? eventById(selectedEvent) : null;

    return (
      <div className="flex min-h-dvh flex-col bg-[#1f1710] text-[#e8dcc8]">
        <header className="shrink-0 border-b border-[#4a3a26]/60 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
          <div className="mx-auto flex max-w-xl items-center justify-between text-sm">
            <span className="text-[#a8966f]">
              {caseData.title}
              <span className="ml-2 text-xs text-[#8a7a5f]">{source === "ai" ? "· AI case" : ""}</span>
            </span>
            <span className="tabular-nums font-semibold text-[#e8dcc8]">Score: {score}</span>
          </div>
          {artifacts.length > 0 && (
            <p className="mx-auto mt-1 max-w-xl text-xs text-[#b89862]">
              Collected: {artifacts.join(" · ")}
            </p>
          )}
        </header>

        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
          {/* Timeline rail */}
          <div className="relative rounded-xl border border-[#5a4a36] bg-[#241a11] px-3 pb-3 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b89862]">
              Timeline · earliest → latest
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#8a7a5f]" aria-hidden>◂</span>
              {rail.length === 0 && (
                <span className="text-xs text-[#8a7a5f]">Empty — place events from the file below.</span>
              )}
              {rail.map((id, i) => {
                const ev = eventById(id);
                const misplaced = result && result.misplaced.includes(id);
                const correct = result && !result.misplaced.includes(id);
                return (
                  <div
                    key={`${id}-${i}`}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${
                      misplaced
                        ? "border-[#c0392b]/70 bg-[#c0392b]/15"
                        : correct
                          ? "border-[#6a9a5a]/70 bg-[#6a9a5a]/15"
                          : "border-[#5a4a36] bg-[#2e2418]"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={phase === "result"}
                      onClick={() => popRail(i)}
                      className="rounded px-1 text-sm hover:text-[#e09a7a]"
                      aria-label={`remove ${ev?.label}`}
                    >
                      ✕
                    </button>
                    <span className="text-lg" aria-hidden>{ev?.emoji}</span>
                    <span className="max-w-[120px] truncate font-medium">{ev?.label}</span>
                    {misplaced && <span className="text-[#e09a7a]">✗</span>}
                  </div>
                );
              })}
              <span className="ml-auto text-xs text-[#8a7a5f]" aria-hidden>▸</span>
            </div>
          </div>

          {/* Event queue (unsolved) */}
          {queue.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#5a4a36] bg-[#241a11] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b89862]">
                Evidence file · {queue.length} unplaced
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {queue.map((id) => {
                  const ev = eventById(id);
                  const chosen = evidence[id] !== undefined;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={phase === "result"}
                      onClick={() => placeNext(id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#5a4a36] bg-[#2e2418] px-2.5 py-1.5 text-xs transition hover:border-[#b89862]"
                      title={ev?.label}
                    >
                      <span className="text-lg" aria-hidden>{ev?.emoji}</span>
                      <span>{ev?.label}</span>
                      {chosen && <span className="text-[#6a9a5a]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence linking */}
          {selectedEv && (
            <div className="mt-3 rounded-xl border border-[#b89862]/50 bg-[#3a2e1c]/60 p-3">
              <p className="text-xs font-semibold text-[#e8dcc8]">
                Which sentence proves the date of{" "}
                <span className="text-[#f0d9a0]">{selectedEv.label}</span>?
              </p>
              <div className="mt-2 space-y-1.5">
                {sentences.map((sentence, idx) => {
                  const picked = evidence[selectedEv.id] === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setEvidence((prev) => ({ ...prev, [selectedEv.id]: idx }))
                      }
                      className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left text-xs leading-relaxed transition ${
                        picked
                          ? "border-[#b89862] bg-[#b89862]/15 text-[#f0d9a0]"
                          : "border-[#4a3a26] text-[#c8b08a] hover:border-[#8a7a5f]"
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#4a3a26] text-[10px] tabular-nums">
                        {idx + 1}
                      </span>
                      <span>{sentence}</span>
                      {picked && <span className="ml-auto text-[#f0d9a0]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hint: tap timeline card to attach evidence */}
          {!selectedEvent && rail.length > 0 && (
            <p className="mt-3 text-center text-xs text-[#8a7a5f]">
              Tap a card on the timeline to attach its evidence sentence.
            </p>
          )}

          {phase === "timeline" && (
            <>
              {queue.length === 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="mt-4 min-h-12 w-full rounded-xl bg-[#8a6a3a] text-sm font-semibold text-white transition hover:bg-[#9a7a4a]"
                >
                  Seal the case 🔒
                </button>
              )}
            </>
          )}

          {/* Result */}
          {phase === "result" && result && (
            <div className="mt-4 space-y-3">
              <div
                className={`rounded-xl border-2 p-4 ${
                  result.correct
                    ? "border-[#6a9a5a]/60 bg-[#6a9a5a]/10"
                    : "border-[#c0392b]/50 bg-[#c0392b]/10"
                }`}
              >
                <p className="text-sm font-semibold text-[#e8dcc8]">
                  {result.correct
                    ? "🕵️ Case closed — every date matches its evidence!"
                    : "📎 Not yet — misplaced cards bounced back."}
                </p>
                <p className="mt-1 text-xs text-[#c8b08a]">{result.message}</p>
              </div>
              {!result.correct && (
                <button
                  type="button"
                  onClick={() => {
                    setPhase("timeline");
                    setResult(null);
                  }}
                  className="min-h-11 w-full rounded-xl border border-[#c8b08a]/40 text-sm text-[#e8dcc8]"
                >
                  Fix the archive ↻
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadCase()}
                className="min-h-11 w-full rounded-xl bg-[#8a6a3a] text-sm font-semibold text-white transition hover:bg-[#9a7a4a]"
              >
                Next case →
              </button>
            </div>
          )}
        </div>

        {/* Evidence attach panel launcher */}
        {phase === "timeline" && rail.length > 0 && (
          <div className="sticky bottom-0 border-t border-[#4a3a26]/60 bg-[#1f1710]/95 px-4 py-2.5 backdrop-blur pb-[max(0.6rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-xl items-center gap-2 overflow-x-auto">
              {rail.map((id) => {
                const ev = eventById(id);
                const picked = evidence[id] !== undefined;
                return (
                  <button
                    key={`${id}-attach`}
                    type="button"
                    onClick={() => {
                      setSelectedEvent((prev) => (prev === id ? null : id));
                      setResult(null);
                    }}
                    className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                      selectedEvent === id
                        ? "border-[#b89862] bg-[#b89862]/20 text-[#f0d9a0]"
                        : picked
                          ? "border-[#6a9a5a]/60 bg-[#6a9a5a]/15 text-[#a8c8a0]"
                          : "border-[#4a3a26] text-[#c8b08a]"
                    }`}
                  >
                    <span>{ev?.emoji}</span>
                    <span className="max-w-[90px] truncate">{ev?.label}</span>
                    {picked && <span>✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="mx-auto mt-1 max-w-xl text-center text-[10px] text-[#8a7a5f]">
              {selectedEvent ? "Pick the proving sentence above." : "Tap a card to link its evidence."}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
