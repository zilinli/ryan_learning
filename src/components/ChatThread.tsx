"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage, ConversationWorksheetPlan } from "@/lib/types";
import { isVideoAttachment, isLargeBinaryAttachment } from "@/lib/attachments";
import { getPhotoFromVault } from "@/lib/photo-vault";
import {
  formatProgressLabelOrDone,
  isWorksheetComplete,
  stripWorksheetPlanFence,
} from "@/lib/worksheet-planner";
import { stripScratchDiagnosisFence } from "@/lib/scratch-diagnosis";
import { stripMisconceptionFence } from "@/lib/misconceptions";
import { parseSparkFence, stripSparkFence } from "@/lib/spark-moment";
import { collapseDiagramsInMessages } from "@/lib/diagram-lifecycle";
import type { PendingPracticeOffer } from "@/lib/session-practice";
import type { SessionOpener } from "@/lib/session-opener";
import type { ExploreTopic } from "@/lib/explore-catalog";
import type { DeepDiveOffer } from "@/lib/deep-dive-week";
import type { ConnectionOffer } from "@/lib/connection-card";
import type { ProactiveInvite } from "@/lib/proactive-nudge";
import type {
  LaunchpadAction,
  WeeklyLaunchpadView,
} from "@/lib/weekly-launchpad";
import type { CreationOffer } from "@/lib/creation-offer";
import { stripIntentFence } from "@/lib/intent-fence";
import { InlineWritingPanel } from "./tutor/InlineWritingPanel";
import { InlineMediaPanel } from "./tutor/InlineMediaPanel";
import { InlineGamePanel } from "./tutor/InlineGamePanel";
import { LabRecommendCard } from "./tutor/LabRecommendCard";
import { GameRecommendCard } from "./tutor/GameRecommendCard";
import { InlineCodingCard } from "./tutor/InlineCodingCard";
import type { CodeConcept, CodingResultNote } from "@/lib/entertain/code-spark";
import type { CollabOffer } from "./tutor/useTutorSession";
import {
  buildDeepDivePrompt,
  DEEP_DIVE_LABELS,
  type DeepDiveMode,
} from "@/lib/prompts";
import { EmptyStateHero } from "./EmptyStateHero";
import { MarkdownMessage } from "./MarkdownMessage";
import { ImageLightbox } from "./ImageLightbox";
import { VideoAttachment } from "./VideoAttachment";

function stripHiddenFences(content: string): string {
  return stripSparkFence(
    stripMisconceptionFence(
      stripScratchDiagnosisFence(
        stripIntentFence(stripWorksheetPlanFence(content)),
      ),
    ),
  );
}

type BubbleTranslation = {
  status: "loading" | "ready" | "error";
  text?: string;
  alreadyEnglish?: boolean;
  error?: string;
  /** Ready but panel collapsed (button toggles) */
  hidden?: boolean;
};

