"use client";

import { useEffect, useMemo, useState } from "react";
import {
  hydrateLearningMemoryFromServer,
  loadLearningMemory,
  type LearningMemory,
} from "@/lib/learning-memory";
import {
  buildAccountLearningExport,
  downloadAccountLearningExport,
} from "@/lib/account-export";
import {
  buildLearningPortfolioHtml,
  openLearningPortfolioPrint,
} from "@/lib/learning-portfolio";
import {
  buildFamilyReport,
  radarPolygonPoints,
  SUBJECT_LABELS,
  type MistakePattern,
  type PatternSeverity,
} from "@/lib/family-report";
import {
  hasParentPin,
  isParentSessionUnlocked,
  loadCheckMode,
  lockParentSession,
  saveCheckMode,
  unlockParentSession,
} from "@/lib/adult-gate";
import { PinGate } from "./PinGate";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

function severityLabel(s: PatternSeverity): string {
  if (s === "persistent") return "Persistent";
  if (s === "recurring") return "Recurring";
  return "Watch";
}

function severityClass(s: PatternSeverity): string {
  if (s === "persistent") return "bg-[var(--coral)]/15 text-[var(--coral)]";
  if (s === "recurring")
    return "bg-[color-mix(in_srgb,var(--coral)_10%,var(--mist))] text-[var(--ink)]";
  return "bg-[var(--mist)] text-[var(--ink-muted)]";
}

function PatternCard({ p }: { p: MistakePattern }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--ink)]">
            {p.label}
          </h3>
          <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
            {[p.subject, p.skillLabel].filter(Boolean).join(" · ")}
            {p.count ? ` · seen ×${p.count}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${severityClass(p.severity)}`}
        >
          {severityLabel(p.severity)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mist)]">
        <div
          className="h-full rounded-full bg-[var(--coral)]/75"
          style={{ width: `${Math.min(100, p.count * 18)}%` }}
        />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink)]">
        <span className="font-semibold text-[var(--teal)]">Try at home: </span>
        {p.parentTip}
      </p>
    </article>
  );
}

/**
 * Full-page Family Controls — Khan-style parent hub with narrative + charts.
 */
