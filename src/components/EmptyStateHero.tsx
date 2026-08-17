"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExploreTopic } from "@/lib/explore-catalog";
import { resolveFreeExploreTopic } from "@/lib/explore-catalog";
import type { PendingPracticeOffer } from "@/lib/session-practice";
import type { SessionOpener } from "@/lib/session-opener";
import type { DeepDiveOffer } from "@/lib/deep-dive-week";
import type { ConnectionOffer } from "@/lib/connection-card";
import type {
  LaunchpadAction,
  WeeklyLaunchpadView,
} from "@/lib/weekly-launchpad";
import {
  cycleHeroAction,
  noteHeroShown,
  pickHeroAction,
  type HeroCandidate,
  type HeroKind,
} from "@/lib/hero-action-rotation";

export type EmptyStateHeroProps = {
  accountId: string;
  practiceOffer?: PendingPracticeOffer | null;
  sessionOpener?: SessionOpener | null;
  exploreTopics?: ExploreTopic[];
  deepDiveOffer?: DeepDiveOffer | null;
  connectionOffer?: ConnectionOffer | null;
  adjacentOpener?: SessionOpener | null;
  weeklyLaunchpad?: WeeklyLaunchpadView | null;
  canChallenge?: boolean;
  onPractice?: () => void;
  onPracticeTomorrow?: () => void;
  onPracticeDismiss?: () => void;
  onOpenerTry?: () => void;
  onOpenerNext?: () => void;
  onChallenge?: () => void;
  onSnapHomework?: () => void;
  onExplore?: (topic: ExploreTopic) => void;
  onStartDeepDive?: () => void;
  onSkipDeepDive?: () => void;
  onShowConnection?: () => void;
  onDismissConnection?: () => void;
  onAdjacentTry?: () => void;
  onLaunchpadItem?: (action: LaunchpadAction) => void;
  /** P0-2 — flow continuity line below opener card */
  flowContinuityLine?: string | null;
  onDismissFlowContinuity?: () => void;
};

