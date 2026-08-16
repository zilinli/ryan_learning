"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BasisCoachReport } from "@/lib/entertain/basis-writing";
import {
  buildWritingFixIssues,
  type WritingFixIssue,
} from "@/lib/entertain/basis-fix-session";
import type { ChatIntent } from "@/lib/intent-fence";
import { WritingCoachPanel } from "../WritingCoachPanel";
import { WritingFixDialogue } from "../WritingFixDialogue";
import { WritingMentorDialogue } from "../WritingMentorDialogue";

export type MediaKind = "song" | "image" | "video";

type Props = {
  accountId: string;
  /** Detected collab intent (fence payload) — used to seed the draft. */
  intent?: ChatIntent | null;
  /** Fallback draft when no intent text (last user message). */
  initialDraft?: string;
  onClose: () => void;
  /** Elevate to inline media generation (InlineMediaPanel). */
  onMakeMedia?: (kind: MediaKind, draft: string) => void;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InlineWritingPanel({
  accountId,
  intent,
  initialDraft,
  onClose,
  onMakeMedia,
}: Props) {
  const [draft, setDraft] = useState(
    () => intent?.text?.trim() || initialDraft?.trim() || "",
  );
  const [coachText, setCoachText] = useState<string | null>(null);
  const [report, setReport] = useState<BasisCoachReport | null>(null);
  const [fixIssues, setFixIssues] = useState<WritingFixIssue[]>([]);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [mentorSessionKey, setMentorSessionKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [journalSaving, setJournalSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const draftRef = useRef(draft);
  const accountIdRef = useRef(accountId);
  const coachGenRef = useRef(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  const wordCount = useMemo(() => {
    const trimmed = draft.trim();
    if (!trimmed) return 0;
    return trimmed.match(/[\p{L}\p{N}']+/gu)?.length || 0;
  }, [draft]);

  const runCoach = useCallback(async () => {
    const text = draftRef.current.trim();
    if (!text) {
      setError("Write a little first, then I can coach it.");
      return;
    }
    setBusy(true);
    setError(null);
    const gen = ++coachGenRef.current;
    try {
      const res = await fetch("/api/writing-studio/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "coach",
          draft: text,
          genre: "general",
          writingType: "free",
          target: "music",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        coach?: string;
        report?: BasisCoachReport;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Coach failed");
      if (gen !== coachGenRef.current) return;
      setCoachText(data.coach || null);
      if (data.report?.dimensions?.length) {
        setReport(data.report);
        setFixIssues(buildWritingFixIssues(text, data.report, 8));
      } else {
        setReport(null);
        setFixIssues([]);
      }
    } catch (e) {
      if (gen === coachGenRef.current) {
        setError(e instanceof Error ? e.message : "Coach failed");
      }
    } finally {
      if (gen === coachGenRef.current) setBusy(false);
    }
  }, []);

  const openMentor = useCallback(() => {
    setFixOpen(false);
    setMentorOpen(true);
    setMentorSessionKey((k) => k + 1);
  }, []);

  const openFix = useCallback(() => {
    if (!report) {
      setError("Coach first, then we can fix line by line.");
      return;
    }
    setMentorOpen(false);
    setFixOpen(true);
  }, [report]);

  const saveToJournal = useCallback(async () => {
    const body = draftRef.current.trim();
    if (!body) return;
    setJournalSaving(true);
    try {
      if (!journalId) {
        const res = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accountIdRef.current,
            date: todayKey(),
            body,
            title: body.split(/\n/)[0]?.trim().slice(0, 80) || undefined,
            writingType: "journal",
          }),
        });
        const data = (await res.json()) as { item?: { id?: string } };
        if (data.item?.id) setJournalId(data.item.id);
      } else {
        await fetch("/api/journal", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accountIdRef.current,
            id: journalId,
            body,
          }),
        });
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch {
      setError("Could not save to journal right now.");
    } finally {
      setJournalSaving(false);
    }
  }, [journalId]);

  const make = (kind: MediaKind) => {
    const text = draftRef.current.trim();
    if (!text) {
      setError("Write a little first, then I can turn it into something.");
      return;
    }
    onMakeMedia?.(kind, text);
  };

  const openFixCount =
    fixIssues.filter((i) => i.status === "open").length;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--teal)]/40 bg-[var(--surface)] shadow-[0_8px_28px_rgba(20,40,35,0.08)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--teal)]/8 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Writing Studio
          </p>
          <p className="truncate text-xs text-[var(--ink-muted)]">
            {wordCount} {wordCount === 1 ? "word" : "words"} · draft and coach right here
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void saveToJournal()}
            disabled={journalSaving || !draft.trim()}
            className="min-h-9 rounded-lg bg-[var(--teal)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--teal)]/90 active:scale-95 disabled:opacity-40"
          >
            {savedFlash ? "Saved ✓" : journalSaving ? "Saving…" : "Save to journal"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 rounded-lg px-2 text-xs text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          placeholder="Paste what you wrote, or start drafting here…"
          className="min-h-[8rem] w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/50 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[var(--teal)]"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runCoach()}
            disabled={busy || !draft.trim()}
            className="min-h-10 rounded-xl bg-[var(--teal)] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[var(--teal)]/90 active:scale-95 disabled:opacity-40"
          >
            {busy ? "Coaching…" : "Coach my writing"}
          </button>
          {report ? (
            <button
              type="button"
              onClick={openFix}
              disabled={openFixCount === 0}
              className="min-h-10 rounded-xl border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-3.5 text-[13px] font-semibold text-[var(--coral)] disabled:opacity-40"
            >
              Fix spots {openFixCount > 0 ? `· ${openFixCount}` : "· done"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openMentor}
            disabled={!draft.trim()}
            className="min-h-10 rounded-xl border border-[var(--teal)]/40 px-3.5 text-[13px] font-medium text-[var(--teal)] disabled:opacity-40"
          >
            Talk to Spark
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <p className="text-[11px] text-[var(--ink-muted)]">Make it into…</p>
          {(["song", "image", "video"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => make(kind)}
              disabled={!draft.trim()}
              className="min-h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--teal)]/40 hover:text-[var(--teal)] disabled:opacity-40"
            >
              {kind === "song" ? "A song" : kind === "image" ? "A picture" : "A video"}
            </button>
          ))}
        </div>

        {error ? (
          <p className="text-[12px] text-[var(--coral)]">{error}</p>
        ) : null}

        {report ? (
          <WritingCoachPanel
            report={report}
            fallbackText={coachText}
            scoreHistory={[]}
          />
        ) : null}

        {fixOpen ? (
          <div className="mt-2">
            <WritingFixDialogue
              issues={fixIssues}
              draft={draft}
              onIssuesChange={setFixIssues}
              onDraftChange={setDraft}
              onClose={() => setFixOpen(false)}
              onApplyEdit={(next) => {
                setDraft(next);
                setFixIssues((prev) =>
                  prev.map((i) =>
                    i.status === "open" ? { ...i, status: "fixed" as const } : i,
                  ),
                );
              }}
            />
          </div>
        ) : null}

        {mentorOpen ? (
          <div className="mt-2">
            <WritingMentorDialogue
              report={report}
              coachText={coachText}
              draft={draft}
              genre="general"
              target="music"
              sessionKey={mentorSessionKey}
              onDraftChange={setDraft}
              onClose={() => setMentorOpen(false)}
              onOpenSpotFixes={openFix}
              spotFixCount={openFixCount}
              issues={fixIssues}
              onIssuesChange={setFixIssues}
              onApplyEdit={(next) => {
                setDraft(next);
                setFixIssues((prev) =>
                  prev.map((i) =>
                    i.status === "open" ? { ...i, status: "fixed" as const } : i,
                  ),
                );
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
