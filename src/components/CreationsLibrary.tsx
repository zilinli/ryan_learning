"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreationItem } from "@/lib/entertain/creations-store";
import { RYAN_ACCOUNT } from "@/lib/tenant-storage";

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function CreationsLibrary() {
  const [items, setItems] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/creations?accountId=${encodeURIComponent(RYAN_ACCOUNT)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        items?: CreationItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Load failed");
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      await fetch("/api/creations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: RYAN_ACCOUNT, id }),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [],
  );

  return (
    <div className="flex flex-1 flex-col bg-[var(--surface-muted)]">
      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-5">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--coral)]">
          Studio · Library
        </p>
        <h2 className="mt-1 text-center text-2xl font-semibold text-[var(--ink)]">
          My Creations
        </h2>
        <p className="mt-1 text-center text-sm text-[var(--ink-muted)]">
          Songs and TED challenges you kept — private to this account.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-auto px-4 py-6">
        {loading && (
          <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
        )}
        {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
        {!loading && items.length === 0 && (
          <p className="text-center text-sm text-[var(--ink-muted)]">
            Nothing saved yet. Finish a TED challenge or Lyric Studio draft.
          </p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
                    {item.type === "song" ? "Song" : "TED challenge"}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  className="min-h-9 text-xs text-[var(--ink-muted)] hover:text-[var(--coral)]"
                >
                  Delete
                </button>
              </div>
              {item.type === "song" && (
                <>
                  <div
                    className="mt-3 flex h-8 items-end gap-0.5"
                    aria-hidden
                  >
                    {Array.from({ length: 32 }).map((_, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-sm bg-[var(--teal)]/40"
                        style={{ height: `${25 + ((i * 13) % 75)}%` }}
                      />
                    ))}
                  </div>
                  {item.audioMediaId ? (
                    <audio
                      controls
                      className="mt-3 w-full"
                      src={`/api/media/${item.audioMediaId}`}
                    />
                  ) : (
                    <p className="mt-2 text-[11px] text-[var(--ink-muted)]">
                      Lyrics only (no audio yet)
                    </p>
                  )}
                  {item.lyrics && (
                    <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--ink-muted)]">
                      {item.lyrics.slice(0, 400)}
                    </pre>
                  )}
                </>
              )}
              {item.type === "ted_challenge" && item.challengeScore && (
                <p className="mt-2 text-xs text-[var(--teal)]">
                  {item.challengeScore}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
