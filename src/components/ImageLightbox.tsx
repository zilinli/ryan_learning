"use client";

import { useEffect, useCallback } from "react";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

/** Full-screen homework photo viewer (tap outside / Esc / Close to dismiss). */
export function ImageLightbox({ src, alt, onClose }: Props) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onKey]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Photo"}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 min-h-11 min-w-11 rounded-full bg-white/95 px-3 text-sm font-medium text-[var(--ink)] shadow sm:right-5 sm:top-5"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        Close
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || "Homework photo"}
        className="max-h-[min(92dvh,920px)] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}
