"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreationItem } from "@/lib/entertain/creations-store";
import { creationDownloadUrl } from "@/lib/entertain/creation-download";
import {
  notifyCreationsChanged,
  subscribeCreationsChanged,
} from "@/lib/entertain/creations-sync";
import { useActiveStudioAccount } from "./StudioAccountBar";

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

function MissingHint({ kind }: { kind: "audio" | "image" | "video" }) {
  const label =
    kind === "audio" ? "Audio" : kind === "video" ? "Video" : "Image";
  return (
    <p className="mt-2 rounded-lg border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-2.5 py-2 text-[11px] leading-snug text-[var(--coral)]">
      {label} file missing on this server — generate again in Writing Studio, then
      delete this card.
    </p>
  );
}

function CreationAudio({
  mediaId,
  knownMissing,
}: {
  mediaId: string;
  knownMissing?: boolean;
}) {
  const [failed, setFailed] = useState(Boolean(knownMissing));
  useEffect(() => {
    setFailed(Boolean(knownMissing));
  }, [knownMissing, mediaId]);
  if (failed) return <MissingHint kind="audio" />;
  return (
    <audio
      controls
      playsInline
      preload="metadata"
      className="mt-3 w-full"
      src={`/api/media/${encodeURIComponent(mediaId)}`}
      onError={() => setFailed(true)}
    />
  );
}

function ShareButton({
  accountId,
  item,
  onShared,
}: {
  accountId: string;
  item: CreationItem;
  onShared: (next: CreationItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canShare =
    (item.type === "song" && item.audioMediaId && !item.audioMissing) ||
    ((item.type === "video" || item.type === "image") &&
      item.mediaId &&
      !item.mediaMissing);

  if (!canShare) return null;

  const share = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/creations/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, id: item.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        path?: string;
        item?: CreationItem;
        error?: string;
      };
      if (!res.ok || !data.path) throw new Error(data.error || "Share failed");
      if (data.item) onShared(data.item);
      const url = `${window.location.origin}${data.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setMsg("Link copied");
      } catch {
        setMsg(url);
      }
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: item.title,
            text: `Listen on Spark Studio: ${item.title}`,
            url,
          });
        } catch {
          /* user cancelled */
        }
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
      window.setTimeout(() => setMsg(null), 4000);
    }
  };

  const downloadHref = creationDownloadUrl(item);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void share()}
          className="min-h-9 rounded-lg border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-3 text-[11px] font-semibold text-[var(--teal)] disabled:opacity-40"
        >
          {busy ? "…" : "Share link"}
        </button>
        {downloadHref && (
          <a
            href={downloadHref}
            download
            className="inline-flex min-h-9 items-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--teal)]/40"
          >
            Download
          </a>
        )}
      </div>
      {msg && (
        <p className="mt-1 break-all text-[10px] text-[var(--ink-muted)]">{msg}</p>
      )}
    </div>
  );
}

export function CreationsLibrary() {
  const { accountId, name: accountName } = useActiveStudioAccount();
  const [items, setItems] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (silent) setSyncing(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/creations?accountId=${encodeURIComponent(accountId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          items?: CreationItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Load failed");
        setItems(data.items || []);
        setSyncedAt(Date.now());
        setError(null);
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (silent) setSyncing(false);
        else setLoading(false);
      }
    },
    [accountId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-sync while this page is open (quiet poll)
  useEffect(() => {
    const POLL_MS = 8000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Refresh when tab becomes visible / window focused
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [load]);

  // Instant refresh after Stage / TED save (same tab or another tab)
  useEffect(() => {
    return subscribeCreationsChanged((changedAcct) => {
      if (changedAcct && changedAcct !== accountId) return;
      void load({ silent: true });
    });
  }, [accountId, load]);

  // Keep "Updated Xs ago" label fresh
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      await fetch("/api/creations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, id }),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      notifyCreationsChanged(accountId);
      setSyncedAt(Date.now());
    },
    [accountId],
  );

  const brokenCount = items.filter(
    (i) => i.audioMissing || i.mediaMissing,
  ).length;

  void tick; // re-render for relative sync label
  const syncLabel = (() => {
    if (syncing) return "Syncing…";
    if (!syncedAt) return "Auto-sync on";
    const sec = Math.max(0, Math.round((Date.now() - syncedAt) / 1000));
    if (sec < 5) return "Updated just now";
    if (sec < 60) return `Updated ${sec}s ago`;
    return `Updated ${Math.round(sec / 60)}m ago`;
  })();

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
          {accountName}&apos;s library · auto-syncs every few seconds on this
          server
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex min-h-9 items-center rounded-full border border-[var(--teal)]/25 bg-[var(--teal)]/8 px-3 text-[11px] font-medium text-[var(--teal)]">
            {syncLabel}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Refresh now
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-auto px-4 py-6">
        {loading && (
          <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
        )}
        {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
        {!loading && brokenCount > 0 && (
          <p className="mb-4 rounded-xl border border-[var(--coral)]/25 bg-[var(--coral)]/8 px-3 py-2 text-[12px] text-[var(--coral)]">
            {brokenCount} item{brokenCount === 1 ? "" : "s"} have missing media
            files (older prune bug). Delete those cards and re-generate — new
            saves are protected.
          </p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-center text-sm text-[var(--ink-muted)]">
            Nothing saved yet. Finish a TED challenge or Writing Studio draft.
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
                    {item.type === "song"
                      ? "Song"
                      : item.type === "image"
                        ? "Image"
                        : item.type === "video"
                          ? "Video"
                          : "TED challenge"}
                    {(item.audioMissing || item.mediaMissing) && (
                      <span className="ml-1.5 rounded bg-[var(--coral)]/15 px-1.5 py-0.5 text-[var(--coral)]">
                        missing
                      </span>
                    )}
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
                    <CreationAudio
                      mediaId={item.audioMediaId}
                      knownMissing={item.audioMissing}
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
              {item.type === "image" && item.mediaId && (
                item.mediaMissing ? (
                  <MissingHint kind="image" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${encodeURIComponent(item.mediaId)}`}
                    alt={item.title}
                    className="mt-3 max-h-48 w-full rounded-lg object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                )
              )}
              {item.type === "video" && item.mediaId && (
                item.mediaMissing ? (
                  <MissingHint kind="video" />
                ) : (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="mt-3 w-full rounded-lg"
                    src={`/api/media/${encodeURIComponent(item.mediaId)}`}
                  />
                )
              )}
              {item.type === "ted_challenge" && item.challengeScore && (
                <p className="mt-2 text-xs text-[var(--teal)]">
                  {item.challengeScore}
                </p>
              )}
              <ShareButton
                accountId={accountId}
                item={item}
                onShared={(next) =>
                  setItems((prev) =>
                    prev.map((x) => (x.id === next.id ? { ...x, ...next } : x)),
                  )
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
