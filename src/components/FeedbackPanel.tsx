"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const FAQ_ITEMS = [
  {
    q: "What languages does Spark support?",
    a: "Spark supports English, Mandarin (普通话), Cantonese (粤语), Spanish, French, Malay (Bahasa Melayu), Shanghainese (上海话), Hokkien (闽南话), and Hakka (客家话). You can pick your voice in the sidebar.",
  },
  {
    q: "How does voice input work?",
    a: "Tap and hold the microphone button to record. Release to send. On desktop, click the mic to start, click again to stop. Your speech is transcribed using cloud AI (Alibaba DashScope / iFlytek) with a local fallback.",
  },
  {
    q: "Can I change the voice?",
    a: 'Yes — open the sidebar and tap the voice selector (e.g. "Auto (粤语优先)"). Pick from Ryan (British), Ava (American), Yunxi (Mandarin), WanLung (Cantonese), Álvaro (Spanish), Henri (French), Osman (Malay), Shanghainese, Hokkien, or Hakka.',
  },
  {
    q: "How do I translate a reply into English?",
    a: 'Under any finished tutor message, tap "EN English" next to Listen. Spark shows an English panel (tap Hide to collapse). Diagrams and code blocks are skipped so you get readable prose.',
  },
  {
    q: "How do I submit homework photos?",
    a: "Tap the camera icon to take a photo, or the paperclip icon to upload from your gallery. The AI will read the homework and coach you step by step.",
  },
  {
    q: "Is my data private?",
    a: "Your conversations are stored only on your device (localStorage) and optionally synced across your devices via Spark's own server. No third-party analytics. Voice data is sent to cloud STT services for transcription only.",
  },
  {
    q: "How do I switch accounts?",
    a: "Open the sidebar → tap your avatar / name at the top → select or create an account. Each account has separate conversation history, learning memory, and voice preferences.",
  },
];

