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
import {
  buildAccountLearningExport,
  downloadAccountLearningExport,
} from "@/lib/account-export";
import { stashPracticeKickoff } from "@/lib/idle-nudge";
import { buildParentWeeklyDigest } from "@/lib/parent-digest";
import { hasParentPin, PinGate } from "./PinGate";
import { getActiveAccount, loadAccounts } from "@/lib/student-profile";

export function LearningDashboard() {
  const [memory, setMemory] = useState<LearningMemory | null>(null);
  const [accountId, setAccountId] = useState("acct_ryan");
  const [parentUnlocked, setParentUnlocked] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const id = getActiveAccount(loadAccounts()).id;
    setAccountId(id);
    setMemory(loadLearningMemory(id));
    void hydrateLearningMemoryFromServer(id).then(setMemory);
  }, []);

  const model = useMemo(() => buildDashboardModel(memory), [memory]);
  const weekly = useMemo(() => buildParentWeeklyDigest(memory), [memory]);
  const pinSet = useMemo(() => hasParentPin(), [showPin, parentUnlocked]);

  const radarValues = model.radar.map((r) => r.value);
  const poly = radarPolygonPoints(radarValues.length ? radarValues : [0], 100, 100, 80);

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
            Account {accountId.replace(/^acct_/, "")} · {model.skillCount} skills tracked
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

          {/* Misconception heat */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--ink)]">
              Mistake patterns
            </h2>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              Practice opens chat with a guided check — not a separate error book.
            </p>
            <ul className="mt-3 space-y-2">
              {model.misconceptionHeat.length ? (
                model.misconceptionHeat.map((h) => {
                  const max = model.misconceptionHeat[0]?.count || 1;
                  const w = Math.max(8, Math.round((h.count / max) * 100));
                  return (
                    <li key={h.id}>
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="min-w-0 truncate">{h.label}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="tabular-nums text-[var(--ink-muted)]">
                            ×{h.count}
                          </span>
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
                              className="inline-flex min-h-11 items-center rounded-full border border-[var(--teal)]/45 bg-[var(--teal)]/12 px-3 text-[12px] font-semibold text-[var(--teal)]"
                            >
                              Practice
                            </a>
                          ) : null}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--mist)]">
                        <div
                          className="h-full rounded-full bg-[var(--coral)]/70"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="text-[13px] text-[var(--ink-muted)]">
                  No tagged patterns yet.
                </li>
              )}
            </ul>
          </section>

          {/* Parent weekly */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-[13px] font-semibold text-[var(--ink-muted)]">
              Parent view
            </h2>
            {!pinSet ? (
              <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
                Set a parent PIN via Code Agent to unlock the weekly digest here.
              </p>
            ) : !parentUnlocked ? (
              <button
                type="button"
                onClick={() => setShowPin(true)}
                className="mt-2 min-h-11 rounded-xl border border-[var(--line)] px-4 text-[13px]"
              >
                Unlock weekly digest
              </button>
            ) : (
              <div className="mt-2 space-y-3">
                <pre className="whitespace-pre-wrap rounded-xl bg-[var(--mist)] p-3 text-[12px] leading-relaxed text-[var(--ink)]">
                  {weekly.text}
                </pre>
                {weekly.idleDays != null && weekly.idleDays >= 3 ? (
                  <p className="text-[12px] text-[var(--coral)]">
                    Soft note: no skill activity for {weekly.idleDays} days — a
                    short warm-up helps more than catching up in one sitting.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const payload = buildAccountLearningExport(
                      accountId,
                      memory,
                    );
                    if (payload) downloadAccountLearningExport(payload);
                  }}
                  className="min-h-11 rounded-xl border border-[var(--line)] px-4 text-[13px] font-medium text-[var(--ink)]"
                >
                  Download learning JSON
                </button>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Active account only · see{" "}
                  <a
                    href="/privacy"
                    className="text-[var(--teal)] underline-offset-2 hover:underline"
                  >
                    privacy & data use
                  </a>
                  .
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {showPin ? (
        <PinGate
          onUnlock={() => {
            setParentUnlocked(true);
            setShowPin(false);
          }}
          onCancel={() => setShowPin(false)}
        />
      ) : null}
    </div>
  );
}