export function FamilyControlsPage() {
  const [memory, setMemory] = useState<LearningMemory | null>(null);
  const [accountId, setAccountId] = useState("acct_ryan");
  const [accountName, setAccountName] = useState("Student");
  const [unlocked, setUnlocked] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [checkMode, setCheckMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const acct = getActiveAccount(loadAccounts());
    setAccountId(acct.id);
    setAccountName(acct.profile.name || "Student");
    setMemory(loadLearningMemory(acct.id));
    void hydrateLearningMemoryFromServer(acct.id).then(setMemory);
    const ok = hasParentPin() && isParentSessionUnlocked();
    setUnlocked(ok);
    setCheckMode(loadCheckMode());
    if (!ok) setShowPin(true);
  }, []);

  const report = useMemo(
    () =>
      buildFamilyReport(memory, {
        accountLabel: accountName,
      }),
    [memory, accountName],
  );

  const radarValues = report.radar.map((r) => r.value);
  const poly = radarPolygonPoints(
    radarValues.length ? radarValues : [0],
    100,
    100,
    80,
  );
  const maxPractice = Math.max(
    1,
    ...report.practicedBars.map((p) => p.mastery),
  );

  const onUnlock = () => {
    unlockParentSession();
    setUnlocked(true);
    setShowPin(false);
  };

  const lock = () => {
    lockParentSession();
    saveCheckMode(false);
    setCheckMode(false);
    setUnlocked(false);
    setShowPin(true);
  };

  return (
    <div className="min-h-dvh bg-[var(--bg0)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)]/70 bg-[var(--surface-muted)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Family controls
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {accountName}&apos;s week
            </h1>
            <p className="mt-1 max-w-xl text-[13px] text-[var(--ink-muted)]">
              Parent hub — progress, effort, and sticky mistakes with what to try
              at home. Same idea as Khan Academy&apos;s parent dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-medium leading-[2.75rem]"
            >
              Back to tutor
            </a>
            {unlocked ? (
              <button
                type="button"
                onClick={lock}
                className="min-h-11 rounded-full border border-[var(--line)] px-4 text-[13px] font-medium"
              >
                Lock
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowPin(true)}
                className="min-h-11 rounded-full bg-[var(--teal)] px-4 text-[13px] font-semibold text-white"
              >
                Unlock
              </button>
            )}
          </div>
        </div>
      </header>

      {!unlocked ? (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-[15px] text-[var(--ink-muted)]">
            Enter the parent PIN to see the full summary, charts, and mistake
            coaching. Kids stay on the tutor; this page stays gated.
          </p>
          <button
            type="button"
            onClick={() => setShowPin(true)}
            className="mt-6 min-h-12 rounded-full bg-[var(--teal)] px-6 text-[14px] font-semibold text-white"
          >
            {hasParentPin() ? "Enter PIN" : "Set parent PIN"}
          </button>
        </div>
      ) : (
        <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
          {/* Narrative */}
          <section className="rounded-2xl border border-[var(--teal)]/25 bg-[var(--teal)]/5 p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Summary
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]">
              {report.narrative}
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(report.weekly.text)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
              }}
              className="mt-3 min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px]"
            >
              {copied ? "Copied" : "Copy week text"}
            </button>
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {[
              { label: "Skills tracked", value: report.kpis.skillsTracked },
              {
                label: "Practiced (7d)",
                value: report.kpis.practicedThisWeek,
              },
              { label: "Gains", value: report.kpis.gains },
              { label: "Watch", value: report.kpis.watch },
              { label: "SM-2 due", value: report.kpis.reviewDue },
              { label: "Effort", value: report.kpis.effortAttempts },
              {
                label: "Idle days",
                value:
                  report.kpis.idleDays == null ? "—" : report.kpis.idleDays,
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  {k.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">
                  {k.value}
                </p>
              </div>
            ))}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Radar */}
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--teal)]">
                Subject strength
              </h2>
              <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" aria-hidden>
                  {[20, 40, 60, 80].map((rr) => (
                    <circle
                      key={rr}
                      cx="100"
                      cy="100"
                      r={rr}
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth="1"
                    />
                  ))}
                  {report.radar.map((r, i) => {
                    const n = report.radar.length || 1;
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
                    const x = 100 + Math.cos(angle) * 88;
                    const y = 100 + Math.sin(angle) * 88;
                    return (
                      <text
                        key={r.subject}
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[var(--ink-muted)]"
                        style={{ fontSize: 9 }}
                      >
                        {r.label}
                      </text>
                    );
                  })}
                  <polygon
                    points={poly}
                    fill="color-mix(in srgb, var(--teal) 25%, transparent)"
                    stroke="var(--teal)"
                    strokeWidth="2"
                  />
                </svg>
                <ul className="w-full space-y-1.5 text-[13px]">
                  {report.radar.map((r) => (
                    <li key={r.subject} className="flex justify-between gap-2">
                      <span>{SUBJECT_LABELS[r.subject]}</span>
                      <span className="tabular-nums text-[var(--teal)]">
                        {r.value}%
                      </span>
                    </li>
                  ))}
                  {!report.radar.length ? (
                    <li className="text-[var(--ink-muted)]">No subjects yet</li>
                  ) : null}
                </ul>
              </div>
            </section>

            {/* Trend */}
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--teal)]">
                Mastery trend (30 days)
              </h2>
              <svg
                viewBox="0 0 300 90"
                className="mt-3 h-28 w-full"
                role="img"
                aria-label="30-day mastery trend"
              >
                <polyline
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth="2.5"
                  points={report.trend30
                    .map((p, i) => {
                      const x =
                        (i / Math.max(1, report.trend30.length - 1)) * 290 + 5;
                      const y = 78 - (p.avgMastery / 100) * 62;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              </svg>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Average mastery of skills known by each day (approx.).
              </p>
            </section>
          </div>

          {/* Practiced this week bars */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--ink)]">
              Practiced this week
            </h2>
            <ul className="mt-3 space-y-3">
              {report.practicedBars.length ? (
                report.practicedBars.map((p) => (
                  <li key={p.id}>
                    <div className="flex justify-between text-[13px]">
                      <span className="truncate">{p.label}</span>
                      <span className="tabular-nums text-[var(--ink-muted)]">
                        {p.mastery}% · {p.hint}
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--mist)]">
                      <div
                        className="h-full rounded-full bg-[var(--teal)]/80"
                        style={{
                          width: `${Math.round((p.mastery / maxPractice) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-[var(--ink-muted)]">
                  No practice logged in the last 7 days.
                </li>
              )}
            </ul>
          </section>

          {/* Mistake patterns — industry: actionable error analysis */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-[var(--ink)]">
                  Mistake patterns
                </h2>
                <p className="text-[12px] text-[var(--ink-muted)]">
                  Sticky errors with severity and a concrete at-home move — not
                  just a count bar.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {report.patterns.length ? (
                report.patterns.map((p) => <PatternCard key={p.id} p={p} />)
              ) : (
                <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-[13px] text-[var(--ink-muted)] sm:col-span-2">
                  No tagged patterns yet. As Spark spots wrong patterns in chat,
                  they show up here with coaching tips.
                </p>
              )}
            </div>
          </section>

          {/* Focus + review */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--teal)]">
                Next focus
              </h2>
              <ul className="mt-2 space-y-1 text-[13px]">
                {report.focus.length ? (
                  report.focus.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-[var(--ink-muted)]">
                        {s.mastery}%
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-[var(--ink-muted)]">All clear for now</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--coral)]">
                SM-2 review due
              </h2>
              <ul className="mt-2 space-y-1 text-[13px]">
                {report.reviewDue.length ? (
                  report.reviewDue.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-[var(--coral)]">
                        {s.mastery}%
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-[var(--ink-muted)]">Nothing overdue</li>
                )}
              </ul>
            </div>
          </section>

          {/* Tools */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--ink-muted)]">
              Tools
            </h2>
            <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 text-[13px]">
              <input
                type="checkbox"
                checked={checkMode}
                onChange={(e) => {
                  const on = e.target.checked;
                  setCheckMode(on);
                  saveCheckMode(on);
                }}
                className="h-4 w-4 accent-[var(--teal)]"
              />
              Check answers in tutor chat (show full solutions)
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const payload = buildAccountLearningExport(accountId, memory);
                  if (payload) downloadAccountLearningExport(payload);
                }}
                className="min-h-11 rounded-xl border border-[var(--line)] px-4 text-[13px]"
              >
                Download learning JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  const html = buildLearningPortfolioHtml(report);
                  openLearningPortfolioPrint(html);
                }}
                className="min-h-11 rounded-xl border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 text-[13px] font-medium text-[var(--teal)]"
              >
                Print learning portfolio
              </button>
              <a
                href="/dashboard"
                className="min-h-11 rounded-xl border border-[var(--line)] px-4 text-[13px] leading-[2.75rem]"
              >
                Student dashboard
              </a>
              <a
                href="/privacy"
                className="min-h-11 rounded-xl px-4 text-[13px] leading-[2.75rem] text-[var(--ink-muted)] underline-offset-2 hover:underline"
              >
                Privacy
              </a>
            </div>
          </section>
        </main>
      )}

      {showPin ? (
        <PinGate
          forceCreate={!hasParentPin()}
          onUnlock={onUnlock}
          onCancel={() => setShowPin(false)}
        />
      ) : null}
    </div>
  );
}
