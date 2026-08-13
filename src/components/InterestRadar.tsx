"use client";

import { useEffect, useState } from "react";
import {
  buildCuriosityMap,
  hydrateInterestsFromServer,
  loadInterests,
  recentInterests,
  type InterestRecord,
} from "@/lib/interest-store";

/**
 * P1-3 (report §9.1.1) — interest radar + "this week's curiosity map".
 * Shows the interests the child actually chose to explore, plus a headline
 * that names the strongest curiosity thread, so the profile "grows visibly".
 */
export function InterestRadar({
  accountId,
  className = "",
}: {
  accountId: string;
  className?: string;
}) {
  const [interests, setInterests] = useState<InterestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setInterests(loadInterests(accountId));
    void hydrateInterestsFromServer(accountId).then((rows) => {
      if (!cancelled) setInterests(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    if (interests.length === 0 && !loading) return;
    setLoading(false);
  }, [interests, loading]);

  if (loading) return null;
  if (interests.length === 0) return null;

  const top = [...interests].sort(
    (a, b) => b.count - a.count || b.exploredAt - a.exploredAt,
  );
  const radarWords = top.slice(0, 5);
  const maxCount = Math.max(1, ...top.slice(0, 5).map((i) => i.count));
  const map = buildCuriosityMap(interests);
  const recent = recentInterests(accountId, 1)[0];

  return (
    <div
      className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          Interest radar
        </p>
        <p className="text-[10px] text-[var(--ink-muted)]">
          {interests.length} spark{interests.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {radarWords.map((i) => (
          <div
            key={i.topicId}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--teal)]/25 bg-[var(--teal)]/6 px-2.5 py-2"
            title={`Explored ${i.count} time${i.count === 1 ? "" : "s"}`}
          >
            <span className="text-base leading-none" aria-hidden>
              {i.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium leading-tight text-[var(--ink)]">
                {i.label}
              </span>
              <span
                className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--mist)]"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-[var(--teal)]"
                  style={{
                    width: `${Math.max(12, Math.round((i.count / maxCount) * 100))}%`,
                  }}
                />
              </span>
            </span>
          </div>
        ))}
      </div>

      {map ? (
        <div className="mt-3 rounded-xl border border-[var(--coral)]/25 bg-[var(--coral)]/6 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--coral)]">
            This week&apos;s curiosity map
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--ink)]">
            {map.headline}
          </p>
          {map.words.length > 1 ? (
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              {map.words.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {recent ? (
        <p className="mt-3 text-[11px] text-[var(--ink-muted)]">
          Last explored: {recent.emoji} {recent.label}
        </p>
      ) : null}
    </div>
  );
}
