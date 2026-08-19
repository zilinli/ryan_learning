"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NodeInfo = {
  nodeId: string;
  hostname: string;
  online: boolean;
};

type Msg = { role: "user" | "assistant"; text: string };

function adminHeaders(): HeadersInit {
  const t = typeof window !== "undefined" ? localStorage.getItem("spark.admin") || "" : "";
  const h: Record<string, string> = { "content-type": "application/json" };
  if (t) h["x-spark-admin"] = t;
  return h;
}

export default function ControlPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/nodes", { headers: adminHeaders() });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error || "cannot list nodes");
      return;
    }
    setErr("");
    const list = (j.nodes || []) as NodeInfo[];
    setNodes(list);
    setNodeId((prev) => prev || list.find((n) => n.online)?.nodeId || "");
  }, []);

  useEffect(() => {
    void refresh();
    const i = setInterval(() => void refresh(), 5000);
    return () => clearInterval(i);
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    let acc = "";
    try {
      const r = await fetch("/api/control/chat", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ message, nodeId: nodeId || undefined }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const block of parts) {
          const ev = block.match(/^event: (\w+)/m)?.[1];
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (!ev || !dataLine) continue;
          const data = JSON.parse(dataLine.slice(6));
          if (ev === "delta") acc += data.text || "";
          if (ev === "done") acc = data.text || acc;
          if (ev === "error") throw new Error(data.error || "error");
          setMsgs((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") copy[copy.length - 1] = { role: "assistant", text: acc };
            else copy.push({ role: "assistant", text: acc });
            return copy;
          });
        }
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Error: ${e instanceof Error ? e.message : e}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 text-[var(--ink)]">
      <p className="mb-3 text-sm">
        <a href="/" className="text-[var(--teal)] underline">
          Spark
        </a>
        {" · "}
        <a href="/deploy" className="text-[var(--teal)] underline">
          Deploy
        </a>
      </p>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl">Remote OpenClaw</h1>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">Replaces WeChat remote control. Talks to a paired PC.</p>

      <label className="mb-4 text-xs">
        Node
        <select
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
        >
          {nodes.length === 0 ? <option value="">(none)</option> : null}
          {nodes.map((n) => (
            <option key={n.nodeId} value={n.nodeId}>
              {n.online ? "●" : "○"} {n.hostname} ({n.nodeId.slice(0, 6)})
            </option>
          ))}
        </select>
      </label>
      {err ? <p className="mb-2 text-sm text-red-600">{err}</p> : null}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        {msgs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Try: 查磁盘空间</p>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-[var(--teal)] text-white" : "bg-[var(--mist)]"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        {busy ? <p className="text-xs text-[var(--ink-muted)]">thinking…</p> : null}
        <div ref={bottom} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Command for the PC…"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--teal)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
