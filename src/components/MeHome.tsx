"use client";

import { useEffect, useMemo, useState } from "react";
import { loadConversations } from "@/lib/storage";
import { journalPromptForGrade } from "@/lib/entertain/journal-model";
import { useActiveStudioAccount } from "./StudioAccountBar";
import { JournalTimeline } from "./JournalTimeline";
import { SkillDots } from "./SkillDots";
import { WrongAnswerBook } from "./WrongAnswerBook";
import { WeeklyGoalCard } from "./WeeklyGoalCard";
import { ReadAlongPractice } from "./ReadAlongPractice";
import { InterestRadar } from "./InterestRadar";
import { DirectionCard } from "./DirectionCard";
import {
  focusSessionsThisWeek,
  recentFocusRecords,
} from "@/lib/focus-session";
import type { CreationItem } from "@/lib/entertain/creations-store";
import type { JournalEntry } from "@/lib/entertain/journal-model";

export function MeHome() {
  const acct = useActiveStudioAccount();
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [praiseReceived, setPraiseReceived] = useState(0);
  const chats = useMemo(
    () =>
      loadConversations(acct.accountId)
        .conversations.slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 3),
    [acct.accountId],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/creations?accountId=${encodeURIComponent(acct.accountId)}`,
    )
      .then((r) => r.json())
      .then((data: { items?: CreationItem[] }) => {
        if (!cancelled) setCreations((data.items || []).slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setCreations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [acct.accountId]);

  // V3 — light up the works wall: count encouragement received on this
  // account's journal entries (seen from the Everyone wall).
  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/journal?accountId=${encodeURIComponent(acct.accountId)}`,
    )
      .then((r) => r.json())
      .then((data: { items?: JournalEntry[] }) => {
        if (cancelled) return;
        const total = (data.items || []).reduce(
          (sum, e) => sum + (e.praise?.count ?? 0),
          0,
        );
        setPraiseReceived(total);
      })
      .catch(() => {
        if (!cancelled) setPraiseReceived(0);
      });
    return () => {
      cancelled = true;
    };
  }, [acct.accountId]);

  const prompt = journalPromptForGrade(acct.grade);

  const focusWeek = focusSessionsThisWeek(acct.accountId);
  const focusLatest = recentFocusRecords(acct.accountId, 1)[0];

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 py-6 text-[var(--ink)]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Me
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            {acct.name}
            {acct.grade ? (
              <span className="ml-2 text-lg font-normal text-[var(--ink-muted)]">
                G{acct.grade}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{prompt}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/account"
            className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-[13px] font-medium leading-[2.75rem]"
          >
            Account
          </a>
          <a
            href="/"
            className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-[13px] font-medium leading-[2.75rem]"
          >
            Chat
          </a>
        </div>
      </header>

      <section className="mb-6">
        <JournalTimeline peek />
      </section>

      {/* P2-3 — quarterly direction report: dynamic self-description card */}
      <section className="mb-6">
        <DirectionCard
          accountId={acct.accountId}
          name={acct.name}
          creations={creations}
        />
      </section>

      {praiseReceived > 0 ? (
        <section className="mb-6">
          <a
            href="/me/journal?view=everyone"
            className="flex items-center justify-between rounded-2xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-4 py-3 text-sm"
          >
            <span className="font-medium text-[var(--ink)]">
              You&apos;ve received {praiseReceived}{" "}
              {praiseReceived === 1 ? "encouragement" : "encouragements"} on the
              wall
            </span>
            <span className="text-[var(--ink-muted)]">→</span>
          </a>
        </section>
      ) : null}

      <section className="mb-6">
        <WeeklyGoalCard accountId={acct.accountId} />
      </section>

      {focusWeek > 0 || focusLatest ? (
        <section className="mb-6 rounded-2xl border border-[var(--teal)]/30 bg-[var(--teal)]/6 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Focus
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {focusWeek > 0
              ? `${focusWeek} focus session${focusWeek === 1 ? "" : "s"} this week`
              : "You tried a focus session"}
          </p>
          {focusLatest ? (
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Last: {Math.max(1, Math.round(focusLatest.durationMs / 60_000))} min
              {focusLatest.completed ? " · completed" : " · early end"}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mb-6">
        <SkillDots accountId={acct.accountId} />
      </section>

      <section className="mb-6">
        <InterestRadar accountId={acct.accountId} />
      </section>

      <section className="mb-6">
        <WrongAnswerBook accountId={acct.accountId} />
      </section>

      <section className="mb-6">
        <ReadAlongPractice />
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Made
          </p>
          <a
            href="/studio?game=creations"
            className="text-[12px] font-semibold text-[var(--teal)]"
          >
            My Creations
          </a>
        </div>
        {creations.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No creations yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {creations.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5"
              >
                <p className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                  {c.type.replace("_", " ")}
                </p>
                <p className="truncate text-sm font-medium">{c.title}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Chats
          </p>
          <a href="/" className="text-[12px] font-semibold text-[var(--teal)]">
            All chats
          </a>
        </div>
        {chats.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No chats on this device yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {chats.map((c) => (
              <li key={c.sessionId}>
                <a
                  href={`/?session=${encodeURIComponent(c.sessionId)}`}
                  className="block rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  {c.title || "Untitled chat"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <a
          href="/dashboard"
          className="flex min-h-12 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium"
        >
          Progress
          <span className="text-[var(--ink-muted)]">→</span>
        </a>
      </section>
    </div>
  );
}
