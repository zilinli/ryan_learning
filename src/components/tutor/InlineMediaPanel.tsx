"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaKind } from "./InlineWritingPanel";

type Props = {
  kind: MediaKind;
  /** Raw draft (prose/idea) — structured into lyrics / visual prompt first. */
  draft: string;
  accountId: string;
  onClose: () => void;
  /** Back to writing (edit the draft) */
  onBack?: () => void;
};

type Phase =
  | { stage: "structure" }
  | { stage: "generating" }
  | { stage: "done"; url: string; mime?: string; provider?: string }
  | { stage: "error"; message: string };

const KIND_LABEL: Record<MediaKind, string> = {
  song: "A song",
  image: "A picture",
  video: "A video",
};

export function InlineMediaPanel({ kind, draft, accountId, onClose, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>({ stage: "structure" });
  const [title, setTitle] = useState("");
  const runIdRef = useRef(0);

  const run = useCallback(async () => {
    const id = ++runIdRef.current;
    setPhase({ stage: "structure" });
    setTitle((draft.split(/\n/)[0] || "").trim().slice(0, 60) || `My ${kind}`);
    try {
      // UI uses "song"; APIs use "music" | "image" | "video".
      const apiKind = kind === "song" ? "music" : kind;

      // 1) structure the draft into lyrics / visual prompt
      const structRes = await fetch("/api/writing-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "structure",
          draft,
          genre: "general",
          target: apiKind,
        }),
      });
      if (id !== runIdRef.current) return;
      const struct = (await structRes.json()) as {
        ok?: boolean;
        lyrics?: string;
        body?: string;
        caption?: string;
        prompt?: string;
        error?: string;
      };
      if (!structRes.ok || !struct.ok) {
        throw new Error(struct.error || "Could not shape your writing");
      }
      if (id !== runIdRef.current) return;
      setPhase({ stage: "generating" });

      // 2) generate via /api/studio/generate
      const genBody: Record<string, string> = {
        kind: apiKind,
        accountId,
        title: title || `My ${kind}`,
      };
      if (kind === "song") {
        genBody.lyrics = struct.lyrics || struct.body || draft;
        if (struct.caption) genBody.caption = struct.caption;
      } else {
        genBody.prompt = struct.prompt || struct.body || draft;
        if (struct.caption) genBody.caption = struct.caption;
      }
      const genRes = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genBody),
      });
      const data = (await genRes.json()) as {
        ok?: boolean;
        url?: string;
        audioUrl?: string;
        mediaId?: string;
        mimeType?: string;
        provider?: string;
        error?: string;
      };
      if (!genRes.ok || !data.ok) {
        throw new Error(
          data.error || (genRes.status === 503 ? "Media service not configured" : "Generation failed"),
        );
      }
      if (id !== runIdRef.current) return;
      setPhase({
        stage: "done",
        url: data.audioUrl || data.url || "",
        mime: data.mimeType,
        provider: data.provider,
      });
    } catch (e) {
      if (id !== runIdRef.current) return;
      setPhase({
        stage: "error",
        message: e instanceof Error ? e.message : "Generation failed",
      });
    }
  }, [kind, draft, accountId, title]);

  // Only run once per mounted draft+kind (no re-run on parent state churn)
  const startedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${kind}:${draft}`;
    if (startedRef.current === key) return;
    startedRef.current = key;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, draft, accountId]);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--teal)]/40 bg-[var(--surface)] shadow-[0_8px_28px_rgba(20,40,35,0.08)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--teal)]/8 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Making {KIND_LABEL[kind].toLowerCase()}
          </p>
          <p className="truncate text-xs text-[var(--ink-muted)]">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-9 rounded-lg border border-[var(--line)] px-2.5 text-xs text-[var(--ink-muted)] hover:border-[var(--teal)]/40 hover:text-[var(--teal)]"
            >
              Edit draft
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {phase.stage === "structure" || phase.stage === "generating" ? (
          <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--teal)] border-t-transparent" />
            <span>
              {phase.stage === "structure"
                ? "Shaping your words into a creation…"
                : "Generating… this can take a minute."}
            </span>
          </div>
        ) : null}

        {phase.stage === "error" ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--coral)]">{phase.message}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void run()}
                className="min-h-10 rounded-xl bg-[var(--teal)] px-4 text-[13px] font-semibold text-white"
              >
                Try again
              </button>
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-10 rounded-xl border border-[var(--line)] px-4 text-[13px] font-medium text-[var(--ink)]"
                >
                  Back to draft
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {phase.stage === "done" ? (
          <div className="space-y-3">
            {kind === "song" ? (
              <audio
                controls
                src={phase.url}
                className="w-full"
                preload="metadata"
              />
            ) : kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={phase.url}
                alt={title}
                className="max-h-72 w-full rounded-xl border border-[var(--line)] object-contain"
              />
            ) : (
              <video
                controls
                src={phase.url}
                className="max-h-72 w-full rounded-xl border border-[var(--line)]"
                preload="metadata"
              />
            )}
            <p className="text-[11px] text-[var(--teal)]">
              Saved to My Creations{phase.provider ? ` · ${phase.provider}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
