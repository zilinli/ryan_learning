"use client";
import { useMemo } from "react";
import type { ConsoleMessage, ToolCall } from "@/lib/types";

type Props = {
  messages: ConsoleMessage[];
  streamingContent: string;
  statusText: string;
  runningTools: ToolCall[];
  isStreaming: boolean;
};

const TOOL_ICONS: Record<string, string> = {
  search_code: "🔍",
  read_file: "📖",
  edit_file: "✏️",
  run_tests: "🧪",
  git_diff: "📋",
  apply_changes: "✅",
  revert_changes: "↩",
  list_files: "📁",
};

export function CodeAgentThread({ messages, streamingContent, statusText, runningTools, isStreaming }: Props) {
  const visible = useMemo(() => messages.slice(-8), [messages]);

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">
      {visible.map(m => (
        <MessageBubble key={m.id} m={m} />
      ))}

      {isStreaming && (
        <div className="flex flex-col gap-0.5 items-start">
          <span className="text-[10px] font-medium text-[var(--ink-muted)] ml-1">🛠 Builder</span>

          {/* Tool badges row */}
          {runningTools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {runningTools.map((t, i) => (
                <span key={`${t.tool}-${i}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    t.status === "running" ? "bg-[var(--teal)]/10 text-[var(--teal)]" :
                    t.status === "error" ? "bg-[var(--coral)]/10 text-[var(--coral)]" :
                    "bg-[var(--mist)] text-[var(--ink-muted)]"
                  }`}>
                  {TOOL_ICONS[t.tool] || "🔧"} {t.tool}
                  {t.status === "running" ? " …" : t.status === "error" ? " ✗" : " ✓"}
                </span>
              ))}
            </div>
          )}

          {/* Streaming text bubble */}
          <div className="max-w-full rounded-xl bg-[var(--mist)] px-3 py-2">
            {streamingContent ? (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                {streamingContent}<span className="inline-block w-[5px] h-3.5 bg-[var(--teal)] animate-pulse align-middle ml-0.5" />
              </p>
            ) : (
              <div className="flex items-center gap-2 py-1">
                {/* Animated dots when thinking with no output yet */}
                <div className="flex gap-1">
                  {[0, 200, 400].map((d, i) => (
                    <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--teal)]/60"
                      style={{ animationDelay: d + "ms", animationDuration: "1s" }} />
                  ))}
                </div>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  {statusText || "Thinking…"}
                </span>
              </div>
            )}
          </div>

          {/* Status line below bubble */}
          {statusText && streamingContent && (
            <span className="text-[10px] text-[var(--ink-muted)] ml-1">{statusText}</span>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ m }: { m: ConsoleMessage }) {
  if (m.role === "system") {
    return (
      <div className="rounded-lg bg-[var(--mist)]/50 px-3 py-1.5 text-center text-[11px] text-[var(--ink-muted)]">
        {m.content}
      </div>
    );
  }
  const isUser = m.role === "user";

  return (
    <div className={"flex flex-col gap-0.5" + (isUser ? " items-end" : " items-start")}>
      <span className="text-[10px] font-medium text-[var(--ink-muted)] ml-1">
        {isUser ? "You" : "🛠 Builder"}
      </span>

      <div className={"max-w-full rounded-xl px-3 py-2 text-sm" + (isUser ? " bg-[var(--teal)]/10" : " bg-[var(--mist)]")}>
        <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
          {m.content.length > 800 ? m.content.slice(0, 800) + "…" : m.content}
        </p>
      </div>

      {/* Tool badges for completed agent messages */}
      {!isUser && m.tools && m.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {m.tools.map((t, i) => (
            <span key={`${t.tool}-${i}`}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                t.status === "error" ? "bg-[var(--coral)]/10 text-[var(--coral)]" : "bg-[var(--mist)] text-[var(--ink-muted)]"
              }`}>
              {TOOL_ICONS[t.tool] || "🔧"} {t.tool}
              {t.status === "error" ? " ✗" : " ✓"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
