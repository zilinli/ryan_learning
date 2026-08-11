"use client";

import type {
  BasisCoachReport,
  BasisDimensionId,
  BasisLevel,
} from "@/lib/entertain/basis-writing";
import { BASIS_DIMENSION_META } from "@/lib/entertain/basis-writing";

type Props = {
  report: BasisCoachReport;
  /** Plain coach text fallback when report missing dimensions */
  fallbackText?: string | null;
};

function levelColor(level: BasisLevel): string {
  if (level === "weak") return "var(--coral)";
  if (level === "strong") return "var(--teal)";
  return "#c4a35a";
}

function levelBg(level: BasisLevel): string {
  if (level === "weak") return "rgba(196, 92, 74, 0.12)";
  if (level === "strong") return "rgba(47, 122, 110, 0.12)";
  return "rgba(196, 163, 90, 0.14)";
}

function scoreLabel(score: number): string {
  if (score <= 2) return "Needs work";
  if (score >= 4) return "Strong";
  return "OK";
}

export function WritingCoachPanel({ report, fallbackText }: Props) {
  if (!report?.dimensions?.length) {
    if (!fallbackText) return null;
    return (
      <div className="mt-4 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/10 p-3 text-sm leading-relaxed text-[var(--ink)]">
        {fallbackText}
      </div>
    );
  }

  const focusSet = new Set<BasisDimensionId>(report.focusIds);
  const pct = Math.round((report.overall / 5) * 100);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {/* Header — Grammarly-like score glance */}
      <div className="flex items-stretch gap-3 border-b border-[var(--line)] bg-[var(--surface-muted)]/80 px-3 py-3 sm:px-4">
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--teal) ${pct}%, rgba(0,0,0,0.08) 0)`,
          }}
          aria-label={`Overall writing score ${report.overall} of 5`}
        >
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)]">
            <span className="text-sm font-semibold leading-none">
              {report.overall.toFixed(1)}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-[var(--ink-muted)]">
              / 5
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            BASIS writing check
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-[var(--ink)]">
            {report.headline}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
            {report.stats.words} words · {report.stats.sentences} sentences ·{" "}
            {Math.round(report.stats.uniqueRatio * 100)}% unique vocab
          </p>
        </div>
      </div>

      {/* Dimension rows — Hemingway-style color cue bars */}
      <ul className="divide-y divide-[var(--line)]">
        {report.dimensions.map((d) => {
          const focused = focusSet.has(d.id);
          const help = BASIS_DIMENSION_META[d.id].help;
          const fill = (d.score / 5) * 100;
          return (
            <li
              key={d.id}
              className={`px-3 py-2.5 sm:px-4 ${focused ? "bg-[var(--surface-muted)]/60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-flex min-h-6 items-center rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      color: levelColor(d.level),
                      background: levelBg(d.level),
                    }}
                  >
                    {d.shortLabel}
                  </span>
                  <span className="truncate text-xs font-medium text-[var(--ink)] sm:text-sm">
                    {d.label}
                  </span>
                  {focused && (
                    <span className="hidden shrink-0 rounded-full border border-[var(--coral)]/40 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--coral)] sm:inline">
                      Focus
                    </span>
                  )}
                </div>
                <span
                  className="shrink-0 text-[11px] font-semibold"
                  style={{ color: levelColor(d.level) }}
                >
                  {d.score}/5 · {scoreLabel(d.score)}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                title={help}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${fill}%`,
                    background: levelColor(d.level),
                  }}
                />
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-muted)]">
                {d.tip}
                {d.evidence ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-[var(--ink)]/70">
                    “{d.evidence}”
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Craft tip + questions */}
      <div className="space-y-2 border-t border-[var(--line)] bg-[var(--teal)]/5 px-3 py-3 sm:px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Craft tip
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
            {report.craftTip}
          </p>
        </div>
        {report.questions.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
              Try answering
            </p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[13px] leading-snug text-[var(--ink)]">
              {report.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
