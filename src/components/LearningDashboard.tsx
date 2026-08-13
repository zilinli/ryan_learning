"use client";

import { useEffect, useMemo, useState } from "react";
import {
  hydrateLearningMemoryFromServer,
  loadLearningMemory,
  type LearningMemory,
} from "@/lib/learning-memory";
import {
  buildDashboardModel,
  radarPolygonPoints,
  SUBJECT_LABELS,
  type SubjectKey,
} from "@/lib/dashboard-stats";
import { stashPracticeKickoff } from "@/lib/idle-nudge";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";
import { buildMistakePatterns } from "@/lib/family-report";
import {
  buildBreadthFootprint,
  stashSubjectStarter,
  type SubjectFootprint,
} from "@/lib/breadth-map";
import { recentInterests } from "@/lib/interest-store";

export function LearningDashboard() {
  const [memory, setMemory] = useState<LearningMemory | null>(null);
  const [accountLabel, setAccountLabel] = useState("student");
  const [accountId, setAccountId] = useState("default");

  useEffect(() => {
    const id = getActiveAccount(loadAccounts()).id;
    setAccountId(id);
    setAccountLabel(id.replace(/^acct_/, ""));
    setMemory(loadLearningMemory(id));
    void hydrateLearningMemoryFromServer(id).then(setMemory);
  }, []);

  const model = useMemo(() => buildDashboardModel(memory), [memory]);
  const patterns = useMemo(
    () => (memory ? buildMistakePatterns(memory, 6) : []),
    [memory],
  );
  const footprint = useMemo(
    () => buildBreadthFootprint(memory, accountId),
    [memory, accountId],
  );
  const interests = useMemo(
    () => recentInterests(accountId, 5),
    [accountId],
  );

  const radarValues = model.radar.map((r) => r.value);
  const poly = radarPolygonPoints(radarValues.length ? radarValues : [0], 100, 100, 80);

  const trySubject = (f: SubjectFootprint) => {
    stashSubjectStarter(f);
    window.location.href = "/";
  };

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-6 text-[var(--ink)]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Learning
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            Your progress
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
            Account {accountLabel} · {model.skillCount} skills tracked
          </p>
        </div>
        <a
          href="/"
          className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-[13px] font-medium leading-[2.75rem] text-[var(--ink)]"
        >
          Back to tutor
        </a>
      </header>

      {!model.skillCount ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-[14px] text-[var(--ink-muted)]">
          Chat with Spark a few times — skills will show up here.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Student: radar */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--teal)]">
              Subject radar
            </h2>
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <svg viewBox="0 0 200 200" className="h-48 w-48 shrink-0" aria-hidden>
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
                {model.radar.map((r, i) => {
                  const n = model.radar.length || 1;
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
              <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
                {model.radar.map((r) => (
                  <li key={r.subject} className="flex justify-between gap-2">
                    <span>{SUBJECT_LABELS[r.subject as SubjectKey]}</span>
                    <span className="tabular-nums text-[var(--teal)]">
                      {r.value}% · {r.skillCount} skills
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ZPD + review */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--teal)]">
                Warm-ups (ZPD)
              </h2>
              <ul className="mt-2 space-y-1 text-[13px]">
                {model.zpd.length ? (
                  model.zpd.map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <span className="truncate">{s.label}</span>
                      <span className="tabular-nums text-[var(--ink-muted)]">
                        {s.mastery}%
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-[var(--ink-muted)]">Keep chatting to unlock.</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--coral)]">
                Focus · SM-2 due
              </h2>
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                Tap Practice to open a short warm-up in chat.
              </p>
              <ul className="mt-2 space-y-2 text-[13px]">
                {(model.weak.length ? model.weak : model.reviewDue).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-[var(--coral)]">
                        {s.mastery}%
                      </span>
                      <a
                        href="/"
                        onClick={() =>
                          stashPracticeKickoff({
                            skillId: s.id,
                            label: s.label,
                            source: "dashboard-weak",
                          })
                        }
                        className="inline-flex min-h-11 items-center rounded-full border border-[var(--teal)]/45 bg-[var(--teal)]/12 px-3 text-[12px] font-semibold text-[var(--teal)]"
                      >
                        Practice
                      </a>
                    </span>
                  </li>
                ))}
                {!model.weak.length && !model.reviewDue.length ? (
                  <li className="text-[var(--ink-muted)]">Nothing overdue — nice.</li>
                ) : null}
              </ul>
            </div>
          </section>

          {/* 30-day trend sparkline */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--teal)]">
              Mastery trend (30 days)
            </h2>
            <svg
              viewBox="0 0 300 80"
              className="mt-3 h-24 w-full"
              role="img"
              aria-label="Mastery trend over 30 days"
            >
              <polyline
                fill="none"
                stroke="var(--teal)"
                strokeWidth="2"
                points={model.trend30
                  .map((p, i) => {
                    const x = (i / Math.max(1, model.trend30.length - 1)) * 290 + 5;
                    const y = 70 - (p.avgMastery / 100) * 60;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            </svg>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Average mastery of skills known by each day (approx.).
            </p>
          </section>

          {/* Mistake patterns — severity + practice CTA (full parent coaching on /family) */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--ink)]">
              Mistake patterns
            </h2>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              Sticky spots Spark noticed — tap Practice for a gentle check. Parents see
              at-home tips on{" "}
              <a href="/family" className="text-[var(--teal)] underline-offset-2 hover:underline">
                Family
              </a>
              .
            </p>
            <ul className="mt-3 space-y-3">
              {patterns.length ? (
                patterns.map((h) => {
                  const max = patterns[0]?.count || 1;
                  const w = Math.max(12, Math.round((h.count / max) * 100));
                  return (
                    <li
                      key={h.id}
                      className="rounded-xl border border-[var(--line)]/60 bg-[var(--surface)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[var(--ink)]">
                            {h.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                            {h.skillLabel || "Skill"} · ×{h.count}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            h.severity === "persistent"
                              ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                              : h.severity === "recurring"
                                ? "bg-[var(--mist)] text-[var(--ink)]"
                                : "bg-[var(--mist)] text-[var(--ink-muted)]"
                          }`}
                        >
                          {h.severity}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mist)]">
                        <div
                          className="h-full rounded-full bg-[var(--coral)]/70"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                      {h.skillId && h.skillLabel ? (
                        <a
                          href="/"
                          onClick={() =>
                            stashPracticeKickoff({
                              skillId: h.skillId!,
                              label: h.skillLabel!,
                              source: "dashboard-misconception",
                            })
                          }
                          className="mt-2 inline-flex min-h-10 items-center rounded-full border border-[var(--teal)]/45 bg-[var(--teal)]/12 px-3 text-[12px] font-semibold text-[var(--teal)]"
                        >
                          Practice this
                        </a>
                      ) : null}
                    </li>
                  );
                })
              ) : (
                <li className="text-[13px] text-[var(--ink-muted)]">
                  No tagged patterns yet — keep chatting with Spark.
                </li>
              )}
            </ul>
          </section>

          {/* P1 — subject breadth footprint (report §9.4.2) */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--teal)]">
              Your subject map
            </h2>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              Where you've been — and one door into a subject you haven't tried.
            </p>
            <ul className="mt-3 space-y-2">
              {footprint.map((f) => (
                <li key={f.subject} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[13px]">
                    <span aria-hidden>{f.emoji}</span>
                    <span className="truncate">{f.label}</span>
                    {f.skillCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-[var(--teal)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--teal)]">
                        {f.skillCount} skill{f.skillCount > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </span>
                  {f.explored ? (
                    <span className="shrink-0 rounded-full bg-[var(--teal)]/12 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--teal)]">
                      Explored
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => trySubject(f)}
                      className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-3 text-[11px] font-semibold text-[var(--coral)] transition hover:bg-[var(--coral)]/20"
                    >
                      Try it
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* P0 — exploration footprint (report §9.1.3) */}
          {interests.length > 0 ? (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <h2 className="text-[13px] font-semibold text-[var(--teal)]">
                Your exploration footprint
              </h2>
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                Topics you chose to explore — it grows every time you pick one.
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {interests.map((i) => (
                  <li
                    key={i.topicId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--ink)]"
                  >
                    <span aria-hidden>{i.emoji}</span>
                    {i.label}
                    {i.count > 1 ? (
                      <span className="text-[10px] text-[var(--ink-muted)]">×{i.count}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
