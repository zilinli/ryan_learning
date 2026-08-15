"use client";

import { useState, useEffect, useCallback, useRef } from "react";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// --------------- Types (inline) ---------------
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; input: unknown; output?: string; status: string; timestamp: string }[];
  timestamp: string;
}
interface WsNode {
  path: string; name: string; type: "directory" | "file"; size?: number; children?: WsNode[];
}
interface FileData {
  path: string; size: number; mimeType: string; content: string; lines: number; language: string;
}

// --------------- Main Page ---------------
export default function Page() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [input, setInput] = useState("");
  const [showWs, setShowWs] = useState(true);
  const [wsTree, setWsTree] = useState<WsNode | null>(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/root/codes/ryan_learning"]));
  const sessRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load workspace on mount
  useEffect(() => {
    fetch("/api/workspace?path=/root/codes/ryan_learning")
      .then((r) => r.json())
      .then((d) => { setWsTree(d); setWsLoading(false); })
      .catch(() => setWsLoading(false));
  }, []);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, streaming]);

  // Focus input
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy]);

  // Load file contents
  const loadFile = async (path: string) => {
    setSelectedFile(path);
    setFileLoading(true);
    try {
      const r = await fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`);
      const d = await r.json();
      if (r.ok) setFileData(d);
      else setFileData(null);
    } catch { setFileData(null); }
    setFileLoading(false);
  };

  // Send message
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setStatus("thinking...");

    const userMsg: Msg = { id: genId(), role: "user", content: text, timestamp: new Date().toISOString() };
    const asstMsg: Msg = { id: genId(), role: "assistant", content: "", toolCalls: [], timestamp: new Date().toISOString() };
    setMsgs((p) => [...p, userMsg]);
    setStreaming("");

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessRef.current || undefined }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let content = "";
      const tools: Msg["toolCalls"] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            switch (d.type) {
              case "status": setStatus(d.message || ""); break;
              case "delta": content += d.content || ""; setStreaming(content); break;
              case "tool_call":
              case "tool_use":
                setStatus(d.tool ? `🔧 ${d.tool}` : status);
                tools.push({ tool: d.tool || "?", input: d.input, output: d.output, status: d.output ? "success" : "running", timestamp: new Date().toISOString() });
                break;
              case "error": setStatus(`❌ ${d.message}`); break;
              case "done":
                if (d.sessionId) sessRef.current = d.sessionId;
                break;
            }
          } catch { /* skip */ }
        }
      }

      asstMsg.content = content || "(no output)";
      asstMsg.toolCalls = tools;
      setMsgs((p) => [...p, asstMsg]);
    } catch (e) {
      asstMsg.content = `**Error**: ${e instanceof Error ? e.message : String(e)}`;
      setMsgs((p) => [...p, asstMsg]);
    }
    setStreaming("");
    setBusy(false);
    setStatus("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const toggleExpand = (path: string) => {
    setExpanded((p) => { const n = new Set(p); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  };

  // Voice: simple Web Speech API
  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // Fallback to server recording
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        const chunks: Blob[] = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setRecording(false);
          const blob = new Blob(chunks, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "recording.webm");
          try {
            const r = await fetch("/api/transcribe", { method: "POST", body: fd });
            const d = await r.json();
            if (d.text) setInput(d.text);
          } catch { /* ignore */ }
        };
        mr.start();
        setRecording(true);
        setTimeout(() => { if (mr.state === "recording") mr.stop(); }, 15000);
      }).catch(() => {});
      return;
    }
    const r = new SR();
    r.lang = "zh-CN";
    r.interimResults = false;
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setRecording(false); };
    r.onerror = () => setRecording(false);
    r.onend = () => setRecording(false);
    r.start();
    setRecording(true);
  };

  // Render file tree node
  const renderNode = (node: WsNode, depth: number): React.ReactNode => {
    const isExp = expanded.has(node.path);
    const isSel = selectedFile === node.path;
    return (
      <div key={node.path}>
        <div
          onClick={() => node.type === "directory" ? toggleExpand(node.path) : loadFile(node.path)}
          style={{ padding: "2px 8px", paddingLeft: 8 + depth * 14, cursor: "pointer", borderRadius: 4, fontSize: 12,
            background: isSel ? "rgba(137,180,250,0.15)" : "transparent", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            color: isSel ? "#89b4fa" : "#cdd6f4" }}
        >
          {node.type === "directory" ? (isExp ? "📂" : "📁") : "📄"} {node.name}
          {node.size !== undefined && <span style={{ color: "#6c7086", marginLeft: 6, fontSize: 10 }}>{fmtSize(node.size)}</span>}
        </div>
        {node.type === "directory" && isExp && node.children?.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#1e1e2e", color: "#cdd6f4" }}>
      {/* Left: Chat */}
      <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px",
          borderBottom: "1px solid #313244", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setShowWs(!showWs)}
              style={{ background: "none", border: "none", color: "#a6adc8", cursor: "pointer", fontSize: 16 }}>{showWs ? "◫" : "☰"}</button>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Agent Chat Console</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setMsgs([]); sessRef.current = ""; setStatus(""); }}
              style={{ background: "#313244", border: "none", color: "#cdd6f4", cursor: "pointer", fontSize: 12, padding: "4px 10px", borderRadius: 6 }}>
              + 新建
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {msgs.length === 0 && !busy && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#6c7086", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Agent Chat Console</div>
              <div style={{ fontSize: 13 }}>输入命令让 Cursor 帮你写代码 · 支持语音输入</div>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 10, color: "#6c7086", marginBottom: 2 }}>{m.role === "user" ? "You" : "Agent"}</div>
              <div style={{
                background: m.role === "user" ? "#89b4fa" : "#313244",
                color: m.role === "user" ? "#11111b" : "#cdd6f4",
                borderRadius: 12,
                borderBottomRightRadius: m.role === "user" ? 4 : 12,
                borderBottomLeftRadius: m.role === "user" ? 12 : 4,
                padding: "8px 12px", maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.6,
              }}>
                {m.content}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div style={{ marginTop: 6, borderTop: "1px solid #45475a", paddingTop: 4 }}>
                    {m.toolCalls.map((tc, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#a6adc8" }}>
                        🔧 {tc.tool} {tc.status === "success" ? "✅" : "⏳"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#6c7086", marginBottom: 2 }}>Agent</div>
              <div style={{ background: "#313244", borderRadius: 12, borderBottomLeftRadius: 4, padding: "8px 12px", maxWidth: "85%", fontSize: 13 }}>
                {status && <div style={{ fontSize: 11, color: "#a6adc8", marginBottom: 4 }}>{status}</div>}
                {streaming ? (
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{streaming}<span style={{ animation: "blink 1s infinite", color: "#89b4fa" }}>▊</span></div>
                ) : (
                  <div>
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#6c7086", animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "-0.32s" }} />
                    {" "}
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#6c7086", animation: "bounce 1.4s infinite ease-in-out both", animationDelay: "-0.16s" }} />
                    {" "}
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#6c7086", animation: "bounce 1.4s infinite ease-in-out both" }} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "8px 14px 12px", borderTop: "1px solid #313244", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, background: "#313244", borderRadius: 10, padding: "4px 8px", border: "1px solid #45475a" }}>
            <button
              onClick={recording ? () => setRecording(false) : startVoice}
              disabled={busy}
              style={{ background: recording ? "#f38ba8" : "none", border: "none", color: recording ? "#fff" : "#a6adc8",
                cursor: busy ? "not-allowed" : "pointer", fontSize: 16, padding: "4px 8px", borderRadius: 6, flexShrink: 0, opacity: busy ? 0.4 : 1 }}>
              🎤
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={handleKey}
              placeholder={recording ? "正在聆听..." : "输入命令，让 Cursor 帮你写代码..."}
              disabled={busy}
              rows={1}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#cdd6f4", fontSize: 13,
                fontFamily: "inherit", resize: "none", minHeight: 22, maxHeight: 120, lineHeight: "22px", padding: 0 }}
            />
            <button onClick={send} disabled={busy || !input.trim()}
              style={{ background: input.trim() && !busy ? "#cba6f7" : "transparent", border: "none",
                color: input.trim() && !busy ? "#11111b" : "#6c7086", cursor: busy || !input.trim() ? "not-allowed" : "pointer",
                fontSize: 13, padding: "4px 10px", borderRadius: 6, fontWeight: 600, flexShrink: 0, opacity: busy || !input.trim() ? 0.4 : 1 }}>
              发送
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10, color: "#585b70", paddingLeft: 2 }}>
            <span>Enter 发送 · Shift+Enter 换行</span>
            <span>/root/codes/ryan_learning</span>
          </div>
        </div>
      </div>

      {/* Right: Workspace */}
      {showWs && (
        <div style={{ width: 300, borderLeft: "1px solid #313244", background: "#181825", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 4px", minHeight: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6c7086", padding: "4px 10px 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>📁 工作区</div>
            {wsLoading && <div style={{ padding: 12, color: "#6c7086", fontSize: 12 }}>加载中...</div>}
            {!wsLoading && !wsTree && <div style={{ padding: 12, color: "#f38ba8", fontSize: 12 }}>加载失败</div>}
            {wsTree && renderNode(wsTree, 0)}
          </div>

          {/* File preview */}
          {selectedFile && (
            <div style={{ borderTop: "1px solid #313244", background: "#11111b", display: "flex", flexDirection: "column", maxHeight: "45%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid #313244", flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📄 {selectedFile.split("/").pop()}
                  {fileData && <span style={{ color: "#6c7086", marginLeft: 6 }}>{fmtSize(fileData.size)} · {fileData.lines}行</span>}
                </div>
                <button onClick={() => { setSelectedFile(null); setFileData(null); }} style={{ background: "none", border: "none", color: "#6c7086", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
                {fileLoading && <div style={{ padding: 12, color: "#6c7086", fontSize: 12 }}>加载中...</div>}
                {fileData && (
                  <pre style={{ margin: 0, padding: "0 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6, color: "#cdd6f4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    <code>{fileData.content.slice(0, 5000)}{fileData.content.length > 5000 ? "\n...(truncated)" : ""}</code>
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
    </div>
  );
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}
