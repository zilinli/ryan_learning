"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type NodeInfo = {
  nodeId: string;
  hostname: string;
  platform: string;
  openclawVersion: string;
  lastSeen: number;
  online: boolean;
};

function adminHeaders(): HeadersInit {
  const t = typeof window !== "undefined" ? localStorage.getItem("spark.admin") || "" : "";
  return t ? { "x-spark-admin": t, "content-type": "application/json" } : { "content-type": "application/json" };
}

export default function DeployPage() {
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [err, setErr] = useState("");
  const [admin, setAdmin] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setAdmin(localStorage.getItem("spark.admin") || "");
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const saveAdmin = () => {
    localStorage.setItem("spark.admin", admin.trim());
  };

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nodes", { headers: adminHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setNodes(j.nodes || []);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const i = setInterval(() => void refresh(), 4000);
    return () => clearInterval(i);
  }, [refresh]);

  const createPair = async () => {
    setErr("");
    const r = await fetch("/api/nodes/pair", { method: "POST", headers: adminHeaders() });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error || "pair failed");
      return;
    }
    setCode(j.code);
    setExpiresAt(j.expiresAt);
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://spark-tutor-for-ryan.duckdns.org";
  const winCmd = useMemo(() => {
    const c = code || "<PAIR_CODE>";
    return `$env:SPARK_PAIR_CODE='${c}'; $env:SPARK_URL='${origin}'; iwr -useb ${origin}/install/windows.ps1 | iex`;
  }, [code, origin]);
  // Prefer curl -k: stock macOS curl often fails Let's Encrypt verify; the
  // installer never starts if the initial download fails (pipe or -o).
  const macCmd = useMemo(() => {
    const c = code || "<PAIR_CODE>";
    return [
      `export SPARK_PAIR_CODE='${c}'`,
      `export SPARK_URL='${origin}'`,
      `export SPARK_INSECURE=1`,
      `curl -kfsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh`,
    ].join("\n");
  }, [code, origin]);
  const macCmdStrictSsl = useMemo(() => {
    const c = code || "<PAIR_CODE>";
    return [
      `export SPARK_PAIR_CODE='${c}'`,
      `export SPARK_URL='${origin}'`,
      `curl -fsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh`,
    ].join("\n");
  }, [code, origin]);

  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-[var(--ink)]">
      <p className="mb-4 text-sm">
        <a href="/" className="text-[var(--teal)] underline">
          Spark
        </a>
        {" · "}
        <a href="/control" className="text-[var(--teal)] underline">
          Control
        </a>
      </p>
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-3xl">Deploy OpenClaw on this PC</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Generate a pairing code, then run the command on Windows or macOS. Spark installs a simplified
        OpenClaw (keys, gateway, Bridge) so the PC can pair and answer{" "}
        <a href="/control" className="text-[var(--teal)] underline">
          /control
        </a>
        . Pairing only — no full assistant workspace (skills, workbench, WeChat).
      </p>

      <label className="mb-4 block text-xs text-[var(--ink-muted)]">
        Optional site password (SPARK_ADMIN_TOKEN)
        <input
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={admin}
          onChange={(e) => setAdmin(e.target.value)}
          onBlur={saveAdmin}
          placeholder="leave empty if not configured"
        />
      </label>

      <button
        type="button"
        onClick={() => void createPair()}
        className="rounded-full bg-[var(--teal)] px-5 py-2 text-sm font-semibold text-white"
      >
        Generate pair code
      </button>

      {code ? (
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="text-3xl font-mono tracking-widest">{code}</div>
          <div className="mt-1 text-xs text-[var(--ink-muted)]">expires in {left}s</div>
          <p className="mt-3 text-[11px] font-medium text-[var(--ink-muted)]">Windows</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-black/80 p-3 text-[11px] text-green-200 whitespace-pre-wrap">
            {winCmd}
          </pre>
          <button
            type="button"
            className="mt-2 text-xs text-[var(--teal)] underline"
            onClick={() => void navigator.clipboard.writeText(winCmd)}
          >
            Copy Windows command
          </button>
          <p className="mt-4 text-[11px] font-medium text-[var(--ink-muted)]">macOS</p>
          <p className="text-[10px] leading-snug text-[var(--ink-muted)]">
            Run one line at a time. Uses <code className="text-[10px]">curl -k</code> because stock macOS
            curl often rejects the site certificate before the installer can start.
          </p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-black/80 p-3 text-[11px] text-green-200 whitespace-pre-wrap">
            {macCmd}
          </pre>
          <button
            type="button"
            className="mt-2 text-xs text-[var(--teal)] underline"
            onClick={() => void navigator.clipboard.writeText(macCmd)}
          >
            Copy macOS command
          </button>
          <p className="mt-3 text-[10px] leading-snug text-[var(--ink-muted)]">
            Strict SSL (Homebrew curl / newer macOS):
          </p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-black/80 p-3 text-[11px] text-amber-200/90 whitespace-pre-wrap">
            {macCmdStrictSsl}
          </pre>
          <button
            type="button"
            className="mt-2 text-xs text-[var(--teal)] underline"
            onClick={() => void navigator.clipboard.writeText(macCmdStrictSsl)}
          >
            Copy macOS command (verify SSL)
          </button>
        </div>
      ) : null}

      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      <h2 className="mt-10 mb-2 text-lg font-semibold">Nodes</h2>
      {nodes.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">None yet.</p>
      ) : (
        <ul className="space-y-2">
          {nodes.map((n) => (
            <li key={n.nodeId} className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
              <span className={n.online ? "text-green-600" : "text-[var(--ink-muted)]"}>
                {n.online ? "online" : "offline"}
              </span>
              {" · "}
              {n.hostname} · {n.platform} · {n.openclawVersion || "openclaw?"}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        When a node is online, go to{" "}
        <a className="text-[var(--teal)] underline" href="/control">
          /control
        </a>
        .
      </p>
    </main>
  );
}
