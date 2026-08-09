"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage, ConversationWorksheetPlan } from "@/lib/types";
import { getPhotoFromVault } from "@/lib/photo-vault";
import {
  formatProgressLabelOrDone,
  isWorksheetComplete,
  stripWorksheetPlanFence,
} from "@/lib/worksheet-planner";
import type { PendingPracticeOffer } from "@/lib/session-practice";
import type { SessionOpener } from "@/lib/session-opener";
import { MarkdownMessage } from "./MarkdownMessage";
import { ImageLightbox } from "./ImageLightbox";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());

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
      {messages.map((m) => {
        const attachments = messageAttachments(m);
        const isUser = m.role === "user";
        const displayContent = isUser
          ? m.content
          : stripWorksheetPlanFence(m.content);
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
