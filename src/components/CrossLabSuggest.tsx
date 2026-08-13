"use client";

import { useMemo } from "react";
import {
  LAB_GAME_PARAM,
  LAB_TITLES,
  suggestNextLab,
  type LabId,
} from "@/lib/cross-lab";

/**
 * P2-4 — a small "next lab" card shown while a piece is open in a Lab:
 * "Saw 'black hole' in TED — keep the thread going in NatGeo Lab."
 * Fits both the dark lab themes and the light Me/Dashboard surfaces.
 */
export function CrossLabSuggest({
  from,
  tags,
}: {
  from: LabId;
  tags: string[];
}) {
  const suggestion = useMemo(() => suggestNextLab(from, tags), [from, tags]);
  if (!suggestion) return null;
  return (
    <a
      href={`/studio?game=${LAB_GAME_PARAM[suggestion.to]}`}
      className="mx-auto mt-3 flex max-w-2xl items-start gap-3 rounded-xl border border-[#6db8a8]/40 bg-black/30 px-3 py-2.5 transition hover:border-[#6db8a8]"
    >
      <span aria-hidden className="text-base leading-none">
        🧭
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6db8a8]">
          Next stop · {LAB_TITLES[suggestion.to]}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[#c4b8a8]">
          {suggestion.line}
        </span>
      </span>
      <span aria-hidden className="self-center text-[#6db8a8]">
        →
      </span>
    </a>
  );
}
