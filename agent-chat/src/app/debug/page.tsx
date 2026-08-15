"use client";

import { useState } from "react";

export default function DebugPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const testApi = async (endpoint: string) => {
    setLoading(true);
    setResult(`Fetching ${endpoint}...`);
    try {
      const resp = await fetch(endpoint);
      const data = await resp.json();
      setResult(JSON.stringify(data).slice(0, 500));
    } catch (e) {
      setResult(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  const testChat = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult("Sending...");
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, workspacePath: "/root/codes/ryan_learning" }),
      });
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
      }
      setResult(buf.slice(0, 1000));
    } catch (e) {
      setResult(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", background: "#1e1e2e", color: "#cdd6f4", minHeight: "100vh" }}>
      <h1>Debug Page</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => testApi("/api/history")} style={btn}>History</button>
        <button onClick={() => testApi("/api/workspace")} style={btn}>Workspace</button>
        <button onClick={() => testApi("/api/workspace/file?path=/root/codes/ryan_learning/agent-chat/package.json")} style={btn}>File</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..."
          style={{ flex: 1, padding: 8, background: "#313244", border: "1px solid #45475a", borderRadius: 8, color: "#cdd6f4" }} />
        <button onClick={testChat} disabled={loading} style={btn}>Chat</button>
      </div>
      <pre style={{ background: "#11111b", padding: 16, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 12 }}>
        {result || "Click a button to test..."}
      </pre>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 16px",
  background: "#89b4fa",
  color: "#11111b",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};
