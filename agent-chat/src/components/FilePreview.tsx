"use client";

import { useState, useEffect } from "react";
import type { FileContent } from "@/lib/types";

interface Props {
  filePath: string;
  onClose: () => void;
}

export default function FilePreview({ filePath, onClose }: Props) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!cancelled) {
          if (r.ok) setContent(data);
          else setError(data.error || "Failed to load");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div
      style={{
        borderTop: "1px solid var(--bg-card)",
        background: "var(--bg-code)",
        display: "flex",
        flexDirection: "column",
        maxHeight: "45%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid var(--bg-card)",
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📄 {fileName}
          </div>
          {content && (
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {formatSize(content.size)} · {content.lines} 行 · {content.language}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 16,
            padding: 2,
          }}
          title="关闭"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 0",
        }}
      >
        {loading && (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
            加载中...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, color: "var(--accent-red)", fontSize: 13 }}>
            ❌ {error}
          </div>
        )}
        {content && (
          <pre
            style={{
              margin: 0,
              padding: "0 12px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 1.6,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "transparent",
            }}
          >
            <code>{content.content}</code>
          </pre>
        )}
      </div>

      {/* Footer actions */}
      {content && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "6px 12px",
            borderTop: "1px solid var(--bg-card)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigator.clipboard.writeText(content.content)}
            style={{
              background: "none",
              border: "1px solid var(--bg-card)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "2px 10px",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            📋 复制内容
          </button>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
