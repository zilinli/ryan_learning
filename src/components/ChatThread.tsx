"use client";

import { useState } from "react";
import type { ChatAttachment, ChatMessage } from "@/lib/types";
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

/** Prefer local dataUrl; fall back to server media for history chats. */
function attachmentImageSrc(a: ChatAttachment): string | null {
  if (a.dataUrl) return a.dataUrl;
  if (a.mediaId) return `/api/media/${encodeURIComponent(a.mediaId)}`;
  return null;
}

export function ChatThread({ messages, streaming }: Props) {
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center animate-fade-up">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)] sm:text-3xl">
          What are you working on?
        </p>
        <p className="max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
          Chat with me, or upload homework photos / a PDF. I&apos;ll point to
          the key lines, show maths &amp; diagrams clearly, and guide you step
          by step—no spoilers.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {messages.map((m) => {
        const attachments = messageAttachments(m);
        const isUser = m.role === "user";
        return (
          <article
            key={m.id}
            className={`animate-fade-up flex flex-col gap-2 ${
              isUser ? "items-end" : "items-start"
            }`}
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
                    const src =
                      a.kind === "image" ? attachmentImageSrc(a) : null;
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
                    if (a.kind === "image") {
                      return (
                        <span
                          key={a.id}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                            isUser
                              ? "bg-white/20 text-white"
                              : "bg-[var(--mist)] text-[var(--ink)]"
                          }`}
                          title="Photo preview unavailable"
                        >
                          {a.name || "Photo"}
                        </span>
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
                      >
                        {a.name}
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
    </div>
  );
}
