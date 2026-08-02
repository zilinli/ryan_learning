"use client";

import { useState } from "react";

type Props = {
  onConfigured: () => void;
};

export function SetupPanel({ onConfigured }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      onConfigured();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="animate-fade-up">
        <p className="font-[family-name:var(--font-display)] text-5xl text-[var(--ink)]">
          Spark
        </p>
        <p className="mt-3 text-[var(--ink-muted)] leading-relaxed">
          Paste a Cursor API Key once to finish setup.
        </p>
      </div>

      <div className="mt-8 space-y-3 rounded-2xl border border-[var(--line)] bg-white/80 p-5 shadow-[0_16px_50px_-28px_rgba(15,60,70,0.5)] backdrop-blur animate-fade-up-delay">
        <label className="block text-sm text-[var(--ink-muted)]">
          Cursor API Key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="crsr_... or cursor_..."
            className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
          />
        </label>
        <a
          href="https://cursor.com/dashboard/integrations"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm text-[var(--teal)] underline-offset-2 hover:underline"
        >
          Open Dashboard to create a key →
        </a>
        {error ? <p className="text-sm text-[var(--coral)]">{error}</p> : null}
        <button
          type="button"
          disabled={busy || !apiKey.trim()}
          onClick={save}
          className="w-full rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save & start"}
        </button>
      </div>
    </div>
  );
}
