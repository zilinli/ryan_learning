"use client";

import { useEffect, useRef, useState } from "react";

const FAQ_ITEMS = [
  {
    q: "What languages does Spark support?",
    a: "Spark supports English, Mandarin (普通话), Cantonese (粤语), Spanish, French, Malay (Bahasa Melayu), Shanghainese (上海话), Hokkien (闽南话), and Hakka (客家话). You can pick your voice in the sidebar.",
  },
  {
    q: "How does voice input work?",
    a: 'Tap and hold the microphone button to record. Release to send. On desktop, click the mic to start, click again to stop. Your speech is transcribed using cloud AI (Alibaba DashScope / iFlytek) with a local fallback.',
  },
  {
    q: "Can I change the voice?",
    a: "Yes — open the sidebar and tap the voice selector (e.g. \"Auto (粤语优先)\"). Pick from Ryan (British), Ava (American), Yunxi (Mandarin), WanLung (Cantonese), Álvaro (Spanish), Henri (French), Osman/Yasmin (Malay), Shanghainese, Hokkien, or Hakka.",
  },
  {
    q: "How do I submit homework photos?",
    a: 'Tap the camera icon 📷 to take a photo, or the paperclip icon to upload from your gallery. The AI will read the homework and coach you step by step.',
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

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<"faq" | "suggest">("faq");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Suggest form
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
    setExpandedFaq(null);
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
      setTimeout(() => titleRef.current?.focus(), 100);
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
          message: "Thank you for your feedback!",
          issueUrl: data.issueUrl,
        });
      } else {
        setResult({ ok: false, message: data.error || "Something went wrong. Please try again." });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const panel = (
    <div
      className="flex h-full flex-col bg-[var(--bg0)]"
      role="dialog"
      aria-label="FAQ and Feedback"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)]/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">💡 FAQ / Feedback</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)]"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-[var(--line)]/40">
        {(["faq", "suggest"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setResult(null); }}
            className={`flex-1 px-4 py-2 text-xs font-semibold transition ${
              tab === t
                ? "border-b-2 border-[var(--teal)] text-[var(--teal)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {t === "faq" ? "📖 FAQ" : "💬 Suggest"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "faq" ? (
          <div className="divide-y divide-[var(--line)]/30">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx}>
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--surface-muted)]"
                >
                  <span className="pr-2 text-xs font-medium text-[var(--ink)]">{item.q}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`shrink-0 text-[var(--ink-muted)] transition-transform ${
                      expandedFaq === idx ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
                {expandedFaq === idx ? (
                  <div className="px-4 pb-3">
                    <p className="text-xs leading-relaxed text-[var(--ink-muted)]">{item.a}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <form
            className="flex flex-col gap-4 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {/* Category */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["bug", "🐛 Bug"],
                  ["feature", "✨ Feature"],
                  ["question", "❓ Question"],
                  ["docs", "📖 Docs"],
                ] as [FeedbackCategory, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCategory(val)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                      category === val
                        ? "border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]"
                        : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="fb-title" className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]">
                Title <span className="text-[var(--coral)]">*</span>
              </label>
              <input
                ref={titleRef}
                id="fb-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of your idea…"
                maxLength={200}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="fb-desc" className="mb-1 block text-[11px] font-semibold text-[var(--ink-muted)]">
                Description <span className="text-[var(--coral)]">*</span>
              </label>
              <textarea
                id="fb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your suggestion or issue in detail. The more context, the better!"
                rows={5}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--teal)] focus:outline-none focus:ring-1 focus:ring-[var(--teal)]"
              />
              <p className="mt-1 text-right text-[10px] text-[var(--ink-muted)]/60">
                {description.length}/2000
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[var(--teal)] px-4 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="30 8" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit to GitHub"
              )}
            </button>

            {/* Result */}
            {result ? (
              <div
                className={`rounded-lg border px-3 py-2.5 text-xs ${
                  result.ok
                    ? "border-[var(--teal)]/30 bg-[var(--teal)]/10 text-[var(--teal)]"
                    : "border-[var(--coral)]/30 bg-[var(--coral)]/5 text-[var(--coral)]"
                }`}
              >
                <p>{result.message}</p>
                {result.issueUrl ? (
                  <a
                    href={result.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                  >
                    View issue →
                  </a>
                ) : null}
              </div>
            ) : null}
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--line)]/60 px-4 py-2">
        <p className="text-center text-[10px] text-[var(--ink-muted)]/60">
          Submissions create public GitHub issues.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 hidden bg-[rgba(10,28,34,0.35)] lg:block"
        onClick={onClose}
        aria-hidden
      />

      {/* Desktop: slide-in from right */}
      <div className="fixed right-0 top-0 z-50 hidden h-dvh w-[min(400px,90vw)] border-l border-[var(--line)] bg-[var(--bg0)] shadow-2xl animate-slide-in-right lg:flex">
        {panel}
      </div>

      {/* Mobile: bottom sheet */}
      <div className="fixed inset-0 z-50 lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-[rgba(10,28,34,0.45)]"
          onClick={onClose}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl bg-[var(--bg0)] shadow-2xl animate-slide-up">
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-[var(--line)]" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{panel}</div>
        </div>
      </div>
    </>
  );
}
