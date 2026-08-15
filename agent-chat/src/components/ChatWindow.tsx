"use client";

import { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  statusMessage: string;
}

export default function ChatWindow({
  messages,
  streamingContent,
  isStreaming,
  statusMessage,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Agent Chat Console
        </div>
        <div style={{ fontSize: 14, maxWidth: 400 }}>
          输入你的命令，让 Cursor 帮你编写代码、创建文件、调试问题。支持语音输入（中英文）。
        </div>
        <div style={{ fontSize: 12, marginTop: 12, color: "var(--text-muted)" }}>
          按 Enter 发送 · Shift+Enter 换行 · 🎤 语音输入
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 16px 8px",
      }}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Streaming message */}
      {isStreaming && (
        <div
          className="animate-fade-in"
          style={{ marginBottom: 8 }}
        >
          {statusMessage && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 4,
                paddingLeft: 4,
              }}
            >
              {statusMessage}
            </div>
          )}
          {streamingContent ? (
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 12,
                borderBottomLeftRadius: 4,
                padding: "10px 14px",
                maxWidth: "85%",
              }}
            >
              <div className="message-content cursor-blink">
                <StreamingMarkdown content={streamingContent} />
              </div>
            </div>
          ) : (
            <div style={{ padding: "8px 14px" }}>
              <span className="dot-bounce" />
              <span className="dot-bounce" style={{ marginLeft: 4 }} />
              <span className="dot-bounce" style={{ marginLeft: 4 }} />
            </div>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// Minimal streaming markdown renderer (no full react-markdown needed for streaming)
function StreamingMarkdown({ content }: { content: string }) {
  // Simple rendering: code blocks, inline code, newlines
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const lang = lines[0].replace("```", "").trim();
          const code = lines.slice(1, -1).join("\n") || lines[0];
          return (
            <pre key={i} style={{ margin: "8px 0" }}>
              {lang && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  {lang}
                </div>
              )}
              <code>{code}</code>
            </pre>
          );
        }
        // Simple text with inline code
        const segments = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {segments.map((seg, j) =>
              seg.startsWith("`") && seg.endsWith("`") ? (
                <code key={j}>{seg.slice(1, -1)}</code>
              ) : (
                <span key={j}>{seg}</span>
              )
            )}
          </span>
        );
      })}
    </>
  );
}
