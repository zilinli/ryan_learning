"use client";

import type { ChatAttachment, ChatMessage } from "@/lib/types";

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
          Chat with me, or upload several homework photos / a PDF. I&apos;ll
          highlight the key lines and guide you step by step—no spoilers.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {messages.map((m) => {
        const attachments = messageAttachments(m);
        return (
          <article
            key={m.id}
            className={`animate-fade-up flex flex-col gap-2 ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <span className="text-xs tracking-wide text-[var(--ink-muted)]">
              {m.role === "user" ? "You" : "Spark"}
            </span>
            <div
              className={`max-w-[92%] whitespace-pre-wrap break-words px-1 text-[15px] leading-7 sm:max-w-[85%] ${
                m.role === "user"
                  ? "rounded-2xl rounded-br-md bg-[var(--teal)] px-4 py-3 text-white"
                  : "text-[var(--ink)]"
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
                        className="max-h-44 max-w-[9rem] rounded-xl border border-white/20 object-contain sm:max-w-[11rem]"
                      />
                    ) : (
                      <span
                        key={a.id}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                          m.role === "user"
                            ? "bg-white/20 text-white"
                            : "bg-[var(--mist)] text-[var(--ink)]"
                        }`}
                      >
                        📎 {a.name}
                      </span>
                    ),
                  )}
                </div>
              ) : null}
              {m.content}
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