type Props = {
  messages: ChatMessage[];
  streaming?: boolean;
  worksheetPlan?: ConversationWorksheetPlan | null;
  practiceOffer?: PendingPracticeOffer | null;
  sessionOpener?: SessionOpener | null;
  onPractice?: () => void;
  onPracticeTomorrow?: () => void;
  onPracticeDismiss?: () => void;
  onOpenerTry?: () => void;
  /** P0 — cycle to the next practice target as the opener's main skill */
  onOpenerNext?: () => void;
  /** P1 — start an explicit challenge-mode session on a mastered skill */
  onChallenge?: () => void;
  /** P1 — show "Challenge me!" only when a mastered skill exists */
  canChallenge?: boolean;
  /** P1 — send a "go deeper" follow-up turn (换方法 / 边界 / 跨学科) */
  onDeepDive?: (mode: DeepDiveMode) => void;
  /** Snap homework — dismiss opener + open camera */
  onSnapHomework?: () => void;
  /** UX-RPT.10 — dismissible kid daily one-liner */
  dailyBlurb?: string | null;
  onDismissDailyBlurb?: () => void;
  /** Soft emotion line after a turn */
  emotionLine?: string | null;
  onDismissEmotionLine?: () => void;
  /** Focus timer break nudge */
  breakNudge?: { minutes: number; dismissed: boolean } | null;
  onDismissBreakNudge?: () => void;
  /** One-click replay for a finished message */
  onSpeakMessage?: (messageId: string, text: string) => void;
  /** Stop current replay / TTS */
  onStopSpeak?: () => void;
  /** Message id currently being spoken (for button state) */
  speakingMessageId?: string | null;
  /** Quote an earlier message to reply with focused context */
  onQuote?: (message: ChatMessage) => void;
  /** P0 — interest-led exploration ("今天想探索什么") chips in the empty state */
  exploreTopics?: ExploreTopic[];
  onExplore?: (topic: ExploreTopic) => void;
  /** P1 — weekly deep-dive project (5E) */
  deepDiveOffer?: DeepDiveOffer | null;
  onStartDeepDive?: () => void;
  onSkipDeepDive?: () => void;
  /** P1 — weekly cross-subject connection card */
  connectionOffer?: ConnectionOffer | null;
  onShowConnection?: () => void;
  onDismissConnection?: () => void;
  /** P0 — live challenge mastery gauge (while a challenge session is active) */
  challengeGauge?: {
    level: number;
    levelLabel: string;
    streak: number;
    progress: number;
    toNext: number | null;
    growthLine?: string | null;
  } | null;
  /** P2 — cross-domain auto-recommendation: a neighbor skill worth peeking at */
  adjacentOpener?: SessionOpener | null;
  onAdjacentTry?: () => void;
  /** V2 P0 — proactive review invite (report §9.2.2) */
  proactiveInvite?: ProactiveInvite | null;
  onAcceptProactiveInvite?: () => void;
  onDismissProactiveInvite?: () => void;
  /** V2 P0 — growth-moment line from the flow signal (report §9.2.1) */
  flowMoment?: string | null;
  onDismissFlowMoment?: () => void;
  /** P0-2 — cross-session flow continuity under opener (empty state) */
  flowContinuityLine?: string | null;
  onDismissFlowContinuity?: () => void;
  /** P0-3 — explain-your-thinking bar before grading */
  explainBar?: { text: string } | null;
  onSkipExplain?: () => void;
  /** V2 P1 — weekly "This week" Launchpad strip (report §9.3.2) */
  weeklyLaunchpad?: WeeklyLaunchpadView | null;
  onLaunchpadItem?: (action: LaunchpadAction) => void;
  /** V2 P1 — interest → creation offer (report §9.1.3) */
  creationOffer?: CreationOffer | null;
  creationOfferLine?: string | null;
  onDismissCreationOffer?: () => void;
  /** V3 — child tapped into Studio/Journal from the creation card (attribution). */
  onAcceptCreationOffer?: () => void;
  /** Collab hub — assistant flagged an inline writing/media/game/lab intent. */
  collabOffer?: CollabOffer | null;
  onDismissCollab?: () => void;
  /** Collab hub — coding micro-challenge result → feed back into next turn. */
  onCodingResult?: (note: CodingResultNote) => void;
  /** UX-V4 — account id for hero-action freshness rotation */
  accountId?: string;
  /** UX-V4 — Focus Mode controls */
  focusActive?: boolean;
  focusProgress?: number;
  focusRemainingLabel?: string | null;
  focusSummary?: string | null;
  onStartFocus?: () => void;
  onEndFocus?: () => void;
  onDismissFocusSummary?: () => void;
};

