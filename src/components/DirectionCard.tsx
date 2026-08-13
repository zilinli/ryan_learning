"use client";

import { useEffect, useState } from "react";
import {
  buildSelfDescription,
  clearCustomDescription,
  loadCustomDescription,
  saveCustomDescription,
} from "@/lib/direction-report";
import { loadInterests, type InterestRecord } from "@/lib/interest-store";
import type { CreationItem } from "@/lib/entertain/creations-store";

/**
 * P2-3 — quarterly direction report: a dynamic self-description card
 * ("Ryan · space explorer · becoming a filmmaker") generated from the
 * interest profile + creations. The child can edit it or regenerate it.
 */
export function DirectionCard({
  accountId,
  name,
  creations,
}: {
  accountId: string;
  name: string;
  creations: CreationItem[];
}) {
  const [interests, setInterests] = useState<InterestRecord[]>([]);
  const [custom, setCustom] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setInterests(loadInterests(accountId));
    setCustom(loadCustomDescription(accountId));
  }, [accountId]);

  const desc = buildSelfDescription(name, interests, creations);
  const headline = custom?.trim() || desc.line;

  const regenerate = () => {
    setDraft(desc.line);
    setCustom(desc.line);
    saveCustomDescription(accountId, desc.line);
  };

  const startEdit = () => {
    setDraft(headline);
    setEditing(true);
  };

  const save = () => {
    const text = draft.trim();
    if (!text) {
      clearCustomDescription(accountId);
      setCustom(null);
    } else {
      saveCustomDescription(accountId, text);
      setCustom(text);
    }
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--teal)]/10 via-[var(--surface)] to-[var(--coral)]/8 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--teal)]">
        Who I am right now
      </p>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={120}
            rows={2}
            aria-label="Your headline"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="min-h-10 rounded-full bg-[var(--action-bg)] px-4 text-[13px] font-semibold text-[var(--action-ink)]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-10 rounded-full border border-[var(--line)] px-4 text-[13px] font-medium text-[var(--ink-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold leading-snug tracking-tight text-[var(--ink)]">
            {headline}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            {desc.blurb}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startEdit}
              className="min-h-10 rounded-full border border-[var(--teal)]/45 bg-[var(--teal)]/12 px-3 text-[12px] font-semibold text-[var(--teal)]"
            >
              Edit it
            </button>
            <button
              type="button"
              onClick={regenerate}
              className="min-h-10 rounded-full border border-[var(--line)] px-3 text-[12px] font-medium text-[var(--ink-muted)]"
            >
              🎲 Surprise me
            </button>
          </div>
        </>
      )}
    </div>
  );
}
