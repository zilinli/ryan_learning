"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { withMediaDownloadParam } from "@/lib/entertain/creation-download";

type PublicCreation = {
  id: string;
  type: "song" | "video" | "image" | string;
  title: string;
  createdAt: number;
  caption?: string;
  lyrics?: string;
  mediaUrl: string;
};

export function ShareCreationClient({ token }: { token: string }) {
  const [item, setItem] = useState<PublicCreation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/creations/public/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          creation?: PublicCreation;
          error?: string;
        };
        if (!res.ok || !data.creation) {
          throw new Error(data.error || "Not found");
        }
        if (!cancelled) setItem(data.creation);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Not found");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="min-h-dvh bg-[#0f1a16] text-[#eef6f0]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 20% 0%, #2a4a3a 0%, transparent 55%), linear-gradient(165deg, #0f1a16 0%, #152820 50%, #0c1411 100%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8fb896]">
          Spark · Studio share
        </p>
        {error && (
          <p className="mt-8 text-sm text-[#e8a090]">
            {error === "Media missing" || error === "Not found"
              ? "This share link is missing or the file was removed."
              : error}
          </p>
        )}
        {!error && !item && (
          <p className="mt-8 text-sm text-[#a8b9ad]">Loading…</p>
        )}
        {item && (
          <>
            <p className="mt-6 text-[10px] uppercase tracking-wider text-[#a8b9ad]">
              {item.type === "song"
                ? "Song"
                : item.type === "video"
                  ? "Video"
                  : "Image"}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-[#f3faf5]">
              {item.title}
            </h1>
            {item.caption && (
              <p className="mt-2 text-sm text-[#b7c9bc]">{item.caption}</p>
            )}

            {item.type === "song" && (
              <audio
                controls
                playsInline
                preload="metadata"
                className="mt-8 w-full"
                src={item.mediaUrl}
              />
            )}
            {item.type === "video" && (
              <video
                controls
                playsInline
                preload="metadata"
                className="mt-8 w-full rounded-xl"
                src={item.mediaUrl}
              />
            )}
            {item.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.mediaUrl}
                alt={item.title}
                className="mt-8 w-full rounded-xl object-cover"
              />
            )}

            {item.lyrics && (
              <pre className="mt-6 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-[11px] leading-relaxed text-[#c4d4c8]">
                {item.lyrics}
              </pre>
            )}

            <div className="mt-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="min-h-11 rounded-xl bg-[#8fb896] px-4 text-sm font-semibold text-[#0f1a16]"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a
                href={withMediaDownloadParam(item.mediaUrl)}
                download
                className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-[#eef6f0]"
              >
                Download
              </a>
              <Link
                href="/studio"
                className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm text-[#c4d4c8]"
              >
                Open Studio
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