function formatTime(epochMs: number): string {
  if (!epochMs) return "";
  const d = new Date(epochMs);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${m}/${dd} ${hh}:${mm}`;
}

function messageAttachments(m: ChatMessage): ChatAttachment[] {
  if (m.attachments?.length) return m.attachments;
  if (m.image?.dataUrl) {
    return [
      {
        id: `${m.id}-img`,
        name: "photo",
        mimeType: m.image.mimeType,
        kind: "image",
        dataUrl: m.image.dataUrl,
      },
    ];
  }
  return [];
}

/**
 * Resolve the thumbnail shown inside a quote card. Prefers the inline
 * thumbnail from the quote itself; after a refresh the persisted quote has no
 * base64 payload, so fall back to the first image on the original message.
 */
function quoteThumb(m: ChatMessage, messages: ChatMessage[]): string | null {
  if (m.quote?.thumbnail) return m.quote.thumbnail;
  if (!m.quote) return null;
  const src = messages.find((x) => x.id === m.quote?.messageId);
  if (!src) return null;
  const img = messageAttachments(src).find((a) => a.kind === "image");
  return img?.dataUrl || null;
}

/** Prefer local dataUrl; then vault; then server media (after vault miss). */
function attachmentHref(
  a: ChatAttachment,
  vaultSrc?: string | null,
  opts?: { download?: boolean; vaultChecked?: boolean },
): string | null {
  if (a.dataUrl) return a.dataUrl;
  if (vaultSrc) return vaultSrc;
  // Wait for vault before hitting /api/media — data/media may be empty while
  // IndexedDB still has the homework photo (avoids a broken <img> flash).
  if (a.mediaId && opts?.vaultChecked) {
    const q = opts?.download ? "?download=1" : "";
    return `/api/media/${encodeURIComponent(a.mediaId)}${q}`;
  }
  return null;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || "download";
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ChatThread({
  messages,
  streaming,
  worksheetPlan,
  practiceOffer,
  sessionOpener,
  onPractice,
  onPracticeTomorrow,
  onPracticeDismiss,
  onOpenerTry,
  onOpenerNext,
  onChallenge,
  canChallenge,
  onDeepDive,
  onSnapHomework,
  dailyBlurb,
  onDismissDailyBlurb,
  emotionLine,
  onDismissEmotionLine,
  onSpeakMessage,
  onStopSpeak,
  speakingMessageId,
  breakNudge,
  onDismissBreakNudge,
  onQuote,
  exploreTopics,
  onExplore,
  deepDiveOffer,
  onStartDeepDive,
  onSkipDeepDive,
  connectionOffer,
  onShowConnection,
  onDismissConnection,
  challengeGauge,
  adjacentOpener,
  onAdjacentTry,
  proactiveInvite,
  onAcceptProactiveInvite,
  onDismissProactiveInvite,
  flowMoment,
  onDismissFlowMoment,
  flowContinuityLine,
  onDismissFlowContinuity,
  explainBar,
  onSkipExplain,
  weeklyLaunchpad,
  onLaunchpadItem,
  creationOffer,
  creationOfferLine,
  onDismissCreationOffer,
  onAcceptCreationOffer,
  collabOffer,
  onDismissCollab,
  onCodingResult,
  accountId = "default",
  focusActive,
  focusProgress = 0,
  focusRemainingLabel,
  focusSummary,
  onStartFocus,
  onEndFocus,
  onDismissFocusSummary,
}: Props) {
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [vaultMap, setVaultMap] = useState<Record<string, string>>({});
  const [vaultChecked, setVaultChecked] = useState<Record<string, true>>({});
  const [loadFailed, setLoadFailed] = useState<Record<string, true>>({});
  const [userScrolled, setUserScrolled] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [hideCompletePlan, setHideCompletePlan] = useState(false);
  const [translations, setTranslations] = useState<
    Record<string, BubbleTranslation>
  >({});
  const translateAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  /** messageId → DOM node, for quote tap-to-jump */
  const msgElsRef = useRef(new Map<string, HTMLElement>());
  /** messageId currently flashed after a quote jump */
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  /** WeChat-style: tap a quote → scroll to the original message + flash it. */
  const jumpToMessage = (messageId: string) => {
    const el = msgElsRef.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashId(null), 2000);
  };

  const translateToEnglish = async (messageId: string, raw: string) => {
    const existing = translations[messageId];
    if (existing?.status === "ready") {
      setTranslations((prev) => {
        const cur = prev[messageId];
        if (!cur || cur.status !== "ready") return prev;
        return { ...prev, [messageId]: { ...cur, hidden: !cur.hidden } };
      });
      return;
    }
    if (existing?.status === "loading") return;

    setTranslations((prev) => ({
      ...prev,
      [messageId]: { status: "loading" },
    }));
    try {
      translateAbortRef.current?.abort();
      const ac = new AbortController();
      translateAbortRef.current = ac;
      const res = await fetch("/api/translate-en", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw }),
        signal: ac.signal,
      });
      const data = (await res.json()) as {
        translation?: string;
        alreadyEnglish?: boolean;
        error?: string;
      };
      if (!res.ok || !data.translation) {
        throw new Error(data.error || `Translate failed (${res.status})`);
      }
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          status: "ready",
          text: data.translation,
          alreadyEnglish: Boolean(data.alreadyEnglish),
        },
      }));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          status: "error",
          error: err instanceof Error ? err.message : "Translation failed",
        },
      }));
    }
  };

  const planComplete = isWorksheetComplete(worksheetPlan);
  useEffect(() => {
    if (!planComplete) {
      setHideCompletePlan(false);
      return;
    }
    setPlanExpanded(false);
    const t = window.setTimeout(() => setHideCompletePlan(true), 3000);
    return () => window.clearTimeout(t);
  }, [planComplete, worksheetPlan?.updatedAt]);

  // Mark all current messages as seen so only genuinely new messages animate
  // in. Deferred to the next macrotask: React schedules the re-render after
  // commit anyway, and the rule forbids synchronous setState in an effect.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      setSeenIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const m of messages) {
          if (!next.has(m.id)) {
            next.add(m.id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [messages]);

  // Clear the quote-jump flash timer on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missing: string[] = [];
    const skipVault: string[] = [];
    for (const m of messages) {
      for (const a of messageAttachments(m)) {
        // Always try the vault when dataUrl is gone — mediaId alone can 404
        // if data/media was wiped, and vault still has the homework photo.
        if (a.dataUrl) continue;
        if (vaultMap[a.id] || vaultChecked[a.id]) continue;
        // Large binaries (video/PDF/Office) never rehydrate from the vault —
        // reading back a multi-MB base64 dataUrl is what crashed phones. Mark
        // them checked so the UI falls through to /api/media streaming/download.
        if (isLargeBinaryAttachment(a.mimeType, a.name)) {
          skipVault.push(a.id);
          continue;
        }
        missing.push(a.id);
      }
    }
    if (!missing.length && !skipVault.length) return;
    void (async () => {
      const next: Record<string, string> = {};
      const checked: Record<string, true> = {};
      for (const id of missing) {
        const hit = await getPhotoFromVault(id);
        if (hit?.dataUrl) next[id] = hit.dataUrl;
        checked[id] = true;
      }
      for (const id of skipVault) {
        checked[id] = true;
      }
      if (cancelled) return;
      if (Object.keys(next).length) {
        setVaultMap((prev) => ({ ...prev, ...next }));
      }
      setVaultChecked((prev) => ({ ...prev, ...checked }));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, vaultMap, vaultChecked]);

  // Auto-scroll to bottom when new messages arrive.
  // Throttled to one scroll per animation frame; instant during streaming to
  // avoid competing with the next delta update.
  useEffect(() => {
    let rafId: number | undefined;
    const scrollOnce = () => {
      if (!userScrolled && bottomRef.current) {
        bottomRef.current.scrollIntoView({
          behavior: streaming ? "instant" : "smooth",
        });
      }
    };
    rafId = requestAnimationFrame(() => {
      rafId = undefined;
      scrollOnce();
    });
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    };
  }, [messages, userScrolled, streaming]);

  // Detect manual scroll-up to disable auto-scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setUserScrolled(distFromBottom > 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    setUserScrolled(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center animate-fade-up">
        <div className="text-4xl">📚</div>
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)] sm:text-3xl">
          Ask anything about your homework...
        </p>
        <p className="max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
          Snap a photo, type a question, or use the mic. I&apos;ll guide you step by
          step — no spoilers.
        </p>
        <div className="w-full max-w-md rounded-2xl border border-[var(--teal)]/35 bg-[var(--teal)]/8 px-4 py-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            Voice tutoring
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Supported dialects">
            {["粤语", "客家话", "闽南话", "上海话", "EN / 普通话"].map((label) => (
              <li
                key={label}
                className="rounded-full border border-[var(--teal)]/40 bg-[var(--surface-muted)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink)]"
              >
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            Pick a voice in the sidebar — dialects stay on that account.
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onSnapHomework}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--action-bg)] px-4 text-sm font-medium text-[var(--action-ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
          >
            Snap homework
          </button>
          {!focusActive && onStartFocus ? (
            <button
              type="button"
              onClick={onStartFocus}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--teal)]/45 bg-[var(--teal)]/10 px-4 text-sm font-medium text-[var(--teal)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
            >
              Focus 20 min
            </button>
          ) : null}
        </div>
        {focusActive ? (
          <div className="w-full max-w-md rounded-2xl border border-[var(--teal)]/45 bg-[var(--teal)]/8 px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
                Focus mode
              </p>
              <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                {focusRemainingLabel ?? "…"}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mist)]">
              <div
                className="h-full rounded-full bg-[var(--teal)] transition-all duration-500"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, focusProgress)) * 100)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={onEndFocus}
              className="mt-2 min-h-10 text-[12px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              End focus early
            </button>
          </div>
        ) : null}
        {focusSummary ? (
          <div className="w-full max-w-md rounded-2xl border border-[var(--teal)]/35 bg-[var(--surface-muted)] px-4 py-3 text-left">
            <p className="text-sm text-[var(--ink)]">{focusSummary}</p>
            <button
              type="button"
              onClick={onDismissFocusSummary}
              className="mt-2 min-h-10 text-[12px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              OK
            </button>
          </div>
        ) : null}

        {dailyBlurb ? (
          <div className="mt-2 w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Today
            </p>
            <p className="mt-1 text-sm text-[var(--ink)]">{dailyBlurb}</p>
            <button
              type="button"
              onClick={onDismissDailyBlurb}
              className="mt-2 min-h-10 text-[12px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {breakNudge && !breakNudge.dismissed ? (
          <div className="mt-3 w-full max-w-md rounded-2xl border border-[var(--coral)]/40 bg-[var(--coral)]/8 px-4 py-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--coral)]">
              Focus check
            </p>
            <p className="mt-1 text-sm text-[var(--ink)]">
              You've been focused for about {breakNudge.minutes} minutes — want to take a short break?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDismissBreakNudge}
                className="min-h-11 rounded-xl border border-[var(--coral)]/40 px-3 text-sm font-medium text-[var(--coral)]"
              >
                Quick break (5 min)
              </button>
              <button
                type="button"
                onClick={onDismissBreakNudge}
                className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--ink-muted)]"
              >
                Keep going
              </button>
            </div>
          </div>
        ) : null}

        <EmptyStateHero
          accountId={accountId}
          practiceOffer={practiceOffer}
          sessionOpener={sessionOpener}
          exploreTopics={exploreTopics}
          deepDiveOffer={deepDiveOffer}
          connectionOffer={connectionOffer}
          adjacentOpener={adjacentOpener}
          weeklyLaunchpad={weeklyLaunchpad}
          canChallenge={canChallenge}
          onPractice={onPractice}
          onPracticeTomorrow={onPracticeTomorrow}
          onPracticeDismiss={onPracticeDismiss}
          onOpenerTry={onOpenerTry}
          onOpenerNext={onOpenerNext}
          onChallenge={onChallenge}
          onSnapHomework={onSnapHomework}
          onExplore={onExplore}
          onStartDeepDive={onStartDeepDive}
          onSkipDeepDive={onSkipDeepDive}
          onShowConnection={onShowConnection}
          onDismissConnection={onDismissConnection}
          onAdjacentTry={onAdjacentTry}
          onLaunchpadItem={onLaunchpadItem}
          flowContinuityLine={flowContinuityLine}
          onDismissFlowContinuity={onDismissFlowContinuity}
        />
      </div>
    );
  }

  const showPlanChip =
    !!worksheetPlan &&
    worksheetPlan.total > 0 &&
    !(planComplete && hideCompletePlan);

  const displayMessages = collapseDiagramsInMessages(messages);

  return (
    <div ref={containerRef} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {emotionLine ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-[var(--teal)]/25 bg-[var(--teal)]/8 px-3 py-2 text-[13px] text-[var(--ink)]">
          <p>{emotionLine}</p>
          <button
            type="button"
            onClick={onDismissEmotionLine}
            className="shrink-0 text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
          >
            OK
          </button>
        </div>
      ) : null}
      {flowMoment ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-3 py-2 text-[13px] text-[var(--ink)]">
          <p className="font-medium text-[var(--teal)]">{flowMoment}</p>
          <button
            type="button"
            onClick={onDismissFlowMoment}
            className="shrink-0 text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
          >
            OK
          </button>
        </div>
      ) : null}
      {explainBar ? (
        <div className="sticky top-0 z-[7] flex items-start justify-between gap-2 rounded-xl border border-[var(--coral)]/40 bg-[var(--coral)]/8 px-3 py-2 text-[13px] text-[var(--ink)]">
          <p>{explainBar.text}</p>
          <button
            type="button"
            onClick={onSkipExplain}
            className="shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] hover:border-[var(--coral)]/45 hover:text-[var(--coral)]"
          >
            Skip
          </button>
        </div>
      ) : null}
      {focusActive ? (
        <div className="sticky top-0 z-[6] -mx-1 flex justify-center">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--teal)]/45 bg-[var(--surface-muted)] px-3 py-2 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--teal)]">
                Focus · {focusRemainingLabel ?? "…"}
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--mist)]">
                <div
                  className="h-full rounded-full bg-[var(--teal)] transition-all duration-500"
                  style={{ width: `${Math.round(Math.min(1, Math.max(0, focusProgress)) * 100)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onEndFocus}
              className="shrink-0 text-[11px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              End
            </button>
          </div>
        </div>
      ) : null}
      {focusSummary && messages.length > 0 ? (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-[var(--teal)]/35 bg-[var(--teal)]/8 px-3 py-2 text-[13px] text-[var(--ink)]">
          <p>{focusSummary}</p>
          <button
            type="button"
            onClick={onDismissFocusSummary}
            className="shrink-0 text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
          >
            OK
          </button>
        </div>
      ) : null}
      {challengeGauge ? (
        <div
          className="sticky top-0 z-[5] -mx-1 flex justify-center"
          aria-live="polite"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--teal)]/45 bg-[var(--surface-muted)] px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="font-medium text-[var(--teal)]">
                Challenge · {challengeGauge.levelLabel}
              </p>
              <p className="tabular-nums text-[var(--ink-muted)]">
                {challengeGauge.toNext == null
                  ? "expert level"
                  : `${challengeGauge.toNext} to next level`}
              </p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--mist)]">
              <div
                className="h-full rounded-full bg-[var(--teal)] transition-all duration-500"
                style={{ width: `${Math.round(challengeGauge.progress * 100)}%` }}
              />
            </div>
            {challengeGauge.growthLine ? (
              <p className="mt-1.5 text-[11px] font-medium text-[var(--coral)]">
                {challengeGauge.growthLine}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {showPlanChip && worksheetPlan ? (
        <div
          className="sticky top-0 z-[5] -mx-1 mb-1 flex justify-center"
          aria-live="polite"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] shadow-sm">
            <button
              type="button"
              onClick={() => {
                if (!planComplete) setPlanExpanded((v) => !v);
              }}
              aria-expanded={planExpanded}
              disabled={planComplete}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs font-medium text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:cursor-default"
            >
              <span>{formatProgressLabelOrDone(worksheetPlan)}</span>
              {!planComplete ? (
                <span className="text-[10px] text-[var(--ink-muted)]" aria-hidden>
                  {planExpanded ? "▴" : "▾"}
                </span>
              ) : null}
            </button>
            {planExpanded && !planComplete ? (
              <ul className="max-h-[40vh] space-y-1 overflow-y-auto border-t border-[var(--line)]/60 px-3 py-2 text-xs text-[var(--ink)]">
                {worksheetPlan.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.status === "done"
                          ? "bg-[var(--teal)]"
                          : item.status === "active"
                            ? "bg-[var(--coral)]"
                            : item.status === "skipped"
                              ? "bg-[var(--ink-muted)]"
                              : "bg-[var(--line)]"
                      }`}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-[var(--ink-muted)]">
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
      {displayMessages.map((m) => {
        const attachments = messageAttachments(m);
        const isUser = m.role === "user";
        const displayContent = isUser
          ? m.content
          : stripHiddenFences(m.content);
        const spark = !isUser ? parseSparkFence(m.content) : null;
        const wasSeen = seenIds.has(m.id);
        const animateIn =
          !wasSeen &&
          displayContent.length < 120 &&
          !(m.role === "assistant" && displayContent.length > 0 && streaming);
        return (
          <article
            key={m.id}
            ref={(el) => {
              if (el) msgElsRef.current.set(m.id, el);
              else msgElsRef.current.delete(m.id);
            }}
            className={`flex flex-col gap-2 ${
              animateIn ? "animate-fade-up" : ""
            } ${flashId === m.id ? "quote-jump-flash" : ""} ${
              isUser ? "items-end" : "items-start"
            }`}
          >
            <span className="text-xs tracking-wide text-[var(--ink-muted)]">
              {isUser ? "You" : "The Answer Book · AI Tutor"}
              {m.createdAt ? (
                <span className="ml-2 text-[10px] opacity-60">
                  {formatTime(m.createdAt)}
                </span>
              ) : null}
            </span>
            <div
              className={`max-w-[94%] break-words sm:max-w-[88%] ${
                isUser
                  ? "rounded-2xl rounded-br-md bg-[var(--teal)] px-4 py-3 text-white"
                  : "rounded-2xl rounded-bl-md bg-[var(--surface-muted)] px-4 py-3 text-[var(--ink)] ring-1 ring-[var(--line)]"
              }`}
            >
              {m.quote ? (
                <button
                  type="button"
                  onClick={() => jumpToMessage(m.quote!.messageId)}
                  className={`mb-2 flex w-full items-center gap-2.5 rounded-lg border-l-[3px] px-2.5 py-1.5 text-left transition ${
                    isUser
                      ? "border-white/70 bg-white/10 hover:bg-white/15"
                      : "border-[var(--teal)]/70 bg-[var(--mist)] hover:brightness-[1.03]"
                  }`}
                  title="Tap to jump to the quoted message"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {m.quote.author === "user" ? "You" : "The Answer Book · AI Tutor"}
                    </p>
                    <p
                      className={`line-clamp-2 text-xs ${
                        isUser ? "text-white/90" : "text-[var(--ink-muted)]"
                      }`}
                    >
                      {m.quote.excerpt || "(attachment)"}
                    </p>
                  </div>
                  {quoteThumb(m, messages) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={quoteThumb(m, messages)!}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                      aria-hidden
                    />
                  ) : null}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 ${isUser ? "text-white/50" : "text-[var(--ink-muted)]"}`}
                    aria-hidden
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              ) : null}
              {attachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((a, idx) => {
                    if (a.kind === "image") {
                      const src = loadFailed[a.id]
                        ? null
                        : attachmentHref(a, vaultMap[a.id], {
                            vaultChecked: Boolean(vaultChecked[a.id]),
                          });
                      if (src) {
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className="group relative block overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                            onClick={() =>
                              setLightbox({
                                src,
                                alt: a.name || `Photo ${idx + 1}`,
                              })
                            }
                            aria-label={`View ${a.name || `photo ${idx + 1}`}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={a.name || `Photo ${idx + 1}`}
                              className={`max-h-44 max-w-[9rem] cursor-zoom-in object-contain transition group-hover:opacity-95 sm:max-w-[11rem] ${
                                isUser
                                  ? "border border-[var(--surface)]"
                                  : "border border-[var(--line)]"
                              } rounded-xl`}
                              draggable={false}
                              onError={() => {
                                // dataUrl/vault misses + empty data/media → 404;
                                // swap to unavailable chip instead of a broken <img>.
                                if (a.dataUrl || vaultMap[a.id]) return;
                                setLoadFailed((prev) => ({ ...prev, [a.id]: true }));
                              }}
                            />
                          </button>
                        );
                      }
                      // Still resolving vault — keep a calm placeholder (no broken img)
                      if (!a.dataUrl && !vaultChecked[a.id] && !loadFailed[a.id]) {
                        return (
                          <span
                            key={a.id}
                            className={`inline-flex h-20 w-20 animate-pulse items-center justify-center rounded-xl text-xs ${
                              isUser
                                ? "bg-[var(--surface-muted)] text-white"
                                : "bg-[var(--mist)] text-[var(--ink-muted)]"
                            }`}
                            aria-label="Loading photo"
                          >
                            📷
                          </span>
                        );
                      }
                      return (
                        <span
                          key={a.id}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                            isUser
                              ? "bg-[var(--surface-muted)] text-white"
                              : "bg-[var(--mist)] text-[var(--ink)]"
                          }`}
                          title="Photo unavailable — please upload again"
                        >
                          📷 {a.name || "Photo"}
                        </span>
                      );
                    }

                    // Video attachments — inline player (play without downloading)
                    if (isVideoAttachment(a.mimeType, a.name)) {
                      return (
                        <VideoAttachment
                          key={a.id}
                          attachment={a}
                          isUser={isUser}
                          vaultSrc={vaultMap[a.id]}
                          vaultChecked={Boolean(vaultChecked[a.id])}
                          loadFailed={Boolean(loadFailed[a.id])}
                          onLoadFailed={(id) =>
                            setLoadFailed((prev) => ({ ...prev, [id]: true }))
                          }
                        />
                      );
                    }

                    // PDF / text / other files — download
                    const href = attachmentHref(a, vaultMap[a.id], {
                      download: true,
                      vaultChecked: Boolean(vaultChecked[a.id]),
                    });
                    if (href) {
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={`inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full px-2.5 py-1 text-left text-xs underline-offset-2 hover:underline ${
                            isUser
                              ? "bg-[var(--surface-muted)] text-white"
                              : "bg-[var(--mist)] text-[var(--ink)]"
                          }`}
                          title={`Download ${a.name}`}
                          onClick={() =>
                            triggerDownload(href, a.name || "download")
                          }
                        >
                          📄 {a.name || "File"} · download
                        </button>
                      );
                    }
                    return (
                      <span
                        key={a.id}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                          isUser
                            ? "bg-[var(--surface-muted)] text-white"
                            : "bg-[var(--mist)] text-[var(--ink)]"
                        }`}
                        title="File not saved — please upload again"
                      >
                        📄 {a.name || "File"}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {spark ? (
                <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--teal)]">
                  <span aria-hidden>✦</span>
                  <span className="truncate">Spark · {spark.title}</span>
                </div>
              ) : null}
              {displayContent ? (
                <MarkdownMessage
                  content={displayContent}
                  variant={isUser ? "user" : "assistant"}
                />
              ) : null}
              {streaming &&
              m.role === "assistant" &&
              m === messages[messages.length - 1] ? (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[var(--teal)] align-middle" />
              ) : null}
            </div>
            {/* Quote reply under finished user messages */}
            {isUser && onQuote ? (
              <div className="flex flex-wrap items-center gap-0.5">
                <QuoteAction message={m} onQuote={onQuote} />
              </div>
            ) : null}
            {/* Listen + English under finished assistant messages */}
            {!isUser &&
            displayContent &&
            !(
              streaming &&
              m === messages[messages.length - 1]
            ) ? (
              <div className="mt-1 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-0.5">
                  {onSpeakMessage ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (speakingMessageId === m.id) {
                          onStopSpeak?.();
                          return;
                        }
                        onSpeakMessage(m.id, displayContent);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
                        speakingMessageId === m.id
                          ? "bg-[var(--teal)]/15 text-[var(--teal)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--teal)]"
                      }`}
                      aria-label={
                        speakingMessageId === m.id
                          ? "Stop reading"
                          : "Read aloud"
                      }
                      title={
                        speakingMessageId === m.id
                          ? "Stop reading"
                          : "Read aloud"
                      }
                    >
                      {speakingMessageId === m.id ? (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          aria-hidden
                        >
                          <rect
                            x="3.5"
                            y="3.5"
                            width="9"
                            height="9"
                            rx="1.5"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          aria-hidden
                        >
                          <path
                            d="M2.5 6.5v3h2.2L8 12.5V3.5L4.7 6.5H2.5Z"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10 5.8a2.6 2.6 0 0 1 0 4.4M11.7 4.2a4.6 4.6 0 0 1 0 7.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {speakingMessageId === m.id ? "Stop" : "Listen"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void translateToEnglish(m.id, displayContent)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
                      translations[m.id]?.status === "loading" ||
                      (translations[m.id]?.status === "ready" &&
                        !translations[m.id]?.hidden)
                        ? "bg-[var(--teal)]/15 text-[var(--teal)]"
                        : "text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--teal)]"
                    }`}
                    aria-label="Translate to English"
                    title="Translate to English"
                    disabled={translations[m.id]?.status === "loading"}
                  >
                    <span className="font-semibold tracking-wide">EN</span>
                    {translations[m.id]?.status === "loading"
                      ? "…"
                      : translations[m.id]?.status === "ready" &&
                          !translations[m.id]?.hidden
                        ? "Hide"
                        : "English"}
                  </button>
                  {onQuote ? <QuoteAction message={m} onQuote={onQuote} /> : null}
                </div>
                {translations[m.id]?.status === "error" ? (
                  <p className="max-w-prose px-1 text-[11px] text-[var(--coral)]">
                    {translations[m.id]?.error || "Translation failed"}
                  </p>
                ) : null}
                {translations[m.id]?.status === "ready" &&
                translations[m.id]?.text &&
                !translations[m.id]?.hidden ? (
                  <div className="max-w-prose rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/80 px-3 py-2 text-[12px] leading-relaxed text-[var(--ink)]">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                      {translations[m.id]?.alreadyEnglish
                        ? "Already English"
                        : "English"}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {translations[m.id]?.text}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
      {onDeepDive && !streaming && messages.some((m) => m.role === "assistant") ? (
        <DeepDiveControl onPick={onDeepDive} />
      ) : null}
      {creationOffer && creationOfferLine ? (
        <div className="mt-3 w-full max-w-md rounded-2xl border border-[var(--teal)]/45 bg-[var(--teal)]/8 px-4 py-3 text-left shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
            ✨ Make it yours
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {creationOfferLine}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            Draw it, write it, or explain it — then save it to your journal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/entertain?hub=studio"
              onClick={() => onAcceptCreationOffer?.()}
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--teal)] px-3 text-[13px] font-semibold text-white transition hover:bg-[var(--teal)]/90 active:scale-95"
            >
              Open Writing Studio
            </a>
            <a
              href="/me/journal"
              onClick={() => onAcceptCreationOffer?.()}
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--teal)]/45 px-3 text-[13px] font-medium text-[var(--teal)] transition hover:bg-[var(--teal)]/10"
            >
              My journal
            </a>
            <button
              type="button"
              onClick={onDismissCreationOffer}
              className="min-h-11 rounded-xl px-3 text-[13px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
      {collabOffer ? (
        <CollabPanels
          offer={collabOffer}
          accountId={accountId}
          onDismiss={onDismissCollab}
          onCodingResult={onCodingResult}
        />
      ) : null}
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}
      {/* V3 — proactive nudge as a visual default (CHI 2026 RCT): a highlighted
          "Retry this problem" action near the composer instead of a full-width
          persuasion banner. Text is demoted to secondary. */}
      {proactiveInvite ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--coral)]/40 bg-[var(--surface-muted)] px-3 py-2 shadow-sm animate-fade-up"
          aria-live="polite"
        >
          <p className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--ink-muted)]">
            {proactiveInvite.line}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onAcceptProactiveInvite}
              className="min-h-11 rounded-xl bg-[var(--coral)] px-4 text-[13px] font-semibold text-white shadow-[0_0_0_3px_color-mix(in_srgb,var(--coral)_30%,transparent)] transition hover:bg-[var(--coral)]/90 active:scale-95"
            >
              Retry this problem
            </button>
            <button
              type="button"
              onClick={onDismissProactiveInvite}
              className="text-[11px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
      {/* Scroll anchor */}
      <div ref={bottomRef} />

      {/* "New messages" floating badge */}
      {userScrolled ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-xs font-medium text-[var(--teal)] shadow-lg backdrop-blur transition hover:bg-[var(--surface)]"
        >
          ↓ New messages
        </button>
      ) : null}
    </div>
  );
}

/** Reply-to-quote action shown under both user and tutor messages. */
function QuoteAction({
  message,
  onQuote,
}: {
  message: ChatMessage;
  onQuote: (m: ChatMessage) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onQuote(message)}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--teal)]"
      aria-label="Quote this message"
      title="Quote and reply"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 4h6v4H6.5L5 10V8H3V4Z" />
        <path d="M10 2.5h3V6h-1.5L10.5 7V6H10V2.5Z" />
      </svg>
      Quote
    </button>
  );
}

/**
 * P1 (report §8.5) — "继续深挖" under the last reply. Expands to three
 * one-tap actions: another method / boundary cases / cross-subject link.
 */
function DeepDiveControl({ onPick }: { onPick: (mode: DeepDiveMode) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 self-start rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-muted)] transition hover:border-[var(--teal)]/40 hover:text-[var(--teal)]"
      >
        Go deeper
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>
    );
  }
  const modes: DeepDiveMode[] = ["method", "boundary", "cross"];
  return (
    <div className="mt-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
        Go deeper
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onPick(m)}
            className="min-h-10 rounded-xl bg-[var(--action-bg)] px-3 text-[13px] font-medium text-[var(--action-ink)]"
          >
            {DEEP_DIVE_LABELS[m]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-10 rounded-xl px-3 text-[13px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/** Collab hub — renders the inline panel/card matching the flagged intent. */
function CollabPanels({
  offer,
  accountId,
  onDismiss,
  onCodingResult,
}: {
  offer: CollabOffer;
  accountId?: string;
  onDismiss?: () => void;
  onCodingResult?: (note: CodingResultNote) => void;
}) {
  const acct = accountId && accountId !== "default" ? accountId : "acct_ryan";
  const { intent, draft, gameRecommendation, labRecommendation } = offer;
  const close = onDismiss ?? (() => {});
  const [mediaKind, setMediaKind] = useState<"song" | "image" | "video" | null>(
    null,
  );
  const [draftForMedia, setDraftForMedia] = useState("");

  if (intent.kind === "lab") {
    return labRecommendation ? (
      <LabRecommendCard recommendation={labRecommendation} onDismiss={close} />
    ) : null;
  }
  if (intent.kind === "coding") {
    if (intent.scope === "full") {
      return gameRecommendation ? (
        <GameRecommendCard recommendation={gameRecommendation} onDismiss={close} />
      ) : null;
    }
    return (
      <InlineCodingCard
        concept={(intent.concept as CodeConcept) || "sequence"}
        accountId={acct}
        onResult={onCodingResult ?? (() => {})}
        onClose={close}
      />
    );
  }
  if (intent.kind === "game") {
    return gameRecommendation ? (
      <InlineGamePanel
        gameId={gameRecommendation.gameId}
        title={gameRecommendation.title}
        onClose={close}
      />
    ) : null;
  }
  if (intent.kind === "media") {
    if (mediaKind) {
      return (
        <InlineMediaPanel
          kind={mediaKind}
          draft={draftForMedia || draft || intent.text || ""}
          accountId={acct}
          onClose={close}
          onBack={() => setMediaKind(null)}
        />
      );
    }
    // No explicit kind from the fence — open the writing pad so the child can
    // shape the idea, then "make it into" a song/image/video from there.
    return (
      <InlineWritingPanel
        accountId={acct}
        intent={intent}
        initialDraft={draft}
        onClose={close}
        onMakeMedia={(kind, text) => {
          setDraftForMedia(text);
          setMediaKind(kind);
        }}
      />
    );
  }
  // writing
  return (
    <InlineWritingPanel
      accountId={acct}
      intent={intent}
      initialDraft={draft}
      onClose={close}
      onMakeMedia={(kind, text) => {
        setDraftForMedia(text);
        setMediaKind(kind);
      }}
    />
  );
}
