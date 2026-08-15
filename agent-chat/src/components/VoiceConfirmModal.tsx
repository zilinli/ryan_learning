"use client";

import { useState } from "react";

interface Props {
  text: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export default function VoiceConfirmModal({ text, onConfirm, onCancel }: Props) {
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);

  const handleConfirm = () => {
    onConfirm(editing ? editedText : text);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="animate-scale-in"
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--bg-card)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
            color: "var(--text-primary)",
          }}
        >
          🎤 语音识别结果
        </div>

        {/* Text display / edit */}
        {editing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={5}
            autoFocus
            style={{
              width: "100%",
              background: "var(--bg-card)",
              border: "1px solid var(--accent-blue)",
              borderRadius: 8,
              padding: "12px",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
            }}
          />
        ) : (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {text}
          </div>
        )}

        {/* Info */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginTop: 8,
          }}
        >
          🎙️ 语言: 自动检测 · 确认后发送给 Agent
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setEditing(!editing)}
              style={{
                background: "none",
                border: "1px solid var(--bg-card)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {editing ? "取消编辑" : "✏️ 修改文字"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                background: "none",
                border: "1px solid var(--bg-card)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              style={{
                background: "var(--accent-purple)",
                border: "none",
                color: "#11111b",
                cursor: "pointer",
                padding: "6px 20px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              📤 确认发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
