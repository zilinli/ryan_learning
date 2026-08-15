"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const toggleTool = (idx: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {/* Role label */}
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 2,
          paddingLeft: isUser ? 0 : 4,
          paddingRight: isUser ? 4 : 0,
        }}
      >
        {isUser ? "You" : "Agent"}
      </div>

      {/* Bubble */}
      <div
        style={{
          background: isUser ? "var(--accent-blue)" : "var(--bg-card)",
          color: isUser ? "#11111b" : "var(--text-primary)",
          borderRadius: 12,
          borderBottomRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 12 : 4,
          padding: "10px 14px",
          maxWidth: "85%",
          wordBreak: "break-word",
        }}
      >
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
        ) : (
          <div className="message-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {message.toolCalls.map((tc, idx) => (
              <div key={idx} className="tool-call-card">
                <div
                  className="tool-call-header"
                  onClick={() => toggleTool(idx)}
                >
                  <span>
                    {tc.status === "running" ? "⏳" : "✅"} 🔧 {tc.tool}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11 }}>
                    {expandedTools.has(idx) ? "收起" : "展开"}
                  </span>
                </div>
                {expandedTools.has(idx) && (
                  <div className="tool-call-body">
                    {tc.input !== undefined && (
                      <pre>
                        <code>
                          {typeof tc.input === "string"
                            ? tc.input
                            : JSON.stringify(tc.input, null, 2)}
                        </code>
                      </pre>
                    )}
                    {tc.output && (
                      <pre style={{ marginTop: 4 }}>
                        <code>{tc.output}</code>
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 2,
          paddingLeft: isUser ? 0 : 4,
          paddingRight: isUser ? 4 : 0,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
