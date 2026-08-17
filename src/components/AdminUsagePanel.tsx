"use client";

/**
 * Admin usage panel — per-account LLM usage & cost. Guarded by ADMIN_TOKEN
 * (entered once, kept in sessionStorage).
 */

import { useEffect, useMemo, useState } from "react";

type UsageSummary = {
  allTime: {
    totals: { turns: number; inputTokens: number; outputTokens: number; costUsd: number };
  };
  last30d: {
    totals: { turns: number; inputTokens: number; outputTokens: number; costUsd: number };
  };
  byAccount: Array<{
    accountId: string;
    turns: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    lastActive: string;
  }>;
};

const TOKEN_KEY = "spark.adminToken";

function fmtUsd(v: number): string {
  return `$${v.toFixed(4)}`;
}
function fmtTokens(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

export function AdminUsagePanel() {
  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usage?token=${encodeURIComponent(t)}`);
      const body = (await res.json()) as
        | (UsageSummary & { ok: boolean })
        | { ok: false; error: string };
      if (!res.ok || !body.ok) {
        setError("error" in body ? body.error : "Failed to load usage");
        return;
      }
      setData(body as UsageSummary);
      try {
        sessionStorage.setItem(TOKEN_KEY, t);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) void load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => data?.byAccount ?? [], [data]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
        Usage &amp; Cost
      </h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Per-account LLM usage across all devices. Estimates only.
      </p>

      {!data ? (
        <form
          className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void load(token);
          }}
        >
          <label className="block text-sm font-medium text-[var(--ink)]">
            Admin token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--teal)]"
          />
          {error ? (
            <p className="mt-2 text-sm text-[var(--coral)]">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !token}
            className="mt-3 rounded-xl bg-[var(--action-bg)] px-4 py-2 text-sm font-medium text-[var(--action-ink)] disabled:opacity-40"
          >
            {loading ? "Loading…" : "View usage"}
          </button>
        </form>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Turns (all time)" value={String(data.allTime.totals.turns)} />
            <Metric label="Cost (all time)" value={fmtUsd(data.allTime.totals.costUsd)} />
            <Metric label="Turns (30d)" value={String(data.last30d.totals.turns)} />
            <Metric label="Cost (30d)" value={fmtUsd(data.last30d.totals.costUsd)} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-[var(--ink-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 text-right font-medium">Turns</th>
                  <th className="px-3 py-2 text-right font-medium">In tokens</th>
                  <th className="px-3 py-2 text-right font-medium">Out tokens</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.accountId} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 text-[var(--ink)]">{r.accountId}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.turns}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtTokens(r.inputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtTokens(r.outputTokens)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-muted)]">
                      {r.lastActive}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--ink-muted)]">
                      No usage recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
      <p className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--ink)]">{value}</p>
    </div>
  );
}
