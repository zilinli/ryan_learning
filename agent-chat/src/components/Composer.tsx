"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { isWebSpeechAvailable, createWebSpeechRecognition, detectSpeechLang } from "@/lib/stt";

interface Props {
  onSend: (text: string) => void;
  onVoiceResult: (text: string) => void;
  disabled: boolean;
  initialValue?: string;
}

export default function Composer({ onSend, onVoiceResult, disabled, initialValue }: Props) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
    }
  }, [initialValue]);

  // Auto-focus
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  // Auto-resize textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, []);

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
    // Reset height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleVoiceClick = useCallback(() => {
    if (isRecording) {
      // Stop recording (handled by Web Speech onresult)
      setIsRecording(false);
      return;
    }

    // Try Web Speech API first
    if (isWebSpeechAvailable()) {
      const recognition = createWebSpeechRecognition(detectSpeechLang());
      if (!recognition) return;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript || "";
        setIsRecording(false);
        onVoiceResult(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      setIsRecording(true);
      recognition.start();
    } else {
      // Fallback: use MediaRecorder + server STT
      startServerRecording();
    }
  }, [isRecording, onVoiceResult]);

  // Server-based recording fallback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startServerRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        try {
          const { transcribeServer } = await import("@/lib/stt");
          const result = await transcribeServer(blob);
          setIsRecording(false);
          onVoiceResult(result.text);
        } catch {
          setIsRecording(false);
          onVoiceResult(""); // error — user can retry
        }
      };

      recorder.start();
      setIsRecording(true);

      // Auto-stop after 15s
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 15000);
    } catch {
      setIsRecording(false);
    }
  }, [onVoiceResult]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return (
    <div
      style={{
        padding: "10px 16px 14px",
        borderTop: "1px solid var(--bg-card)",
        background: "var(--bg-primary)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "var(--bg-input)",
          borderRadius: 12,
          border: "1px solid var(--bg-card)",
          padding: "6px 8px",
        }}
      >
        {/* Voice button */}
        <button
          onClick={isRecording ? stopRecording : handleVoiceClick}
          disabled={disabled}
          title={isRecording ? "停止录音" : "语音输入"}
          style={{
            background: isRecording ? "var(--accent-red)" : "none",
            border: "none",
            color: isRecording ? "#fff" : "var(--text-secondary)",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 18,
            padding: "4px 8px",
            borderRadius: 8,
            flexShrink: 0,
            opacity: disabled ? 0.4 : 1,
          }}
          className={isRecording ? "animate-pulse-ring" : ""}
        >
          🎤
        </button>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "正在聆听..." : "输入你想让 Cursor 做的事情，或点击 🎤 语音输入..."}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "none",
            minHeight: 24,
            maxHeight: 150,
            lineHeight: "24px",
            padding: 0,
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          title="发送 (Enter)"
          style={{
            background: text.trim() ? "var(--accent-purple)" : "transparent",
            border: "none",
            color: text.trim() ? "#11111b" : "var(--text-muted)",
            cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
            fontSize: 15,
            padding: "4px 12px",
            borderRadius: 8,
            fontWeight: 600,
            flexShrink: 0,
            opacity: disabled || !text.trim() ? 0.4 : 1,
          }}
        >
          发送
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 11,
          color: "var(--text-muted)",
          paddingLeft: 4,
        }}
      >
        <span>按 Enter 发送 · Shift+Enter 换行</span>
        <span>默认工作区: /root/codes/ryan_learning</span>
      </div>
    </div>
  );
}
