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
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

// Shared Time Vault tokens (learning-games-v2.md §5.2) — single amber accent.
const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: AMBER,
  danger: CORAL,
  ink: INK,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
} = GAME_TOKENS["time-vault"];
const GREEN = "#6a9a5a";

type Phase = "loading" | "dossier" | "timeline" | "result";

export function TimeVaultGame() {
  const juice = useJuice();
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
  const [queue, setQueue] = useState<string[]>([]);
  const [rail, setRail] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<Record<string, number>>({});
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof validateTimeVault> | null>(null);
  const [cleared, setCleared] = useState(0);
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

    let vc = { ...pickFallbackCase(), difficulty };
    setCaseData(vc);
    setQueue([...vc.events.map((e) => e.id)].sort(() => Math.random() - 0.5));
    setRail([]);
    setSource("fallback");
    setPhase("dossier");

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
        setQueue([...vc.events.map((e) => e.id)].sort(() => Math.random() - 0.5));
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
    // Async case load; the sync setState reset in loadCase is intentional.
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
      juice.playCorrect();
      setCleared((c) => c + 1);
      setArtifacts((prev) =>
        prev.includes(caseData.civilization) ? prev : [...prev, caseData.civilization],
      );
    } else {
      juice.playError();
    }
    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Time Vault · ${caseData.title}`,
      userText: vaultSkillSeed(caseData),
      outcome: r.correct ? "correct" : "incorrect",
    });
  }, [caseData, rail, evidence, accountId]);

  const header = (
    <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d4a15c]/30 bg-[#d4a15c]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#d4a15c]">
          Time Vault
        </span>
        <span className="flex items-center gap-1.5" aria-label={`${cleared} cases sealed`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: i < cleared ? AMBER : "rgba(255,255,255,0.12)",
                transition: "background .3s",
              }}
            />
          ))}
        </span>
      </div>
    </header>
  );

  if (phase === "loading") {
    return (
      <div className="flex flex-1 flex-col bg-[#161009] text-[#e8dcc8]">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center">
          <ArchiveMark />
          <p className="mt-3 text-sm text-[#8a7a5f]">Opening the archive…</p>
        </div>
      </div>
    );
  }

  if (phase === "dossier" && caseData) {
    return (
      <div className="flex flex-1 flex-col bg-[#161009] text-[#e8dcc8]">
        {header}
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d4a15c]">
            Classified · {caseData.civilization}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{caseData.title}</h2>
          <p className="mt-1.5 text-sm text-[#c8b08a]">{caseData.intro}</p>

          <div className="mt-6 rounded-xl border p-4" style={{ borderColor: STROKE, background: SURFACE }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d4a15c]">
              Reading passage · {caseData.events.length} events to date
            </p>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#e8dcc8]">
              {sentences.map((sentence, idx) => (
                <p key={idx}>
                  <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-[#2a2015] text-[10px] tabular-nums text-[#d4a15c]">
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
            className="mt-5 min-h-12 w-full rounded-xl text-sm font-semibold text-[#161009] transition active:scale-[0.98]"
            style={{ background: AMBER }}
          >
            Begin reconstruction
          </button>
        </div>
      </div>
    );
  }

  if ((phase === "timeline" || phase === "result") && caseData) {
    const eventById = (id: string) => caseData.events.find((e) => e.id === id);
    const selectedEv = selectedEvent ? eventById(selectedEvent) : null;

    return (
      <div className="flex flex-1 flex-col bg-[#161009] text-[#e8dcc8]">
        {header}

        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
          {/* Timeline rail */}
          <div className="relative rounded-xl border px-3 pb-3 pt-2" style={{ borderColor: STROKE, background: SURFACE }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d4a15c]">
              Timeline · earliest → latest
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
                    className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition"
                    style={{
                      borderColor: misplaced ? "rgba(251,113,133,0.7)" : correct ? "rgba(106,154,90,0.7)" : STROKE,
                      background: misplaced ? "rgba(251,113,133,0.12)" : correct ? "rgba(106,154,90,0.12)" : "#241b12",
                    }}
                  >
                    <button
                      type="button"
                      disabled={phase === "result"}
                      onClick={() => popRail(i)}
                      className="rounded px-1 text-sm text-[#8a7a5f] hover:text-[#fb7185]"
                      aria-label={`remove ${ev?.label}`}
                    >
                      <XMark />
                    </button>
                    <EventMark id={id} />
                    <span className="max-w-[120px] truncate font-medium">{ev?.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event queue (unsolved) */}
          {queue.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: STROKE, background: SURFACE }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d4a15c]">
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
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-[#d4a15c]"
                      style={{ borderColor: STROKE, background: "#241b12" }}
                      title={ev?.label}
                    >
                      <EventMark id={id} />
                      <span>{ev?.label}</span>
                      {chosen && <CheckMark />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence linking */}
          {selectedEv && (
            <div
              className="mt-3 rounded-xl border p-3"
              style={{ borderColor: "rgba(212,161,92,0.5)", background: "rgba(212,161,92,0.08)" }}
            >
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
                      onClick={() => setEvidence((prev) => ({ ...prev, [selectedEv.id]: idx }))}
                      className="flex w-full items-start gap-2 rounded-lg border p-2 text-left text-xs leading-relaxed transition"
                      style={{
                        borderColor: picked ? AMBER : STROKE,
                        background: picked ? "rgba(212,161,92,0.14)" : "transparent",
                        color: picked ? "#f0d9a0" : INK_MUTED,
                      }}
                    >
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#2a2015] text-[10px] tabular-nums text-[#d4a15c]">
                        {idx + 1}
                      </span>
                      <span>{sentence}</span>
                      {picked && <span className="ml-auto"><CheckMark /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!selectedEvent && rail.length > 0 && (
            <p className="mt-3 text-center text-xs text-[#8a7a5f]">
              Tap a card on the timeline to attach its evidence sentence.
            </p>
          )}

          {phase === "timeline" && queue.length === 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              className="mt-4 min-h-12 w-full rounded-xl text-sm font-semibold text-[#161009] transition active:scale-[0.98]"
              style={{ background: AMBER }}
            >
              Seal the case
            </button>
          )}

          {/* Result */}
          {phase === "result" && result && (
            <div className="mt-4 space-y-3">
              <div
                className="rounded-xl border-2 p-4"
                style={{
                  borderColor: result.correct ? "rgba(106,154,90,0.6)" : "rgba(251,113,133,0.5)",
                  background: result.correct ? "rgba(106,154,90,0.1)" : "rgba(251,113,133,0.1)",
                }}
              >
                <p className="text-sm font-semibold text-[#e8dcc8]">
                  {result.correct
                    ? "Case closed — every date matches its evidence."
                    : "Not yet — misplaced cards bounced back."}
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
                  className="min-h-11 w-full rounded-xl border text-sm transition active:scale-[0.98]"
                  style={{ borderColor: "rgba(212,161,92,0.4)", color: INK }}
                >
                  Fix the archive
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadCase()}
                className="min-h-11 w-full rounded-xl text-sm font-semibold text-[#161009] transition active:scale-[0.98]"
                style={{ background: AMBER }}
              >
                Next case
              </button>
            </div>
          )}
        </div>

        {/* Evidence attach panel launcher */}
        {phase === "timeline" && rail.length > 0 && (
          <div className="sticky bottom-0 border-t border-white/10 bg-[#161009]/95 px-4 py-2.5 backdrop-blur pb-[max(0.6rem,env(safe-area-inset-bottom))]">
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
                    className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition"
                    style={{
                      borderColor: selectedEvent === id ? AMBER : picked ? "rgba(106,154,90,0.6)" : STROKE,
                      background: selectedEvent === id ? "rgba(212,161,92,0.2)" : picked ? "rgba(106,154,90,0.15)" : "transparent",
                      color: selectedEvent === id ? "#f0d9a0" : picked ? "#a8c8a0" : INK_MUTED,
                    }}
                  >
                    <EventMark id={id} small />
                    <span className="max-w-[90px] truncate">{ev?.label}</span>
                    {picked && <CheckMark />}
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

/* ---- geometric glyphs (no emoji) ---- */

function EventMark({ id, small }: { id: string; small?: boolean }) {
  const size = small ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-[11px]";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border font-bold uppercase ${size}`}
      style={{
        borderColor: "rgba(212,161,92,0.5)",
        background: "rgba(212,161,92,0.1)",
        color: "#d4a15c",
      }}
    >
      {id}
    </span>
  );
}

function XMark() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
      <path d="M3 3 L9 9 M9 3 L3 9" stroke="#8a7a5f" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      <path d="M3 7 L6 10 L11 4" fill="none" stroke="#6a9a5a" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function ArchiveMark() {
  return (
    <svg width={96} height={96} viewBox="0 0 96 96" aria-hidden>
      <circle cx={48} cy={48} r={46} fill="rgba(212,161,92,0.08)" />
      <circle cx={48} cy={48} r={46} fill="none" stroke="rgba(212,161,92,0.35)" strokeWidth={2} />
      <rect x={30} y={28} width={36} height={42} rx={4} fill="none" stroke="#d4a15c" strokeWidth={2} />
      <line x1={36} y1={40} x2={60} y2={40} stroke="#d4a15c" strokeWidth={1.6} />
      <line x1={36} y1={48} x2={60} y2={48} stroke="#d4a15c" strokeWidth={1.6} />
      <line x1={36} y1={56} x2={54} y2={56} stroke="#d4a15c" strokeWidth={1.6} />
      <rect x={40} y={22} width={16} height={8} rx={2} fill="#d4a15c" />
    </svg>
  );
}
