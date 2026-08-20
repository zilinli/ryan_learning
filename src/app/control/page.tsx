"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { RYAN_ACCOUNT } from "@/lib/tenant-storage";
import type { SpeakStreamApi } from "@/components/VoiceControls";
import type { ClientAttachment } from "@/lib/file-payload";
import { loadVoiceId } from "@/lib/voices";

type NodeInfo = {
  nodeId: string;
  hostname: string;
  alias?: string;
  platform?: string;
  online: boolean;
};

type Msg = { id: string; role: "user" | "assistant"; text: string };

function captureAdminFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("admin")?.trim();
  if (token) {
    localStorage.setItem("spark.admin", token);
    params.delete("admin");
    const q = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
  }
}

function adminHeaders(): HeadersInit {
  const t = typeof window !== "undefined" ? localStorage.getItem("spark.admin") || "" : "";
  const h: Record<string, string> = { "content-type": "application/json" };
  if (t) h["x-spark-admin"] = t;
  return h;
}

function nodeLabel(n: NodeInfo) {
  return n.alias?.trim() || n.hostname;
}

export default function ControlPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const speakApiRef = useRef<SpeakStreamApi | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/nodes", { cache: "no-store", headers: adminHeaders() });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error || "cannot list nodes");
      return;
    }
    setErr("");
    const list = (j.nodes || []) as NodeInfo[];
    setNodes(list);
    setNodeId((prev) => {
      if (prev && list.some((n) => n.nodeId === prev)) return prev;
      return list.find((n) => n.online)?.nodeId || list[0]?.nodeId || "";
    });
  }, []);

  useEffect(() => {
    captureAdminFromUrl();
    void refresh();
    const i = setInterval(() => void refresh(), 5000);
    return () => clearInterval(i);
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function consumeSse(
    r: Response,
    onAcc: (text: string) => void,
  ): Promise<string> {
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${r.status}`);
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let acc = "";
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
        onAcc(acc);
      }
    }
    return acc;
  }

  async function send(payload: { text: string; attachments: ClientAttachment[] }) {
    if (busy) return;
    const text = payload.text.trim();
    if (!text && payload.attachments.length === 0) return;
    const userId = `u-${Date.now()}`;
    const asstId = `a-${Date.now()}`;
    setMsgs((m) => [
      ...m,
      {
        id: userId,
        role: "user",
        text: text || payload.attachments.map((a) => a.name).join(", "),
      },
    ]);
    setBusy(true);
    speakApiRef.current?.begin();
    try {
      const r = await fetch("/api/control/chat", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          message: text,
          nodeId: nodeId || undefined,
          attachments: payload.attachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataUrl || a.data || "",
          })),
        }),
      });
      let lastPushed = "";
      const acc = await consumeSse(r, (next) => {
        setMsgs((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.id === asstId) copy[copy.length - 1] = { ...last, text: next };
          else copy.push({ id: asstId, role: "assistant", text: next });
          return copy;
        });
        const added = next.slice(lastPushed.length);
        lastPushed = next;
        if (added && voiceEnabled) speakApiRef.current?.push(added);
      });
      speakApiRef.current?.finish(acc);
    } catch (e) {
      const msg = `Error: ${e instanceof Error ? e.message : e}`;
      setMsgs((m) => [...m, { id: asstId, role: "assistant", text: msg }]);
      speakApiRef.current?.stop();
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
      <p className="mb-4 text-sm text-[var(--ink-muted)]">
        Talk to a paired PC. Voice, camera, and files match the Spark homepage.
      </p>

      <div className="mb-4 space-y-2">
        {nodes.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            No nodes yet. Pair a PC on{" "}
            <a className="text-[var(--teal)] underline" href="/deploy">
              /deploy
            </a>
            .
          </p>
        ) : (
          nodes.map((n) => (
            <button
              key={n.nodeId}
              type="button"
              onClick={() => setNodeId(n.nodeId)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                n.nodeId === nodeId
                  ? "border-[var(--teal)] bg-[var(--surface)]"
                  : "border-[var(--line)]"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  n.online ? "bg-green-500" : "bg-[var(--ink-muted)]"
                }`}
              />
              <span className="font-medium">{nodeLabel(n)}</span>
              <span className="text-xs text-[var(--ink-muted)]">
                {n.online ? "online" : "offline"} · {n.platform || ""}
              </span>
            </button>
          ))
        )}
      </div>
      {err ? <p className="mb-2 text-sm text-red-600">{err}</p> : null}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        {msgs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Try: 查磁盘空间</p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-[var(--teal)] text-white" : "bg-[var(--mist)] text-left"
                }`}
              >
                {m.role === "assistant" ? (
                  <MarkdownMessage content={m.text} variant="assistant" />
                ) : (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                )}
              </div>
              {m.role === "assistant" && m.text && !busy ? (
                <div className="mt-1">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--teal)]"
                    onClick={() => {
                      if (speakingMessageId === m.id) {
                        speakApiRef.current?.stop();
                        setSpeakingMessageId(null);
                        return;
                      }
                      setSpeakingMessageId(m.id);
                      void speakApiRef.current?.speakOnce(m.text, loadVoiceId(RYAN_ACCOUNT));
                    }}
                  >
                    {speakingMessageId === m.id ? "Stop" : "Listen"}
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
        {busy ? <p className="text-xs text-[var(--ink-muted)]">thinking…</p> : null}
        <div ref={bottom} />
      </div>

      <div className="mt-4">
        <Composer
          disabled={busy}
          accountId={RYAN_ACCOUNT}
          voiceEnabled={voiceEnabled}
          onVoiceEnabledChange={setVoiceEnabled}
          onSpeakApi={(api) => {
            speakApiRef.current = api;
          }}
          onSpeakingChange={(speaking) => {
            if (!speaking) setSpeakingMessageId(null);
          }}
          onPrepareSpeak={() => speakApiRef.current?.prepare() ?? Promise.resolve()}
          onSend={(p) => void send(p)}
        />
      </div>
    </main>
  );
}
