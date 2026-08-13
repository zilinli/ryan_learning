"use client";

import { useCallback, useMemo, useState } from "react";
import {
  speciesByBiome,
  pickBiome,
  runGenesis,
  predictSurvival,
  pickGenesisEvent,
  applyGenesisEvent,
  validateGenesisArrows,
  genesisSkillSeed,
  GENESIS_STEPS,
  type GenesisSpecies,
  type GenesisArrow,
  type GenesisRun,
} from "@/lib/entertain/eco-genesis";
import { recordStudioLearningTurn } from "@/lib/entertain/studio-learning";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

const BIOME_THEME: Record<
  string,
  { sky: string; ground: string; label: string; emoji: string }
> = {
  grassland: { sky: "#aee3f2", ground: "#6db560", label: "Grassland", emoji: "🌾" },
  forest: { sky: "#b7d9e8", ground: "#3e7d4f", label: "Forest", emoji: "🌲" },
  ocean: { sky: "#a8d4ef", ground: "#2c6fbf", label: "Ocean", emoji: "🌊" },
  desert: { sky: "#f2ddb0", ground: "#d9a65c", label: "Desert", emoji: "🏜️" },
};

type Phase = "build" | "predict" | "simulate" | "result";

export function EcoGenesisGame() {
  const [accountId] = useState(() => {
    try {
      return getActiveAccount(loadAccounts()).id;
    } catch {
      return "acct_ryan";
    }
  });
  const [biome, setBiome] = useState(() => pickBiome());
  const [placed, setPlaced] = useState<GenesisSpecies[]>([]);
  const [arrows, setArrows] = useState<GenesisArrow[]>([]);
  const [arrowFrom, setArrowFrom] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("build");
  const [prediction, setPrediction] = useState<"survive" | "collapse" | null>(null);
  const [run, setRun] = useState<GenesisRun | null>(null);
  const [predictedWell, setPredictedWell] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [biomesUnlocked, setBiomesUnlocked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [disaster, setDisaster] = useState<ReturnType<typeof pickGenesisEvent> | null>(null);

  const startLevel = useCallback(() => {
    const b = pickBiome();
    setBiome(b);
    setPlaced([]);
    setArrows([]);
    setArrowFrom(null);
    setPhase("build");
    setPrediction(null);
    setRun(null);
    setPredictedWell(null);
    setMessage("");
    setDisaster(null);
  }, []);

  const pool = useMemo(() => speciesByBiome(biome), [biome]);
  const theme = biome ? BIOME_THEME[biome] : BIOME_THEME.grassland;
  const placedIds = useMemo(() => new Set(placed.map((s) => s.id)), [placed]);

  const handlePlaceToggle = useCallback((species: GenesisSpecies) => {
    setPlaced((prev) => {
      const exists = prev.find((s) => s.id === species.id);
      if (exists) {
        // Remove + drop arrows touching it.
        setArrows((prevArrows) =>
          prevArrows.filter(([a, b]) => a !== species.id && b !== species.id),
        );
        return prev.filter((s) => s.id !== species.id);
      }
      return [...prev, species];
    });
    setArrowFrom((f) => (f === species.id ? null : f));
  }, []);

  const handleArrowToggle = useCallback((id: string) => {
    if (arrowFrom === null) {
      // First tap selects the eater.
      setArrowFrom(id);
      return;
    }
    if (arrowFrom === id) {
      // Second tap on same → clear.
      setArrowFrom(null);
      return;
    }
    // arrowFrom is eater; current tapped species is prey.
    setArrows((prev) => {
      const exists = prev.some(([a, b]) => a === arrowFrom && b === id);
      if (exists) {
        return prev.filter(([a, b]) => !(a === arrowFrom && b === id));
      }
      return [...prev, [arrowFrom, id]];
    });
    setArrowFrom(null);
  }, [arrowFrom]);

  const handlePredict = useCallback((choice: "survive" | "collapse") => {
    if (placed.length < 2) return;
    setPrediction(choice);
    setPhase("simulate");
    const actual = predictSurvival(placed, arrows);
    const run = runGenesis(placed, arrows);
    setRun(run);
    setPredictedWell(choice === (actual ? "survive" : "collapse"));
    setScore((s) => s + (choice === (actual ? "survive" : "collapse") ? 20 : 0));

    void recordStudioLearningTurn({
      accountId,
      source: "natgeo",
      title: `Eco Genesis · ${biome}`,
      userText: `${genesisSkillSeed(biome)} prediction ${choice} result ${actual ? "survive" : "collapse"}`,
      outcome: choice === (actual ? "survive" : "collapse") ? "correct" : "incorrect",
    });
  }, [placed, arrows, biome, accountId]);

  const handleDisaster = useCallback(() => {
    if (!run || !disaster) return;
    // Apply disaster to the original species set and re-run.
    const withDisaster = applyGenesisEvent(placed, disaster);
    const rerun = runGenesis(withDisaster, arrows);
    setRun(rerun);
    setScore((s) => s + (rerun.survived ? 15 : 0));
  }, [run, disaster, placed, arrows]);

  const arrowCheck = useMemo(() => validateGenesisArrows(placed, arrows), [placed, arrows]);

  const maxPop = useMemo(() => {
    const pops = run ? Object.values(run.snapshots[run.snapshots.length - 1]?.populations ?? {}) : [];
    return Math.max(20, ...pops);
  }, [run]);

  const shownSpecies = run ? run.snapshots[run.snapshots.length - 1] : null;

  return (
    <div className="flex min-h-dvh flex-col bg-[#eef6ef] text-[var(--ink)]">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--line)] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between text-sm">
          <span className="text-[var(--ink-muted)]">
            {theme.emoji} <span className="font-semibold capitalize">{theme.label}</span>
            <span className="ml-1.5 text-xs text-[var(--teal)]">{phase}</span>
          </span>
          <span className="tabular-nums font-semibold text-[var(--ink)]">Score: {score}</span>
          {biomesUnlocked.length > 0 && (
            <span className="text-[var(--teal)]">
              {biomesUnlocked.map((b) => BIOME_THEME[b]?.emoji ?? "").join(" ")}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* ── Habitat ── */}
        <div
          className="relative flex min-h-[200px] flex-1 flex-col justify-end overflow-hidden rounded-2xl border border-[var(--line)] shadow-inner"
          style={{
            background: `linear-gradient(180deg, ${theme.sky} 0%, ${theme.sky} 55%, ${theme.ground} 100%)`,
          }}
        >
          {placed.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-black/40">
              Tap organisms below to add them to the habitat
            </p>
          )}
          <div className="relative z-10 flex flex-wrap items-end gap-2 p-3">
            {placed.map((s) => {
              const currentPop = shownSpecies?.populations[s.id] ?? s.population;
              const extinct = currentPop <= 0;
              const isFrom = arrowFrom === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex flex-col items-center rounded-xl px-2 py-1.5 transition-all duration-500 ${
                    extinct
                      ? "opacity-25 grayscale"
                      : "bg-white/70 shadow-md backdrop-blur-sm"
                  } ${isFrom ? "ring-2 ring-[var(--coral)]" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => handleArrowToggle(s.id)}
                    className="text-3xl transition-transform hover:scale-110"
                    aria-label={`${s.name} — tap to draw an arrow`}
                    title={extinct ? `${s.name} went extinct` : s.blurb}
                  >
                    {s.emoji}
                  </button>
                  <span className="mt-0.5 max-w-[72px] truncate text-[10px] font-medium text-[var(--ink)]">
                    {s.name}
                  </span>
                  <span
                    className={`mt-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                      extinct
                        ? "bg-black/15 text-black/50"
                        : "bg-[var(--teal)]/15 text-[var(--teal)]"
                    }`}
                  >
                    {extinct ? "gone" : currentPop}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Arrow status ── */}
        {placed.length >= 2 && phase === "build" && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink-muted)]">
            {arrowFrom ? (
              <>
                <span className="font-semibold text-[var(--coral)]">Drawing arrow:</span>{" "}
                tap the species it eats.
              </>
            ) : arrowCheck.valid ? (
              <span className="text-[var(--teal)]">✓ Every species has a food source.</span>
            ) : (
              <span className="text-[var(--coral)]">
                ⚠️ Tap a predator, then tap what it eats (energy flows up the chain).
              </span>
            )}
          </div>
        )}

        {/* ── Organism pool (build phase) ── */}
        {phase === "build" && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pool.map((s) => {
                const placedHere = placedIds.has(s.id);
                const isFrom = arrowFrom === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handlePlaceToggle(s)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                      placedHere
                        ? "border-[var(--teal)] bg-[var(--teal)]/10"
                        : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--teal)]/50"
                    } ${isFrom ? "ring-2 ring-[var(--coral)]" : ""}`}
                  >
                    <span className="text-2xl" aria-hidden>{s.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[var(--ink)]">
                        {s.name}
                      </span>
                      <span className="block text-[10px] capitalize text-[var(--ink-muted)]">
                        {s.trophic.replace("_", " ")}
                      </span>
                    </span>
                    {placedHere && <span className="ml-auto text-[var(--teal)]">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Arrow building hint + simulate */}
            {placed.length >= 3 ? (
              <button
                type="button"
                onClick={() => setPhase("predict")}
                className="min-h-12 rounded-xl bg-[var(--teal)] text-sm font-semibold text-white"
              >
                Build food arrows →
              </button>
            ) : (
              <p className="text-center text-xs text-[var(--ink-muted)]">
                Add at least 3 organisms to run the simulation.
              </p>
            )}
          </>
        )}

        {/* ── Arrow building ── */}
        {phase === "predict" && (
          <>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Draw energy arrows (predator → its food)
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {placed.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setArrowFrom(s.id)}
                    className={`min-h-9 rounded-full border px-2.5 text-xs transition ${
                      arrowFrom === s.id
                        ? "border-[var(--coral)] bg-[var(--coral)]/15 text-[var(--coral)]"
                        : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)]"
                    }`}
                  >
                    {s.emoji} {s.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 min-h-[40px]">
                {arrowFrom ? (
                  <p className="text-xs text-[var(--ink-muted)]">
                    Selected <span className="font-semibold text-[var(--coral)]">{arrowFrom}</span> as
                    eater. Tap its prey from the habitat or the chips below.
                  </p>
                ) : (
                  <p className="text-xs text-[var(--ink-muted)]">
                    Tap a predator chip, then tap its prey in the habitat to link energy flow.
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {placed
                    .filter((p) => p.id !== arrowFrom)
                    .map((prey) => {
                      const active = arrowFrom
                        ? arrows.some(([a, b]) => a === arrowFrom && b === prey.id)
                        : false;
                      return (
                        <button
                          key={prey.id}
                          type="button"
                          disabled={!arrowFrom}
                          onClick={() => handleArrowToggle(prey.id)}
                          className={`min-h-8 rounded-full border px-2 text-[11px] transition disabled:opacity-40 ${
                            active
                              ? "border-[var(--teal)] bg-[var(--teal)]/15 text-[var(--teal)]"
                              : "border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                          }`}
                        >
                          {prey.emoji} {prey.name} {active ? "✓" : ""}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPhase("simulate")}
              className="min-h-12 rounded-xl bg-[var(--teal)] text-sm font-semibold text-white"
            >
              Predict &amp; run →
            </button>
          </>
        )}

        {/* ── Prediction ── */}
        {phase === "simulate" && prediction === null && (
          <div className="rounded-2xl border-2 border-[var(--teal)]/40 bg-[var(--teal)]/5 p-4">
            <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink)]">
              Will this ecosystem survive {GENESIS_STEPS} seasons?
            </p>
            <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
              Check your food chain, then make a prediction before the simulation runs.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handlePredict("survive")}
                className="min-h-11 flex-1 rounded-xl bg-[var(--teal)] text-sm font-semibold text-white"
              >
                Yes, it survives
              </button>
              <button
                type="button"
                onClick={() => handlePredict("collapse")}
                className="min-h-11 flex-1 rounded-xl border border-[var(--coral)]/50 bg-[var(--coral)]/10 text-sm font-semibold text-[var(--coral)]"
              >
                No, it collapses
              </button>
            </div>
          </div>
        )}

        {/* ── Simulation results ── */}
        {phase === "simulate" && run && prediction !== null && (
          <div className="space-y-3">
            <div
              className={`rounded-xl border-2 p-4 ${
                run.survived
                  ? "border-[var(--teal)]/50 bg-[var(--teal)]/5"
                  : "border-[var(--coral)]/40 bg-[var(--coral)]/5"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--ink)]">
                {run.survived
                  ? "🌿 The ecosystem survived every season!"
                  : run.extinct.length > 0
                    ? "💀 The ecosystem collapsed."
                    : "⚠️ The ecosystem barely survived."}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {predictedWell
                  ? "Your prediction was right!"
                  : `Your prediction was wrong — the ecosystem ${run.survived ? "survived" : "collapsed"}.`}
              </p>
              {run.extinct.length > 0 && (
                <p className="mt-1 text-xs text-[var(--coral)]">
                  Extinct: {run.extinct.map((id) => placed.find((p) => p.id === id)?.name ?? id).join(", ")}
                </p>
              )}
            </div>

            {/* Population chart */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Population over {GENESIS_STEPS} seasons
              </p>
              <div className="mt-3 space-y-2.5">
                {placed.map((s) => {
                  const series = run.snapshots.map((sn) => sn.populations[s.id] ?? 0);
                  const finalPop = series[series.length - 1] ?? 0;
                  const extinct = finalPop <= 0;
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="w-8 text-lg" aria-hidden>{s.emoji}</span>
                      <div className="flex-1">
                        <div className="flex h-6 gap-px overflow-hidden rounded-md bg-[var(--mist)]/40">
                          {series.map((p, i) => (
                            <div
                              key={i}
                              className="flex-1 transition-all duration-500"
                              style={{
                                height: `${Math.max(4, (p / maxPop) * 100)}%`,
                                background: extinct ? "#c0392b" : "var(--teal)",
                                opacity: 0.55 + (i / series.length) * 0.45,
                              }}
                              title={`Season ${i + 1}: ${p}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span
                        className={`w-9 text-right text-xs font-semibold tabular-nums ${
                          extinct ? "text-[var(--coral)]" : "text-[var(--ink)]"
                        }`}
                      >
                        {finalPop}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Disaster + actions */}
            {disaster === null ? (
              <button
                type="button"
                onClick={() => {
                  const ev = pickGenesisEvent();
                  setDisaster(ev);
                  setPrediction(null);
                }}
                className="min-h-11 rounded-xl border border-[var(--coral)]/50 bg-[var(--coral)]/10 text-sm font-medium text-[var(--coral)]"
              >
                ⚠️ Trigger a disaster
              </button>
            ) : (
              <div className="rounded-xl border-2 border-[var(--coral)]/40 bg-[var(--coral)]/5 p-4">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  ⚠️ {disaster.label}
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{disaster.blurb}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleDisaster}
                    className="min-h-11 flex-1 rounded-xl bg-[var(--coral)] text-sm font-semibold text-white"
                  >
                    Re-run with disaster
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisaster(null)}
                    className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-xs text-[var(--ink)]"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBiomesUnlocked((prev) => (prev.includes(biome) ? prev : [...prev, biome]));
                  startLevel();
                }}
                className="min-h-12 flex-1 rounded-xl bg-[var(--teal)] text-sm font-semibold text-white"
              >
                New biome 🌍
              </button>
            </div>
          </div>
        )}

        {message && <p className="text-center text-sm text-[var(--ink-muted)]">{message}</p>}
      </div>
    </div>
  );
}
