"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage, ConversationWorksheetPlan } from "@/lib/types";
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
import { MarkdownMessage } from "./MarkdownMessage";
import { ImageLightbox } from "./ImageLightbox";

function stripHiddenFences(content: string): string {
  return stripSparkFence(
    stripMisconceptionFence(
      stripScratchDiagnosisFence(stripWorksheetPlanFence(content)),
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
  /** Snap homework — dismiss opener + open camera */
  onSnapHomework?: () => void;
  /** One-click replay for a finished message */
  onSpeakMessage?: (messageId: string, text: string) => void;
  /** Stop current replay / TTS */
  onStopSpeak?: () => void;
  /** Message id currently being spoken (for button state) */
  speakingMessageId?: string | null;
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
  onSnapHomework,
  onSpeakMessage,
  onStopSpeak,
  speakingMessageId,
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

  useEffect(() => {
    let cancelled = false;
    const missing: string[] = [];
    for (const m of messages) {
      for (const a of messageAttachments(m)) {
        // Always try the vault when dataUrl is gone — mediaId alone can 404
        // if data/media was wiped, and vault still has the homework photo.
        if (a.dataUrl) continue;
        if (vaultMap[a.id] || vaultChecked[a.id]) continue;
        missing.push(a.id);
      }
    }
    if (!missing.length) return;
    void (async () => {
      const next: Record<string, string> = {};
      const checked: Record<string, true> = {};
      for (const id of missing) {
        const hit = await getPhotoFromVault(id);
        if (hit?.dataUrl) next[id] = hit.dataUrl;
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
        <p className="max-w-md text-xs leading-relaxed text-[var(--ink-muted)]">
          Voice tutoring in 粤语 / Cantonese, 客家话, 闽南话, 上海话, and more — pick
          a voice in the sidebar.
        </p>
        <button
          type="button"
          onClick={onSnapHomework}
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--action-bg)] px-4 text-sm font-medium text-[var(--action-ink)] focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
        >
          Snap homework
        </button>

        {practiceOffer && practiceOffer.targets.length > 0 ? (
          <div className="mt-3 w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/80 px-4 py-3 text-left">
            <p className="text-sm font-medium text-[var(--ink)]">
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
        ) : sessionOpener ? (
          <div className="mt-3 w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)]/80 px-4 py-3 text-left">
            <p className="text-sm font-medium text-[var(--ink)]">{sessionOpener.line}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenerTry}
                className="min-h-11 rounded-xl bg-[var(--action-bg)] px-3 text-sm font-medium text-[var(--action-ink)]"
              >
                Try {sessionOpener.label}
              </button>
              <button
                type="button"
                onClick={onSnapHomework}
                className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-sm text-[var(--ink)]"
              >
                Snap homework
              </button>
            </div>
          </div>
        ) : null}
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
            className={`flex flex-col gap-2 ${
              animateIn ? "animate-fade-up" : ""
            } ${isUser ? "items-end" : "items-start"}`}
          >
            <span className="text-xs tracking-wide text-[var(--ink-muted)]">
              {isUser ? "You" : "The Answer Book"}
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
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
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
