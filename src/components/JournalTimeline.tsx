"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildTimeline,
  journalPromptForGrade,
  localDay,
  timelineMonths,
  timelineYears,
  type JournalEntry,
  type JournalMadeBlock,
  type TimelineDay,
} from "@/lib/entertain/journal-model";
import { useActiveStudioAccount } from "./StudioAccountBar";

function studioUrl(journalId: string): string {
  return `/studio?game=writing-studio&journal=${encodeURIComponent(journalId)}`;
}

function madeLabel(m: JournalMadeBlock): string {
  if (m.kind === "song") return `♪ ${m.title}`;
  if (m.kind === "image") return `🖼 ${m.title}`;
  if (m.kind === "video") return `▶ ${m.title}`;
  if (m.kind.includes("ted")) return `TED · ${m.title}`;
  if (m.kind.includes("natgeo")) return `NatGeo · ${m.title}`;
  return m.title;
}

function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, 1);
  return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function JournalTimeline({
  peek,
}: {
  /** Me hub: last few days only + Open all */
  peek?: boolean;
}) {
  const { accountId, name, grade } = useActiveStudioAccount();
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jumpMonth, setJumpMonth] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(localDay());

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/journal?accountId=${encodeURIComponent(accountId)}`,
      );
      const data = (await res.json()) as { ok?: boolean; items?: JournalEntry[] };
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(
    async (id: string, creationId?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/journal", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            id,
            ...(creationId ? { creationId } : {}),
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Could not delete");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete");
      } finally {
        setBusy(false);
      }
    },
    [accountId, load],
  );

  const days = useMemo(() => buildTimeline(items), [items]);
  const months = useMemo(() => timelineMonths(days), [days]);
  const years = useMemo(() => timelineYears(days), [days]);
  const prompt = journalPromptForGrade(grade);
  const visible = peek ? days.slice(0, 5) : days;
  const filtered = jumpMonth
    ? visible.filter((d) => d.month === jumpMonth)
    : visible;

  const createNew = async (
    date = newDate || localDay(),
    opts?: { openTodayIfExists?: boolean },
  ) => {
    if (opts?.openTodayIfExists) {
      const todayHit =
        items.find((e) => e.date === date && e.body.trim()) ||
        items.find((e) => e.date === date);
      if (todayHit) {
        window.location.href = studioUrl(todayHit.id);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          date,
          prompt,
          writingType: "journal",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; item?: { id: string }; error?: string };
      if (!res.ok || !data.item?.id) throw new Error(data.error || "Could not create");
      window.location.href = studioUrl(data.item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create");
      setBusy(false);
    }
  };

  return (
    <div className={peek ? "" : "mx-auto min-h-dvh max-w-3xl px-4 py-6"}>
      {!peek ? (
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Journal · 日记
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
              Timeline
            </h1>
            <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
              {name} · related records, newest first
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-[13px] font-medium leading-[2.75rem] text-[var(--ink)]"
            >
              Chat
            </a>
            <a
              href="/me"
              className="min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-[13px] font-medium leading-[2.75rem] text-[var(--ink)]"
            >
              Me
            </a>
          </div>
        </header>
      ) : (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
            Journal · Timeline
          </p>
          <a
            href="/me/journal"
            className="text-[12px] font-semibold text-[var(--teal)] hover:underline"
          >
            Open all
          </a>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <p className="text-[13px] text-[var(--ink-muted)]">{prompt}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createNew()}
            className="min-h-11 rounded-full bg-[var(--action-bg)] px-4 text-sm font-semibold text-[var(--action-ink)] disabled:opacity-40"
          >
            {busy ? "Opening…" : "+ New"}
          </button>
          {!peek ? (
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-muted)]">
              Date
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value || localDay())}
                className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 text-[13px] text-[var(--ink)]"
              />
            </label>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void createNew(localDay(), { openTodayIfExists: true })}
            className="min-h-11 rounded-full border border-[var(--teal)] px-4 text-sm font-medium text-[var(--teal)] disabled:opacity-40"
          >
            Write today
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-[var(--coral)]">{error}</p> : null}
      </div>

      {!peek && (years.length > 1 || months.length > 1) ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setJumpMonth(null)}
            className={`min-h-8 rounded-full px-3 text-[11px] font-semibold ${
              !jumpMonth
                ? "bg-[var(--teal)] text-white"
                : "border border-[var(--line)] text-[var(--ink-muted)]"
            }`}
          >
            All
          </button>
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setJumpMonth(m)}
              className={`min-h-8 rounded-full px-3 text-[11px] font-semibold ${
                jumpMonth === m
                  ? "bg-[var(--teal)] text-white"
                  : "border border-[var(--line)] text-[var(--ink-muted)]"
              }`}
            >
              {formatMonth(m)}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--ink-muted)]">
          Nothing yet. Tap New — one honest sentence is enough.
        </p>
      ) : (
        <ol className="relative border-l-2 border-[var(--teal)]/35 pl-5">
          {filtered.map((day) => (
            <TimelineDayBlock
              key={day.date}
              day={day}
              busy={busy}
              onDeleteEntry={(id) => void remove(id)}
              onDeleteMade={(entryId, creationId) =>
                void remove(entryId, creationId)
              }
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineDayBlock({
  day,
  busy,
  onDeleteEntry,
  onDeleteMade,
}: {
  day: TimelineDay;
  busy: boolean;
  onDeleteEntry: (id: string) => void;
  onDeleteMade: (entryId: string, creationId: string) => void;
}) {
  const related = day.entries.flatMap((e) => e.made);
  const prose = day.entries.filter((e) => e.body.trim());
  return (
    <li className="relative mb-6">
      <span
        className="absolute -left-[1.45rem] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--teal)] bg-[var(--surface)]"
        aria-hidden
      />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {formatDay(day.date)}
      </p>
      <div className="mt-2 space-y-2">
        {prose.map((e) => (
          <div
            key={e.id}
            className="group relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:border-[var(--teal)]/40"
          >
            <a
              href={studioUrl(e.id)}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
            >
              <p className="text-[11px] font-semibold text-[var(--teal)]">Wrote</p>
              <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">
                {e.title || e.body.slice(0, 72)}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] text-[var(--ink-muted)]">
                {e.body}
              </p>
            </a>
            <DeleteChip
              label="Delete entry"
              busy={busy}
              onConfirm={() => onDeleteEntry(e.id)}
            />
          </div>
        ))}
        {related.map((m, i) => {
          const entry = day.entries.find((e) =>
            e.made.some((x) => x.creationId === m.creationId && x.at === m.at),
          );
          const entryId = entry?.id || day.entries[0]?.id;
          return (
            <div
              key={`${m.creationId || m.at}-${i}`}
              className="group relative rounded-xl border border-[var(--line)]/80 bg-[var(--surface-muted)] p-3"
            >
              <p className="text-[11px] font-semibold text-[var(--ink-muted)]">
                Related
              </p>
              <p className="mt-0.5 pr-16 text-sm font-medium text-[var(--ink)]">
                {madeLabel(m)}
                {m.style ? (
                  <span className="ml-2 text-[11px] font-normal text-[var(--ink-muted)]">
                    {m.style}
                  </span>
                ) : null}
              </p>
              {m.bodySnapshot ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12px] text-[var(--ink-muted)]">
                  {m.bodySnapshot}
                </p>
              ) : null}
              {m.audioMediaId ? (
                <audio
                  className="mt-2 w-full"
                  controls
                  src={`/api/media/${m.audioMediaId}`}
                />
              ) : null}
              {m.mediaId && m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${m.mediaId}`}
                  alt={m.title}
                  className="mt-2 max-h-40 rounded-lg object-cover"
                />
              ) : null}
              {m.mediaId && m.kind === "video" ? (
                <video
                  className="mt-2 max-h-40 w-full rounded-lg"
                  controls
                  src={`/api/media/${m.mediaId}`}
                />
              ) : null}
              <a
                href="/studio?game=creations"
                className="mt-2 inline-block text-[11px] font-semibold text-[var(--teal)]"
              >
                Open in My Creations
              </a>
              {entryId && m.creationId ? (
                <DeleteChip
                  label="Remove from timeline"
                  busy={busy}
                  onConfirm={() => onDeleteMade(entryId, m.creationId!)}
                />
              ) : null}
            </div>
          );
        })}
        {!prose.length && !related.length ? (
          <div className="group relative rounded-xl border border-dashed border-[var(--line)] p-3">
            <a
              href={studioUrl(day.entries[0]!.id)}
              className="block text-sm text-[var(--ink-muted)]"
            >
              Empty day — tap to write
            </a>
            <DeleteChip
              label="Delete entry"
              busy={busy}
              onConfirm={() => onDeleteEntry(day.entries[0]!.id)}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Two-tap chip — first tap arms "Sure?", second tap confirms. */
function DeleteChip({
  label,
  busy,
  onConfirm,
}: {
  label: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  if (armed) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setArmed(false);
          onConfirm();
        }}
        className="absolute right-2 top-2 min-h-8 rounded-full bg-[var(--coral)] px-3 text-[11px] font-semibold text-white disabled:opacity-40"
      >
        Sure?
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setArmed(true);
      }}
      className="absolute right-2 top-2 min-h-8 min-w-8 rounded-full text-[var(--ink-muted)] opacity-0 transition hover:bg-[var(--mist)] hover:text-[var(--coral)] focus-visible:opacity-100 group-hover:opacity-100"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="3,6 5,6 21,6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
}
