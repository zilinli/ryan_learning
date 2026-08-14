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
import { GAME_TOKENS } from "./learning-games/tokens";
import { useJuice } from "./learning-games/juice";

// Shared Eco Genesis tokens (learning-games-v2.md §5.2) — single leaf accent.
const {
  base: BASE,
  surface: SURFACE,
  stroke: STROKE,
  accent: LEAF,
  danger: CORAL,
  ink: INK,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
} = GAME_TOKENS["eco-genesis"];

// Trophic color ramp (producer → apex), geometric shapes per level.
const TROPHIC_TONE: Record<string, string> = {
  producer: "#34d399",
  primary: "#a7f3d0",
  secondary: "#fbbf24",
  tertiary: "#fb923c",
  apex: "#f87171",
};

const BIOME_THEME: Record<string, { label: string; tint: string }> = {
  grassland: { label: "Grassland", tint: "#34d399" },
  forest: { label: "Forest", tint: "#22c55e" },
  ocean: { label: "Ocean", tint: "#38bdf8" },
  desert: { label: "Desert", tint: "#fbbf24" },
};

type Phase = "build" | "predict" | "simulate" | "result";

export function EcoGenesisGame() {
  const juice = useJuice();
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
  const [biomesUnlocked, setBiomesUnlocked] = useState<string[]>([]);
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
    setDisaster(null);
  }, []);

  const pool = useMemo(() => speciesByBiome(biome), [biome]);
  const theme = biome ? BIOME_THEME[biome] : BIOME_THEME.grassland;
  const placedIds = useMemo(() => new Set(placed.map((s) => s.id)), [placed]);

  const handlePlaceToggle = useCallback((species: GenesisSpecies) => {
    setPlaced((prev) => {
      const exists = prev.find((s) => s.id === species.id);
      if (exists) {
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
      setArrowFrom(id);
      return;
    }
    if (arrowFrom === id) {
      setArrowFrom(null);
      return;
    }
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
    const r = runGenesis(placed, arrows);
    setRun(r);
    const well = choice === (actual ? "survive" : "collapse");
    setPredictedWell(well);
    if (well) juice.playCorrect();
    else juice.playError();

    void recordStudioLearningTurn({
      accountId,
      source: "game",
      title: `Eco Genesis · ${biome}`,
      userText: `${genesisSkillSeed(biome)} prediction ${choice} result ${actual ? "survive" : "collapse"}`,
      outcome: choice === (actual ? "survive" : "collapse") ? "correct" : "incorrect",
    });
  }, [placed, arrows, biome, accountId]);

  const handleDisaster = useCallback(() => {
    if (!run || !disaster) return;
    const withDisaster = applyGenesisEvent(placed, disaster);
    const rerun = runGenesis(withDisaster, arrows);
    setRun(rerun);
  }, [run, disaster, placed, arrows]);

  const arrowCheck = useMemo(() => validateGenesisArrows(placed, arrows), [placed, arrows]);

  const maxPop = useMemo(() => {
    const pops = run ? Object.values(run.snapshots[run.snapshots.length - 1]?.populations ?? {}) : [];
    return Math.max(20, ...pops);
  }, [run]);

  const shownSpecies = run ? run.snapshots[run.snapshots.length - 1] : null;

  return (
    <div className="flex flex-1 flex-col bg-[#0c1410] text-[#e8f6ee]">
      <style>{`
        @keyframes ecDissolve { to { opacity:.15; filter:blur(2px) grayscale(1); } }
        @keyframes ecPulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes ecGrow { from{transform:scale(.8);opacity:.4} to{transform:scale(1);opacity:1} }
      `}</style>

      <header className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#34d399]/30 bg-[#34d399]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#34d399]">
            <BiomeGlyph biome={biome} size={14} />
            {theme.label}
            <span className="text-[#6d8a7c]">· {phase}</span>
          </span>
          {biomesUnlocked.length > 0 && (
            <span className="flex items-center gap-1.5" aria-label="biomes unlocked">
              {biomesUnlocked.map((b) => (
                <BiomeGlyph key={b} biome={b} size={16} />
              ))}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Habitat terrarium */}
        <div
          className="relative flex min-h-[200px] flex-1 flex-col justify-end overflow-hidden rounded-2xl border"
          style={{
            borderColor: STROKE,
            background: `radial-gradient(120% 80% at 50% -10%, ${theme.tint}33 0%, transparent 60%), linear-gradient(180deg, #0e1a14 0%, #0c1410 60%, ${theme.tint}22 100%)`,
          }}
        >
          {placed.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-[#6d8a7c]">
              Add organisms below to seed the habitat
            </p>
          )}
          <div className="relative z-10 flex flex-wrap items-end gap-2 p-3">
            {placed.map((s) => {
              const currentPop = shownSpecies?.populations[s.id] ?? s.population;
              const extinct = currentPop <= 0;
              const isFrom = arrowFrom === s.id;
              const preyCount = arrows.filter(([a]) => a === s.id).length;
              return (
                <div
                  key={s.id}
                  className="flex flex-col items-center rounded-xl border px-2 py-1.5"
                  style={{
                    borderColor: isFrom ? CORAL : extinct ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.16)",
                    background: extinct ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                    animation: extinct ? "ecDissolve .5s ease forwards" : "ecGrow .3s ease",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleArrowToggle(s.id)}
                    className="transition-transform hover:scale-110"
                    aria-label={`${s.name} — tap to link energy`}
                    title={extinct ? `${s.name} went extinct` : s.blurb}
                  >
                    <SpeciesGlyph trophic={s.trophic} size={30} />
                  </button>
                  <span className="mt-0.5 max-w-[72px] truncate text-[10px] font-medium text-[#e8f6ee]">
                    {s.name}
                  </span>
                  <span
                    className="mt-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                    style={{
                      background: extinct ? "rgba(255,255,255,0.08)" : "rgba(52,211,153,0.15)",
                      color: extinct ? "#6d8a7c" : LEAF,
                    }}
                  >
                    {extinct ? "gone" : preyCount > 0 ? `${currentPop} · ${preyCount} link` : currentPop}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Arrow status */}
        {placed.length >= 2 && phase === "build" && (
          <div
            className="rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: STROKE, background: SURFACE, color: INK_MUTED }}
          >
            {arrowFrom ? (
              <span>
                <span style={{ color: CORAL }}>Linking:</span> tap the species it eats.
              </span>
            ) : arrowCheck.valid ? (
              <span style={{ color: LEAF }}>Every consumer has a food source.</span>
            ) : (
              <span style={{ color: CORAL }}>
                Tap a predator, then tap what it eats — energy flows up the chain.
              </span>
            )}
          </div>
        )}

        {/* Organism pool */}
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
                    className="flex items-center gap-2 rounded-xl border p-2.5 text-left transition active:scale-[0.98]"
                    style={{
                      borderColor: placedHere ? LEAF : STROKE,
                      background: placedHere ? "rgba(52,211,153,0.12)" : SURFACE,
                    }}
                  >
                    <SpeciesGlyph trophic={s.trophic} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[#e8f6ee]">
                        {s.name}
                      </span>
                      <span className="block text-[10px] capitalize text-[#a9c6b8]">
                        {s.trophic.replace("_", " ")}
                      </span>
                    </span>
                    {placedHere && <span className="ml-auto"><CheckMark /></span>}
                    {isFrom && <span className="ml-1 h-2.5 w-2.5 rounded-full bg-[#fb7185]" />}
                  </button>
                );
              })}
            </div>

            {placed.length >= 3 ? (
              <button
                type="button"
                onClick={() => setPhase("predict")}
                className="min-h-12 rounded-xl text-sm font-semibold text-[#052e2b] transition active:scale-[0.98]"
                style={{ background: LEAF }}
              >
                Link the food web
              </button>
            ) : (
              <p className="text-center text-xs text-[#6d8a7c]">
                Add at least 3 organisms to run the simulation.
              </p>
            )}
          </>
        )}

        {/* Arrow building */}
        {phase === "predict" && (
          <>
            <div className="rounded-xl border p-3" style={{ borderColor: STROKE, background: SURFACE }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d8a7c]">
                Link energy arrows (predator → its food)
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {placed.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setArrowFrom(s.id)}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs transition"
                    style={{
                      borderColor: arrowFrom === s.id ? CORAL : STROKE,
                      background: arrowFrom === s.id ? "rgba(251,113,133,0.15)" : "rgba(255,255,255,0.04)",
                      color: arrowFrom === s.id ? CORAL : INK,
                    }}
                  >
                    <SpeciesGlyph trophic={s.trophic} size={16} />
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <div className="flex flex-wrap gap-1.5">
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
                          className="flex min-h-8 items-center gap-1 rounded-full border px-2 text-[11px] transition disabled:opacity-40"
                          style={{
                            borderColor: active ? LEAF : STROKE,
                            background: active ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.03)",
                            color: active ? LEAF : INK_MUTED,
                          }}
                        >
                          <SpeciesGlyph trophic={prey.trophic} size={14} />
                          {prey.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPhase("simulate")}
              className="min-h-12 rounded-xl text-sm font-semibold text-[#052e2b] transition active:scale-[0.98]"
              style={{ background: LEAF }}
            >
              Predict and run
            </button>
          </>
        )}

        {/* Prediction */}
        {phase === "simulate" && prediction === null && (
          <div
            className="rounded-2xl border-2 p-4"
            style={{ borderColor: "rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.05)" }}
          >
            <p className="text-base font-semibold text-[#e8f6ee]">
              Will this ecosystem survive {GENESIS_STEPS} seasons?
            </p>
            <p className="mt-1 text-[13px] text-[#a9c6b8]">
              Check your food web, then predict before the simulation runs.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handlePredict("survive")}
                className="min-h-11 flex-1 rounded-xl text-sm font-semibold text-[#052e2b] transition active:scale-[0.98]"
                style={{ background: LEAF }}
              >
                It survives
              </button>
              <button
                type="button"
                onClick={() => handlePredict("collapse")}
                className="min-h-11 flex-1 rounded-xl border text-sm font-semibold transition active:scale-[0.98]"
                style={{ borderColor: "rgba(251,113,133,0.5)", background: "rgba(251,113,133,0.1)", color: CORAL }}
              >
                It collapses
              </button>
            </div>
          </div>
        )}

        {/* Simulation results */}
        {phase === "simulate" && run && prediction !== null && (
          <div className="space-y-3">
            <div
              className="rounded-xl border-2 p-4"
              style={{
                borderColor: run.survived ? "rgba(52,211,153,0.5)" : "rgba(251,113,133,0.4)",
                background: run.survived ? "rgba(52,211,153,0.05)" : "rgba(251,113,133,0.05)",
              }}
            >
              <p className="text-sm font-semibold text-[#e8f6ee]">
                {run.survived
                  ? "The ecosystem survived every season."
                  : run.extinct.length > 0
                    ? "The ecosystem collapsed."
                    : "The ecosystem barely held on."}
              </p>
              <p className="mt-1 text-xs text-[#a9c6b8]">
                {predictedWell
                  ? "Your prediction was right."
                  : `Your prediction was wrong — the ecosystem ${run.survived ? "survived" : "collapsed"}.`}
              </p>
              {run.extinct.length > 0 && (
                <p className="mt-1 text-xs text-[#fb7185]">
                  Extinct: {run.extinct.map((id) => placed.find((p) => p.id === id)?.name ?? id).join(", ")}
                </p>
              )}
            </div>

            {/* Population chart */}
            <div className="rounded-xl border p-4" style={{ borderColor: STROKE, background: SURFACE }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d8a7c]">
                Population over {GENESIS_STEPS} seasons
              </p>
              <div className="mt-3 space-y-2.5">
                {placed.map((s) => {
                  const series = run.snapshots.map((sn) => sn.populations[s.id] ?? 0);
                  const finalPop = series[series.length - 1] ?? 0;
                  const extinct = finalPop <= 0;
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <SpeciesGlyph trophic={s.trophic} size={18} />
                      <div className="flex-1">
                        <div className="flex h-6 gap-px overflow-hidden rounded-md bg-[#0a120d]">
                          {series.map((p, i) => (
                            <div
                              key={i}
                              className="flex-1 transition-all duration-500"
                              style={{
                                height: `${Math.max(4, (p / maxPop) * 100)}%`,
                                background: extinct ? "#fb7185" : LEAF,
                                opacity: 0.55 + (i / series.length) * 0.45,
                              }}
                              title={`Season ${i + 1}: ${p}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span
                        className="w-9 text-right text-xs font-semibold tabular-nums"
                        style={{ color: extinct ? CORAL : INK }}
                      >
                        {finalPop}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Disaster */}
            {disaster === null ? (
              <button
                type="button"
                onClick={() => {
                  const ev = pickGenesisEvent();
                  setDisaster(ev);
                  setPrediction(null);
                }}
                className="min-h-11 rounded-xl border text-sm font-medium transition active:scale-[0.98]"
                style={{ borderColor: "rgba(251,113,133,0.5)", background: "rgba(251,113,133,0.1)", color: CORAL }}
              >
                Trigger a disaster
              </button>
            ) : (
              <div
                className="rounded-xl border-2 p-4"
                style={{ borderColor: "rgba(251,113,133,0.4)", background: "rgba(251,113,133,0.05)" }}
              >
                <p className="text-sm font-semibold text-[#e8f6ee]">{disaster.label}</p>
                <p className="mt-1 text-[13px] text-[#a9c6b8]">{disaster.blurb}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleDisaster}
                    className="min-h-11 flex-1 rounded-xl text-sm font-semibold text-white transition active:scale-[0.98]"
                    style={{ background: CORAL }}
                  >
                    Re-run with disaster
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisaster(null)}
                    className="min-h-11 rounded-xl border px-3 text-xs transition active:scale-[0.98]"
                    style={{ borderColor: STROKE, color: INK }}
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
                className="min-h-12 flex-1 rounded-xl text-sm font-semibold text-[#052e2b] transition active:scale-[0.98]"
                style={{ background: LEAF }}
              >
                New biome
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- geometric glyphs (no emoji) ---- */

function SpeciesGlyph({ trophic, size }: { trophic: string; size: number }) {
  const tone = TROPHIC_TONE[trophic] ?? LEAF;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {trophic === "producer" && (
        <g>
          <path d="M12 22 L12 12" stroke={tone} strokeWidth={1.6} />
          <path d="M12 14 C8 14 6 11 6 7 C10 7 12 10 12 14 Z" fill={tone} opacity={0.9} />
          <path d="M12 12 C16 12 18 9 18 5 C14 5 12 8 12 12 Z" fill={tone} opacity={0.55} />
        </g>
      )}
      {trophic === "primary" && <circle cx={12} cy={12} r={7} fill={tone} opacity={0.85} />}
      {trophic === "secondary" && (
        <rect x={7} y={7} width={10} height={10} rx={1.5} fill={tone} transform="rotate(45 12 12)" opacity={0.85} />
      )}
      {trophic === "tertiary" && (
        <polygon points="12,4 15,9 20,10 16,14 17,20 12,17 7,20 8,14 4,10 9,9" fill={tone} opacity={0.85} />
      )}
      {trophic === "apex" && (
        <g>
          <path d="M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z" fill={tone} opacity={0.9} />
        </g>
      )}
    </svg>
  );
}

function BiomeGlyph({ biome, size }: { biome: string; size: number }) {
  const tone = BIOME_THEME[biome]?.tint ?? LEAF;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {biome === "grassland" && <path d="M8 14 L8 6 M8 8 C6 8 5 7 5 5 C7 5 8 6 8 8 Z" fill={tone} />}
      {biome === "forest" && (
        <g>
          <rect x={7} y={9} width={2} height={5} fill={tone} />
          <path d="M8 2 L12 8 L4 8 Z" fill={tone} />
          <path d="M8 5 L11 9 L5 9 Z" fill={tone} opacity={0.6} />
        </g>
      )}
      {biome === "ocean" && (
        <path d="M2 9 Q4 7 6 9 T10 9 T14 9" fill="none" stroke={tone} strokeWidth={1.6} />
      )}
      {biome === "desert" && (
        <g>
          <circle cx={8} cy={8} r={3} fill={tone} />
          <line x1={8} y1={2} x2={8} y2={4} stroke={tone} strokeWidth={1.2} />
          <line x1={8} y1={12} x2={8} y2={14} stroke={tone} strokeWidth={1.2} />
          <line x1={2} y1={8} x2={4} y2={8} stroke={tone} strokeWidth={1.2} />
          <line x1={12} y1={8} x2={14} y2={8} stroke={tone} strokeWidth={1.2} />
        </g>
      )}
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      <path d="M3 7 L6 10 L11 4" fill="none" stroke="#34d399" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
