"use client";

import { useState, useEffect, useCallback } from "react";
import FilePreview from "./FilePreview";
import type { WorkspaceNode } from "@/lib/types";

interface Props {
  onFileSelect: (path: string | null) => void;
  selectedFile: string | null;
}

export default function WorkspaceSidebar({ onFileSelect, selectedFile }: Props) {
  const [tree, setTree] = useState<WorkspaceNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["/root/codes/ryan_learning"])
  );

  const fetchTree = useCallback(
    async (dirPath: string) => {
      setLoading(true);
      try {
        const resp = await fetch(
          `/api/workspace?path=${encodeURIComponent(dirPath)}`
        );
        const data = await resp.json();
        if (data.path) setTree(data);
      } catch {
        // ignore
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchTree("/root/codes/ryan_learning");
  }, [fetchTree]);

  const toggleExpand = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    []
  );

  const handleFileClick = useCallback(
    (node: WorkspaceNode) => {
      if (node.type === "directory") {
        toggleExpand(node.path);
      } else {
        onFileSelect(node.path);
      }
    },
    [toggleExpand, onFileSelect]
  );

  const renderNode = (node: WorkspaceNode, depth: number): React.ReactNode => {
    const isExpanded = expanded.has(node.path);
    const isSelected = selectedFile === node.path;
    const icon = node.type === "directory" ? (isExpanded ? "📂" : "📁") : "📄";

    return (
      <div key={node.path}>
        <div
          className={`file-tree-item ${isSelected ? "selected" : ""}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => handleFileClick(node)}
        >
          <span style={{ marginRight: 6 }}>{icon}</span>
          <span style={{ fontSize: 13 }}>{node.name}</span>
          {node.size !== undefined && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>
              {formatSize(node.size)}
            </span>
          )}
        </div>
        {node.type === "directory" && isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div
      style={{
        width: 320,
        borderLeft: "1px solid var(--bg-card)",
        background: "var(--bg-sidebar)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* File Tree */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 4px",
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            padding: "4px 12px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          📁 工作区
        </div>
        {loading && !tree && (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
            加载中...
          </div>
        )}
        {tree && renderNode(tree, 0)}
      </div>

      {/* File Preview */}
      {selectedFile && (
        <FilePreview
          filePath={selectedFile}
          onClose={() => onFileSelect(null)}
        />
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
