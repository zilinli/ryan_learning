"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  initEcoTower,
  getAvailableOrganisms,
  placeOrganism,
  removeOrganism,
  toggleArrow,
  validateTower,
  runSimulation,
  pickDisaster,
  checkDisasterAnswer,
  type EcoTowerState,
  type DisasterEvent,
} from "@/lib/entertain/eco-tower";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

function levelColor(trophic: string): string {
  switch (trophic) {
    case "producer": return "#46a758";
    case "primary_consumer": return "#e89440";
    case "secondary_consumer": return "#3b82f6";
    case "tertiary_consumer": return "#ec4899";
    case "apex_predator": return "#8b5cf6";
    default: return "#888";
  }
}

export function EcoTowerGame() {
  const [state, setState] = useState<EcoTowerState>(initEcoTower);
  const [disaster, setDisaster] = useState<DisasterEvent | null>(null);
  const [disasterAnswer, setDisasterAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [simMessage, setSimMessage] = useState("");
  const [accountId, setAccountId] = useState("acct_ryan");

  useEffect(() => {
    try {
      const acct = getActiveAccount(loadAccounts());
      setAccountId(acct.id);
    } catch { /* use default */ }
  }, []);

  const orgs = useMemo(() => getAvailableOrganisms(state.biome), [state.biome]);
  const orgMap = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const placedOrgIds = useMemo(() => state.tower.filter((id): id is string => id !== null), [state.tower]);

  const handlePlace = useCallback((slotIndex: number, orgId: string) => {
    setState((prev) => placeOrganism(prev, slotIndex, orgId) ?? prev);
  }, []);

  const handleRemove = useCallback((orgId: string) => {
    setState((prev) => removeOrganism(prev, orgId));
  }, []);

  const handleArrowToggle = useCallback((fromId: string, toId: string) => {
    setState((prev) => toggleArrow(prev, fromId, toId));
  }, []);

  const handleSimulate = useCallback(async () => {
    const { balanced, message } = runSimulation(state);
    setSimMessage(message);
    setState((prev) => ({ ...prev, phase: balanced ? "balanced" : "collapsed" }));

    if (balanced) {
      setScore((s) => s + 30);
      void recordStudioLearningTurn({
        accountId,
        source: "natgeo",
        title: `Eco Tower · ${state.biome}`,
        userText: "ecosystem habitat food chain predator prey producer consumer energy flow",
        outcome: "correct",
      });
      // Show disaster challenge
      const d = pickDisaster();
      setDisaster(d);
      setDisasterAnswer(null);
    } else {
      void recordStudioLearningTurn({
        accountId,
        source: "natgeo",
        title: `Eco Tower · ${state.biome}`,
        userText: "ecosystem habitat food chain predator prey producer consumer energy flow",
        outcome: "incorrect",
      });
    }
  }, [state, accountId]);

  const handleDisasterAnswer = useCallback((idx: number) => {
    if (!disaster || disasterAnswer !== null) return;
    setDisasterAnswer(idx);
    if (checkDisasterAnswer(disaster, idx)) {
      setScore((s) => s + 15);
    }
  }, [disaster, disasterAnswer]);

  const handleReset = useCallback(() => {
    setState(initEcoTower());
    setDisaster(null);
    setDisasterAnswer(null);
    setSimMessage("");
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="capitalize text-[var(--ink-muted)]">
          {state.biome}{" "}
          <span className="text-xs text-[var(--teal)]">{state.phase}</span>
        </span>
        <span className="tabular-nums font-semibold text-[var(--ink)]">
          Score: {score}
        </span>
      </div>

      {/* Tower builder */}
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
        Eco Tower
      </h2>

      {/* Tower slots */}
      <div className="mb-4 space-y-1.5">
        {state.tower.map((orgId, i) => {
          const org = orgId ? orgMap.get(orgId) : null;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 text-center text-[10px] text-[var(--ink-muted)]">{i + 1}</span>
              <div className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                {org ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(org.id)}
                    className="flex w-full items-center gap-2 text-sm"
                    style={{ color: levelColor(org.trophicLevel) }}
                  >
                    <span>{org.emoji}</span>
                    <span className="flex-1 text-left text-[var(--ink)]">{org.name}</span>
                    <span className="text-[10px] text-[var(--ink-muted)]">✕</span>
                  </button>
                ) : (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handlePlace(i, e.target.value);
                    }}
                    className="w-full bg-transparent text-[13px] text-[var(--ink-muted)]"
                  >
                    <option value="">Place organism...</option>
                    {orgs.filter((o) => !state.tower.includes(o.id)).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.emoji} {o.name} ({o.trophicLevel.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrow controls — only show when tower has organisms */}
      {placedOrgIds.length >= 2 && (
        <div className="mb-4 space-y-2">
          <p className="text-[11px] text-[var(--ink-muted)]">Draw energy arrows (from eater → what it eats)</p>
          {placedOrgIds.map((eaterId) => {
            const eater = orgMap.get(eaterId);
            if (!eater) return null;
            const preyIds = placedOrgIds.filter((id) => id !== eaterId);
            if (!preyIds.length) return null;
            return (
              <div key={eaterId} className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--ink-muted)]">{eater.emoji} →</span>
                {preyIds.map((preyId) => {
                  const prey = orgMap.get(preyId);
                  if (!prey) return null;
                  const active = state.arrows.some(([a, b]) => a === eaterId && b === preyId);
                  return (
                    <button
                      key={preyId}
                      type="button"
                      onClick={() => handleArrowToggle(eaterId, preyId)}
                      className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                        active
                          ? "bg-[var(--teal)]/15 text-[var(--teal)] border border-[var(--teal)]/30"
                          : "border border-[var(--line)] text-[var(--ink-muted)]"
                      }`}
                    >
                      {prey.emoji}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Simulate / Disaster */}
      {(state.phase === "building" || state.phase === "collapsed") && (
        <button
          type="button"
          onClick={handleSimulate}
          disabled={placedOrgIds.length < 3}
          className="min-h-12 rounded-xl bg-[var(--teal)] text-sm font-semibold text-white disabled:opacity-40"
        >
          {state.phase === "collapsed" ? "Try again" : "Run simulation"}
        </button>
      )}

      {simMessage && (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">{simMessage}</p>
      )}

      {state.phase === "balanced" && (
        <button
          type="button"
          onClick={handleReset}
          className="mt-3 min-h-11 rounded-xl border border-[var(--line)] px-3 text-xs text-[var(--ink)]"
        >
          New biome
        </button>
      )}

      {/* Disaster challenge */}
      {disaster && (
        <div className="mt-4 rounded-xl border-2 border-[var(--coral)]/40 bg-[var(--coral)]/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--coral)]">
            Disaster
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{disaster.label}</p>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{disaster.question}</p>
          <div className="mt-3 space-y-1.5">
            {disaster.options.map((opt, i) => {
              const isAnswered = disasterAnswer !== null;
              const isCorrect = i === disaster.correctIndex;
              const wasChosen = disasterAnswer === i;
              let borderClass = "border-[var(--line)]";
              if (isAnswered && isCorrect) borderClass = "border-[var(--teal)]/50 bg-[var(--teal)]/10";
              else if (wasChosen && !isCorrect) borderClass = "border-[var(--coral)]/40 bg-[var(--coral)]/5";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleDisasterAnswer(i)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] text-[var(--ink)] transition ${borderClass}`}
                >
                  {opt}
                  {isAnswered && isCorrect && " ✓"}
                  {wasChosen && !isCorrect && " ✗"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
