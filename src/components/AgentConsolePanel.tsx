"use client";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ACC_URL = `http://${typeof window !== "undefined" ? window.location.hostname : "65.49.201.123"}:3001/`;

export function AgentConsolePanel({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open) return null;

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-base">🤖</span>
        <span className="text-sm font-semibold text-[var(--ink)]">Code Agent</span>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={ACC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full px-3 py-1 text-[11px] font-medium text-[var(--teal)] hover:bg-[var(--teal)]/10"
          title="Open in new tab"
        >
          ↗ New tab
        </a>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--mist)]"
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );

  const frame = (
    <iframe
      src={ACC_URL}
      title="Agent Chat Console"
      className="h-full w-full border-0"
      loading="lazy"
    />
  );

  return (
    <>
      {/* Desktop: slide-in panel from right */}
      <div className="hidden lg:block">
        <div className="fixed right-0 top-0 z-30 flex h-dvh w-[min(520px,45vw)] flex-col border-l border-[var(--line)] bg-[var(--bg0)] shadow-2xl animate-slide-in-left">
          {header}
          <div className="min-h-0 flex-1">{frame}</div>
        </div>
      </div>

      {/* Mobile / tablet: bottom sheet */}
      <div className="fixed inset-0 z-30 lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-[rgba(10,28,34,0.45)]"
          onClick={onClose}
          aria-label="Close panel"
        />
        <div className="absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl bg-[var(--bg0)] shadow-2xl animate-slide-up">
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-[var(--line)]" />
          </div>
          {header}
          <div className="min-h-0 flex-1">{frame}</div>
        </div>
      </div>
    </>
  );
}
