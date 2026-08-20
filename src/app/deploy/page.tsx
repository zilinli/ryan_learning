"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type NodeInfo = {
  nodeId: string;
  hostname: string;
  alias?: string;
  platform: string;
  openclawVersion: string;
  lastSeen: number;
  online: boolean;
  bridgeVersion?: string;
  upgradeAvailable?: boolean;
};

type OsTab = "macos" | "windows" | "ipad-ssh";

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
  return t ? { "x-spark-admin": t, "content-type": "application/json" } : { "content-type": "application/json" };
}

export default function DeployPage() {
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [err, setErr] = useState("");
  const [admin, setAdmin] = useState("");
  const [now, setNow] = useState(Date.now());

  const [osTab, setOsTab] = useState<OsTab>("macos");
  const [sshHost, setSshHost] = useState<"mac" | "linux">("mac");
  const [upgrading, setUpgrading] = useState("");
  const [upgradeLog, setUpgradeLog] = useState("");
  const [authErr, setAuthErr] = useState("");

  useEffect(() => {
    captureAdminFromUrl();
    setAdmin(localStorage.getItem("spark.admin") || "");
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (/Windows/i.test(navigator.userAgent)) setOsTab("windows");
    else if (/iPad|iPhone|Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) {
      setOsTab("ipad-ssh");
    }
  }, []);

  const saveAdmin = () => {
    localStorage.setItem("spark.admin", admin.trim());
  };

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/nodes", { cache: "no-store", headers: adminHeaders() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setAuthErr("");
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
  const macCmd = useMemo(() => {
    const c = code || "<PAIR_CODE>";
    return [
      `export SPARK_PAIR_CODE='${c}'`,
      `export SPARK_URL='${origin}'`,
      `export SPARK_INSECURE=1`,
      `curl -kfsSL "$SPARK_URL/install/macos.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh`,
    ].join("\n");
  }, [code, origin]);
  const linuxCmd = useMemo(() => {
    const c = code || "<PAIR_CODE>";
    return [
      `export SPARK_PAIR_CODE='${c}'`,
      `export SPARK_URL='${origin}'`,
      `curl -fsSL "$SPARK_URL/install/linux.sh" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh`,
    ].join("\n");
  }, [code, origin]);
  const sshPaste = sshHost === "mac" ? macCmd : linuxCmd;

  const saveAlias = async (nodeId: string, alias: string) => {
    const r = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}`, {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify({ alias }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || r.statusText);
    }
  };

  const copyAdminLink = () => {
    const t = admin.trim() || localStorage.getItem("spark.admin") || "";
    if (!t) {
      alert("Enter admin token first");
      return;
    }
    void navigator.clipboard.writeText(`${origin}/deploy?admin=${encodeURIComponent(t)}`);
  };

  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const nodeDisplay = (n: NodeInfo) => (n.alias?.trim() ? n.alias : n.hostname);

  const downloadInstaller = () => {
    if (!code) {
      setErr("Generate a pair code first");
      return;
    }
    if (osTab !== "macos" && osTab !== "windows") return;
    const path =
      osTab === "macos"
        ? `/install/spark-deploy.command?code=${encodeURIComponent(code)}`
        : `/install/spark-deploy.bat?code=${encodeURIComponent(code)}`;
    window.location.href = path;
  };

  const upgradeNode = async (nodeId: string) => {
    setUpgrading(nodeId);
    setUpgradeLog("");
    try {
      const r = await fetch("/api/control/upgrade", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ nodeId }),
      });
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
          if (ev === "error") throw new Error(data.error || "upgrade failed");
          setUpgradeLog(acc);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "upgrade failed");
    } finally {
      setUpgrading("");
      void refresh();
    }
  };

  const tabClass = (id: OsTab) =>
    `rounded-full px-3 py-1.5 text-sm ${osTab === id ? "bg-[var(--teal)] text-white" : "border border-[var(--line)]"}`;

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
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-3xl">Deploy OpenClaw</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Pair a Mac or Windows PC. From iPad, SSH into your Mac (or a Linux VPS). Commands run on that host — not inside iSH.
      </p>

      {authErr ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{authErr}</p>
      ) : null}

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
      <button type="button" className="mb-4 text-xs text-[var(--teal)] underline" onClick={copyAdminLink}>
        Copy admin link (for another PC)
      </button>

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
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={tabClass("macos")} onClick={() => setOsTab("macos")}>
              macOS
            </button>
            <button type="button" className={tabClass("windows")} onClick={() => setOsTab("windows")}>
              Windows
            </button>
            <button type="button" className={tabClass("ipad-ssh")} onClick={() => setOsTab("ipad-ssh")}>
              iPad / SSH
            </button>
          </div>

          {osTab === "macos" || osTab === "windows" ? (
            <>
              <button
                type="button"
                onClick={downloadInstaller}
                className="mt-4 rounded-full bg-[var(--teal)] px-5 py-2 text-sm font-semibold text-white"
              >
                Download {osTab === "macos" ? "Spark-Deploy.command" : "Spark-Deploy.bat"}
              </button>
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                {osTab === "macos"
                  ? "On the Mac: double-click the downloaded .command (or right-click → Open)."
                  : "On Windows: double-click the .bat file. If SmartScreen warns, More info → Run anyway."}
              </p>
              <details className="mt-4 text-xs text-[var(--ink-muted)]">
                <summary className="cursor-pointer">Advanced: copy command</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/80 p-3 text-[11px] text-green-200 whitespace-pre-wrap">
                  {osTab === "macos" ? macCmd : winCmd}
                </pre>
                <button
                  type="button"
                  className="mt-2 text-[var(--teal)] underline"
                  onClick={() => void navigator.clipboard.writeText(osTab === "macos" ? macCmd : winCmd)}
                >
                  Copy
                </button>
              </details>
            </>
          ) : null}

          {osTab === "ipad-ssh" ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-[var(--ink-muted)]">
                Most iPads do not have an SSH app yet. Step 1 installs free{" "}
                <strong>Termius</strong> from the App Store (Apple does not allow auto-install). Then open the
                one-tap installer — same role as Mac <code className="text-xs">.command</code> / Windows{" "}
                <code className="text-xs">.bat</code>. Bridge still runs on your Mac/VPS.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs ${sshHost === "mac" ? "bg-[var(--teal)] text-white" : "border border-[var(--line)]"}`}
                  onClick={() => setSshHost("mac")}
                >
                  Mac (SSH)
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs ${sshHost === "linux" ? "bg-[var(--teal)] text-white" : "border border-[var(--line)]"}`}
                  onClick={() => setSshHost("linux")}
                >
                  Linux VPS
                </button>
              </div>
              <a
                href="https://apps.apple.com/app/id549039908"
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full bg-[var(--teal)] px-5 py-2 text-sm font-semibold text-white"
              >
                1 · Install Termius (App Store)
              </a>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "termius://";
                }}
                className="ml-2 rounded-full border border-[var(--teal)] px-4 py-2 text-sm text-[var(--teal)]"
              >
                Open Termius
              </button>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/install/spark-deploy-ipad.html?code=${encodeURIComponent(code)}&target=${sshHost === "mac" ? "mac" : "linux"}`;
                  }}
                  className="rounded-full bg-[var(--teal)] px-5 py-2 text-sm font-semibold text-white"
                >
                  2 · Open one-tap installer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/install/spark-deploy-ipad.html?code=${encodeURIComponent(code)}&target=${sshHost === "mac" ? "mac" : "linux"}&download=1`;
                  }}
                  className="ml-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink-muted)]"
                >
                  Download .html
                </button>
              </div>
              <p className="text-xs text-[var(--ink-muted)]">
                In Termius: add your host once → on the installer page tap <strong>Copy install command</strong> →
                paste in that session. Shortcuts/Blink are optional under the installer page.
              </p>
              <details className="text-xs text-[var(--ink-muted)]">
                <summary className="cursor-pointer">Show command only</summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/80 p-3 text-[11px] text-green-200 whitespace-pre-wrap">
                  {sshPaste}
                </pre>
                <button
                  type="button"
                  className="mt-2 text-[var(--teal)] underline"
                  onClick={() => void navigator.clipboard.writeText(sshPaste)}
                >
                  Copy
                </button>
              </details>
            </div>
          ) : null}

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
              {nodeDisplay(n)} · {n.platform} · {n.openclawVersion || "openclaw?"}
              {n.bridgeVersion ? ` · bridge ${n.bridgeVersion}` : ""}
              {n.upgradeAvailable ? (
                <span className="ml-1 text-amber-700">needs upgrade</span>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="block w-full max-w-xs rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
                  placeholder="Alias…"
                  defaultValue={n.alias || ""}
                  onBlur={(e) => void saveAlias(n.nodeId, e.target.value).catch((ex) => setErr(String(ex)))}
                />
                <button
                  type="button"
                  disabled={!n.online || upgrading === n.nodeId || !n.bridgeVersion || n.platform === "ios"}
                  onClick={() => void upgradeNode(n.nodeId)}
                  className="rounded-full border border-[var(--teal)] px-3 py-1 text-xs text-[var(--teal)] disabled:opacity-40"
                  title={
                    n.platform === "ios"
                      ? "iOS uses App Store / TestFlight upgrade"
                      : !n.bridgeVersion
                        ? "Old Bridge — re-install"
                        : undefined
                  }
                >
                  {upgrading === n.nodeId
                    ? "Upgrading…"
                    : n.platform === "ios"
                      ? "App update"
                      : !n.bridgeVersion
                        ? "Re-install required"
                        : "Upgrade from server"}
                </button>
              </div>
              {upgrading === n.nodeId && upgradeLog ? (
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{upgradeLog}</p>
              ) : null}
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