type FeedbackCategory = "bug" | "feature" | "question" | "docs";

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    id: "bug",
    label: "Bug",
    hint: "Something broken",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="8" cy="8" r="5.25" />
        <path d="M8 5.5v3.2M8 10.6h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "feature",
    label: "Feature",
    hint: "New idea",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M8 2.5v11M2.5 8h11" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "question",
    label: "Question",
    hint: "Need help",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="8" cy="8" r="5.25" />
        <path d="M6.4 6.2a1.7 1.7 0 0 1 3.2.9c0 1.1-1.6 1.5-1.6 2.5M8 11.4h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "docs",
    label: "Docs",
    hint: "Clarify text",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M4.5 2.75h5.2L11.5 4.6v8.65H4.5V2.75Z" strokeLinejoin="round" />
        <path d="M9.5 2.75V4.6h1.95M6 7.25h4M6 9.5h4M6 11.75h2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<"faq" | "suggest">("faq");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    issueUrl?: string;
  } | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setTitle("");
    setDescription("");
    setCategory("feature");
    setTab("faq");
    setExpandedFaq(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open && tab === "suggest") {
      setTimeout(() => titleRef.current?.focus(), 120);
    }
  }, [open, tab]);

  const handleSubmit = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: t, description: d }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({
          ok: true,
          message: "Thanks — your feedback is on GitHub.",
          issueUrl: data.issueUrl,
        });
        setTitle("");
        setDescription("");
      } else {
        setResult({
          ok: false,
          message: data.error || "Something went wrong. Please try again.",
        });
      }
    } catch {
      setResult({
        ok: false,
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const panel = (
    <div
      className="flex h-full flex-col bg-[var(--surface)]"
      role="dialog"
      aria-modal="true"
      aria-label="Help and feedback"
    >
      {/* Header */}
      <div className="relative shrink-0 overflow-hidden border-b border-[var(--line)]/50 px-5 pb-4 pt-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--teal) 18%, transparent), transparent 55%), radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, var(--coral) 12%, transparent), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--teal)]/12 text-[var(--teal)] ring-1 ring-[var(--teal)]/20">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <circle cx="8" cy="8" r="5.5" />
                <path d="M6.2 6.3a1.9 1.9 0 0 1 3.6 1c0 1.2-1.8 1.6-1.8 2.7M8 11.6h.01" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
              Help & feedback
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
              Quick answers, or tell us what to improve.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--ink-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Segmented control */}
        <div
          className="relative mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1 ring-1 ring-[var(--line)]/60"
          role="tablist"
        >
          {([
            { id: "faq" as const, label: "FAQ" },
            { id: "suggest" as const, label: "Suggest" },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setResult(null);
              }}
              className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                tab === t.id
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]/70"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === "faq" ? (
          <div className="space-y-2 p-4">
            {FAQ_ITEMS.map((item, idx) => {
              const openItem = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className={`overflow-hidden rounded-xl border transition ${
                    openItem
                      ? "border-[var(--teal)]/25 bg-[color-mix(in_srgb,var(--teal)_6%,var(--surface))]"
                      : "border-[var(--line)]/55 bg-[var(--surface)] hover:border-[var(--line)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(openItem ? null : idx)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    aria-expanded={openItem}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                        openItem
                          ? "bg-[var(--teal)] text-white"
                          : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[var(--ink)]">
                      {item.q}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`shrink-0 text-[var(--ink-muted)] transition-transform duration-200 ${
                        openItem ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      openItem ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-[var(--line)]/40 px-3.5 pb-3.5 pt-2.5 text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setTab("suggest")}
              className="mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)]/60 px-3.5 py-3 text-left transition hover:border-[var(--teal)]/40 hover:bg-[var(--teal)]/5"
            >
              <span>
                <span className="block text-[13px] font-medium text-[var(--ink)]">
                  Still stuck?
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)]">
                  Send a suggestion — we review every issue.
                </span>
              </span>
              <span className="text-[12px] font-semibold text-[var(--teal)]">Suggest →</span>
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                Category
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => {
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-[var(--teal)]/45 bg-[color-mix(in_srgb,var(--teal)_8%,var(--surface))] shadow-sm"
                          : "border-[var(--line)]/60 bg-[var(--surface)] hover:border-[var(--line)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          active
                            ? "bg-[var(--teal)] text-white"
                            : "bg-[var(--surface-muted)] text-[var(--ink-muted)]"
                        }`}
                      >
                        {c.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-[var(--ink)]">
                          {c.label}
                        </span>
                        <span className="block text-[10.5px] text-[var(--ink-muted)]">{c.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="fb-title"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]"
              >
                Title <span className="normal-case tracking-normal text-[var(--coral)]">*</span>
              </label>
              <input
                ref={titleRef}
                id="fb-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of your idea or issue"
                maxLength={200}
                className="w-full rounded-xl border border-[var(--line)]/70 bg-[var(--bg0)]/35 px-3.5 py-2.5 text-[13px] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)]/55 focus:border-[var(--teal)]/55 focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--teal)]/20"
              />
            </div>

            <div>
              <label
                htmlFor="fb-desc"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]"
              >
                Details <span className="normal-case tracking-normal text-[var(--coral)]">*</span>
              </label>
              <textarea
                id="fb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, what you expected, and any steps to reproduce…"
                rows={6}
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-[var(--line)]/70 bg-[var(--bg0)]/35 px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)]/55 focus:border-[var(--teal)]/55 focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--teal)]/20"
              />
              <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-[var(--ink-muted)]/70">
                <span>Creates a public GitHub issue</span>
                <span>{description.length}/2000</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="group relative flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[var(--teal)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--teal)_70%,transparent)] transition hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28 10" />
                  </svg>
                  Submitting…
                </>
              ) : (
                <>
                  Submit feedback
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    <path d="M3.5 8h9M8.5 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>

            {result ? (
              <div
                className={`rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${
                  result.ok
                    ? "border-[var(--teal)]/30 bg-[color-mix(in_srgb,var(--teal)_10%,var(--surface))] text-[var(--ink)]"
                    : "border-[var(--coral)]/30 bg-[color-mix(in_srgb,var(--coral)_8%,var(--surface))] text-[var(--coral)]"
                }`}
              >
                <p className="font-medium">{result.message}</p>
                {result.issueUrl ? (
                  <a
                    href={result.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--teal)] underline-offset-2 hover:underline"
                  >
                    Open issue
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M6 3.5h6.5V10M12.5 3.5 3.5 12.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 hidden bg-[rgba(12,18,22,0.42)] backdrop-blur-[2px] lg:block"
        onClick={onClose}
        aria-hidden
      />

      <div className="fixed right-0 top-0 z-50 hidden h-dvh w-[min(420px,92vw)] border-l border-[var(--line)]/70 bg-[var(--surface)] shadow-[-18px_0_50px_-28px_rgba(0,0,0,0.35)] animate-slide-in-right lg:flex">
        {panel}
      </div>

      <div className="fixed inset-0 z-50 lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-[rgba(12,18,22,0.48)] backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col overflow-hidden rounded-t-[22px] bg-[var(--surface)] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.4)] animate-slide-up">
          <div className="flex justify-center pb-1 pt-2.5">
            <div className="h-1 w-9 rounded-full bg-[var(--line)]" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{panel}</div>
        </div>
      </div>
    </>
  );
}
