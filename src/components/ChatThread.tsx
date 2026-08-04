"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage } from "@/lib/types";
import { getPhotoFromVault } from "@/lib/photo-vault";
import { MarkdownMessage } from "./MarkdownMessage";
import { ImageLightbox } from "./ImageLightbox";

type Props = {
  messages: ChatMessage[];
  streaming?: boolean;
};

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

/** Prefer local dataUrl; then vault; then server media. */
function attachmentHref(
  a: ChatAttachment,
  vaultSrc?: string | null,
  opts?: { download?: boolean },
): string | null {
  if (a.dataUrl) return a.dataUrl;
  if (vaultSrc) return vaultSrc;
  if (a.mediaId) {
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

export function ChatThread({ messages, streaming }: Props) {
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [vaultMap, setVaultMap] = useState<Record<string, string>>({});
  const [userScrolled, setUserScrolled] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const missing: string[] = [];
    for (const m of messages) {
      for (const a of messageAttachments(m)) {
        if (a.dataUrl || a.mediaId) continue;
        if (vaultMap[a.id]) continue;
        missing.push(a.id);
      }
    }
    if (!missing.length) return;
    void (async () => {
      const next: Record<string, string> = {};
      for (const id of missing) {
        const hit = await getPhotoFromVault(id);
        if (hit?.dataUrl) next[id] = hit.dataUrl;
      }
      if (!cancelled && Object.keys(next).length) {
        setVaultMap((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, vaultMap]);

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
          Snap a photo, type a question, or use the mic. I'll guide you step by
          step — no spoilers.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-[var(--ink-muted)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/60 px-2.5 py-1">
            📷 Photo
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/60 px-2.5 py-1">
            🎤 Voice question
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {messages.map((m) => {
        const attachments = messageAttachments(m);
        const isUser = m.role === "user";
        const wasSeen = seenIdsRef.current.has(m.id);
        if (!wasSeen) seenIdsRef.current.add(m.id);
        const animateIn =
          !wasSeen &&
          m.content.length < 120 &&
          !(m.role === "assistant" && m.content.length > 0 && streaming);
        return (
          <article
            key={m.id}
            className={`flex flex-col gap-2 ${
              animateIn ? "animate-fade-up" : ""
            } ${isUser ? "items-end" : "items-start"}`}
          >
            <span className="text-xs tracking-wide text-[var(--ink-muted)]">
              {isUser ? "You" : "Spark"}
            </span>
            <div
              className={`max-w-[94%] break-words sm:max-w-[88%] ${
                isUser
                  ? "rounded-2xl rounded-br-md bg-[var(--teal)] px-4 py-3 text-white"
                  : "rounded-2xl rounded-bl-md bg-white/70 px-4 py-3 text-[var(--ink)] ring-1 ring-[var(--line)]"
              }`}
            >
              {attachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((a, idx) => {
                    if (a.kind === "image") {
                      const src = attachmentHref(a, vaultMap[a.id]);
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
                                  ? "border border-white/20"
                                  : "border border-[var(--line)]"
                              } rounded-xl`}
                              draggable={false}
                            />
                          </button>
                        );
                      }
                      return (
                        <span
                          key={a.id}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                            isUser
                              ? "bg-white/20 text-white"
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
                    });
                    if (href) {
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={`inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full px-2.5 py-1 text-left text-xs underline-offset-2 hover:underline ${
                            isUser
                              ? "bg-white/20 text-white"
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
                            ? "bg-white/20 text-white"
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
              {m.content ? (
                <MarkdownMessage
                  content={m.content}
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
          className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[var(--line)] bg-white/95 px-4 py-2 text-xs font-medium text-[var(--teal)] shadow-lg backdrop-blur transition hover:bg-white"
        >
          ↓ New messages
        </button>
      ) : null}
    </div>
  );
}
