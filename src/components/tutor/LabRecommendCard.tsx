"use client";

import type { LabRecommendation } from "@/lib/lab-recommend";

type Props = {
  recommendation: LabRecommendation;
  onDismiss: () => void;
};

/**
 * Main-chat lab recommendation card — "want to see a video on this?"
 * Renders at the same spot as creationOffer; navigating to the lab is a real
 * <a> so the round trip survives a full page load.
 */
export function LabRecommendCard({ recommendation, onDismiss }: Props) {
  return (
    <div className="mt-3 w-full max-w-md rounded-2xl border border-[var(--teal)]/45 bg-[var(--teal)]/8 px-4 py-3 text-left shadow-sm animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
        🎬 {recommendation.title}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">
        {recommendation.line}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
        Watch, take a challenge, then bring it back here to keep talking.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/studio?game=${recommendation.gameParam}`}
          className="inline-flex min-h-11 items-center rounded-xl bg-[var(--teal)] px-3 text-[13px] font-semibold text-white transition hover:bg-[var(--teal)]/90 active:scale-95"
        >
          Open {recommendation.title}
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-xl px-3 text-[13px] text-[var(--ink-muted)] underline-offset-2 hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