/** UX-V4 — single hero card + "Another suggestion" rotation. */
export function EmptyStateHero({
  accountId,
  practiceOffer,
  sessionOpener,
  exploreTopics,
  deepDiveOffer,
  connectionOffer,
  adjacentOpener,
  weeklyLaunchpad,
  canChallenge,
  onPractice,
  onPracticeTomorrow,
  onPracticeDismiss,
  onOpenerTry,
  onOpenerNext,
  onChallenge,
  onSnapHomework,
  onExplore,
  onStartDeepDive,
  onSkipDeepDive,
  onShowConnection,
  onDismissConnection,
  onAdjacentTry,
  onLaunchpadItem,
  flowContinuityLine,
  onDismissFlowContinuity,
}: EmptyStateHeroProps) {
  const [heroOverride, setHeroOverride] = useState<HeroKind | null>(null);
  const [freeExploreText, setFreeExploreText] = useState("");

  const candidates = useMemo(() => {
    const list: HeroCandidate[] = [];
    if (deepDiveOffer) list.push({ kind: "deepDive" });
    if (practiceOffer && practiceOffer.targets.length > 0) {
      list.push({ kind: "practice" });
    }
    if (
      weeklyLaunchpad &&
      weeklyLaunchpad.doneCount < weeklyLaunchpad.totalCount
    ) {
      list.push({ kind: "launchpad" });
    }
    if (sessionOpener?.kind === "challenge" || sessionOpener?.highMasteryMode) {
      list.push({ kind: "challenge" });
    } else if (sessionOpener) {
      list.push({ kind: "opener" });
    }
    if (exploreTopics && exploreTopics.length > 0) {
      list.push({ kind: "explore" });
    }
    if (connectionOffer) list.push({ kind: "connection" });
    if (
      adjacentOpener &&
      (!sessionOpener || sessionOpener.highMasteryMode)
    ) {
      list.push({ kind: "adjacent" });
    }
    return list;
  }, [
    deepDiveOffer,
    practiceOffer,
    weeklyLaunchpad,
    sessionOpener,
    exploreTopics,
    connectionOffer,
    adjacentOpener,
  ]);

  const hero = useMemo(
    () =>
      pickHeroAction(candidates, accountId, {
        preferKind: heroOverride,
      }),
    [candidates, accountId, heroOverride],
  );

  useEffect(() => {
    if (hero) noteHeroShown(accountId, hero.kind);
  }, [accountId, hero]);

  const openerEyebrow =
    sessionOpener?.kind === "return"
      ? "Welcome back"
      : sessionOpener?.kind === "challenge"
        ? "Mastered a lot — stretch it"
        : sessionOpener?.kind === "practice"
          ? "From learning map"
          : sessionOpener
            ? "Today's warm-up"
            : null;

  const submitFreeExplore = () => {
    const topic = resolveFreeExploreTopic(freeExploreText);
    if (!topic || !onExplore) return;
    setFreeExploreText("");
    onExplore(topic);
  };

  if (!hero) return null;

  const kind = hero.kind;

  return (
    <div className="mt-3 w-full max-w-md text-left">
      {kind === "deepDive" && deepDiveOffer ? (
        <div className="rounded-2xl border-2 border-[var(--coral)]/45 bg-[var(--surface-muted)] px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--coral)]">
            Weekly deep project
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            Go deep on “{deepDiveOffer.topicLabel}” — 5 steps, one big idea.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onStartDeepDive}
              className="min-h-11 rounded-xl bg-[var(--coral)]/90 px-3 text-sm font-medium text-white"
            >
              Start deep dive
            </button>
            <button
              type="button"
              onClick={onSkipDeepDive}
              className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--ink-muted)]"
            >
              Not this week
            </button>
          </div>
        </div>
      ) : null}

      {kind === "practice" && practiceOffer ? (
        <div className="rounded-2xl border-2 border-[var(--teal)]/50 bg-[var(--surface-muted)] px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Practice offer
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            Practice 3 quick ones?
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {practiceOffer.targets.map((t) => t.label).join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPractice}
              className="min-h-11 rounded-xl bg-[var(--action-bg)] px-3 text-sm font-medium text-[var(--action-ink)]"
            >
              Let&apos;s practice
            </button>
            <button
              type="button"
              onClick={onPracticeTomorrow}
              className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--ink)]"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={onPracticeDismiss}
              className="min-h-11 rounded-xl px-3 text-sm text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {kind === "launchpad" && weeklyLaunchpad ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              This week
            </p>
            <p className="text-[11px] tabular-nums text-[var(--ink-muted)]">
              {weeklyLaunchpad.doneCount}/{weeklyLaunchpad.totalCount} done
            </p>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {weeklyLaunchpad.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onLaunchpadItem?.(item.action)}
                title={item.line}
                className={`flex min-h-14 flex-col items-start justify-between gap-1 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
                  item.done
                    ? "border-[var(--teal)]/30 bg-[var(--teal)]/6"
                    : "border-[var(--line)] bg-[var(--bg0)] hover:border-[var(--teal)]/45"
                }`}
              >
                <span className="flex w-full items-center justify-between text-[13px] leading-none">
                  <span aria-hidden>{item.emoji}</span>
                  <span
                    className={`text-[10px] font-semibold ${
                      item.done ? "text-[var(--teal)]" : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {item.done ? "✓" : "·"}
                  </span>
                </span>
                <span className="text-[11px] font-medium leading-tight text-[var(--ink)]">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(kind === "opener" || kind === "challenge") && sessionOpener ? (
        <div className="rounded-2xl border-2 border-[var(--teal)]/55 bg-[var(--surface-muted)] px-4 py-3 shadow-sm">
          {openerEyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              {openerEyebrow}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {sessionOpener.line}
          </p>
          {sessionOpener.challengeLine ? (
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--ink-muted)]">
              {sessionOpener.challengeLine}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenerTry}
              className="min-h-11 w-full rounded-xl bg-[var(--action-bg)] px-3 text-sm font-medium text-[var(--action-ink)]"
            >
              {sessionOpener.kind === "challenge" || kind === "challenge"
                ? "Go harder"
                : "Quick questions"}
            </button>
            <div className="flex flex-wrap gap-2">
              {onChallenge && canChallenge && sessionOpener.kind !== "challenge" ? (
                <button
                  type="button"
                  onClick={onChallenge}
                  className="min-h-11 flex-1 rounded-xl border border-[var(--teal)]/55 bg-[var(--teal)]/10 px-3 text-sm font-medium text-[var(--teal)]"
                >
                  Challenge me!
                </button>
              ) : null}
              {onOpenerNext &&
              sessionOpener.practiceTargets &&
              sessionOpener.practiceTargets.length > 0 ? (
                <button
                  type="button"
                  onClick={onOpenerNext}
                  className="min-h-11 flex-1 rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--ink)]"
                >
                  Another topic
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {flowContinuityLine &&
      (kind === "opener" || kind === "challenge") &&
      sessionOpener ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-xl border border-[var(--teal)]/35 bg-[var(--teal)]/6 px-3 py-2 text-[12px] text-[var(--ink)]">
          <p className="leading-snug">{flowContinuityLine}</p>
          <button
            type="button"
            onClick={onDismissFlowContinuity}
            className="shrink-0 text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {kind === "explore" && exploreTopics && exploreTopics.length > 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Today, I want to explore…
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Pick a spark — or type your own.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {exploreTopics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onExplore?.(t)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/8 px-3 text-[12px] font-medium text-[var(--ink)] transition hover:border-[var(--teal)]/60 hover:bg-[var(--teal)]/15"
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitFreeExplore();
            }}
          >
            <input
              type="text"
              value={freeExploreText}
              onChange={(e) => setFreeExploreText(e.target.value)}
              placeholder="Formula One, World Cup…"
              className="min-h-11 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg0)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--teal)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
              maxLength={64}
              aria-label="Free explore topic"
            />
            <button
              type="submit"
              disabled={freeExploreText.trim().length < 2}
              className="min-h-11 shrink-0 rounded-xl bg-[var(--teal)] px-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Go
            </button>
          </form>
        </div>
      ) : null}

      {kind === "connection" && connectionOffer ? (
        <div className="rounded-2xl border border-[var(--teal)]/55 bg-[var(--surface-muted)] px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Connection of the week
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {connectionOffer.card.title}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {connectionOffer.card.blurb}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onShowConnection}
              className="min-h-11 rounded-xl border border-[var(--teal)]/55 bg-[var(--teal)]/10 px-3 text-sm font-medium text-[var(--teal)]"
            >
              Show me the link
            </button>
            <button
              type="button"
              onClick={onDismissConnection}
              className="min-h-11 rounded-xl px-3 text-sm text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              Later
            </button>
          </div>
        </div>
      ) : null}

      {kind === "adjacent" && adjacentOpener ? (
        <div className="rounded-2xl border border-[var(--teal)]/45 bg-[var(--teal)]/6 px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            A neighbor to explore
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {adjacentOpener.line}
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={onAdjacentTry}
              className="min-h-11 rounded-xl border border-[var(--teal)]/55 bg-[var(--teal)]/10 px-3 text-sm font-medium text-[var(--teal)]"
            >
              Peek at {adjacentOpener.label}
            </button>
          </div>
        </div>
      ) : null}

      {candidates.length > 1 ? (
        <button
          type="button"
          onClick={() => {
            const next = cycleHeroAction(candidates, kind);
            if (next) setHeroOverride(next.kind);
          }}
          className="mt-2 w-full min-h-10 text-center text-[12px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline"
        >
          Another suggestion
        </button>
      ) : null}
    </div>
  );
}
