"use client";

import type { ChatAttachment, ChatMessage } from "@/lib/types";
import { MarkdownMessage } from "./MarkdownMessage";

type Props = {
  messages: ChatMessage[];
  streaming?: boolean;
};

function messageAttachments(m: ChatMessage): ChatAttachment[] {
  if (m.attachments?.length) return m.attachments;
  if (m.image) {
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

export function ChatThread({ messages, streaming }: Props) {
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
                  {attachments.map((a, idx) =>
                    a.kind === "image" && a.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={a.id}
                        src={a.dataUrl}
                        alt={a.name || `Photo ${idx + 1}`}
                        className={`max-h-44 max-w-[9rem] rounded-xl object-contain sm:max-w-[11rem] ${
                          isUser
                            ? "border border-white/20"
                            : "border border-[var(--line)]"
                        }`}
                      />
                    ) : (
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
                    ),
                  )}
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
    </div>
  );
}
