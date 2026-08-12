"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  clientToCropNorm,
  compressImageDataUrl,
  cropImageDataUrl,
  rectFromDrag,
  type CropRectNorm,
} from "@/lib/image-process";

type Props = {
  open: boolean;
  dataUrl: string;
  mimeType?: string;
  onCancel: () => void;
  onDone: (payload: {
    dataUrl: string;
    mimeType: string;
    data: string;
  }) => void;
};

/**
 * After camera/gallery — drag a rectangle to send only the question region.
 * "整页" keeps the full compressed photo.
 * Mobile: stage uses dvh + safe-area so the preview fits above actions.
 */
export function PhotoCropModal({
  open,
  dataUrl,
  mimeType = "image/jpeg",
  onCancel,
  onDone,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<CropRectNorm>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });
  const drag = useRef<{
    startX: number;
    startY: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRect({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  }, [open, dataUrl]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const clientToNorm = useCallback((clientX: number, clientY: number) => {
    const el = imgRef.current;
    if (!el) return { x: 0, y: 0 };
    return clientToCropNorm(el.getBoundingClientRect(), clientX, clientY);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = clientToNorm(e.clientX, e.clientY);
    drag.current = { startX: p.x, startY: p.y };
    setRect({ x: p.x, y: p.y, w: 0.02, h: 0.02 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    e.preventDefault();
    const p = clientToNorm(e.clientX, e.clientY);
    setRect(rectFromDrag(drag.current.startX, drag.current.startY, p.x, p.y));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    drag.current = null;
  };

  const finish = async (full: boolean) => {
    setBusy(true);
    try {
      const out = full
        ? await compressImageDataUrl(dataUrl, mimeType)
        : await cropImageDataUrl(dataUrl, rect, mimeType);
      onDone(out);
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex h-dvh max-h-dvh flex-col bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label="Crop homework photo"
    >
      <div className="safe-top flex shrink-0 items-center justify-between gap-2 px-3 py-3 text-white">
        <p className="text-sm font-medium">框选要问的题目</p>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg px-3 text-sm opacity-90"
        >
          Cancel
        </button>
      </div>
      {/*
        Stage must shrink (min-h-0) so the image never uses a fixed 70vh that
        overflows under the action row on phones with URL-bar / home indicator.
      */}
      <div className="relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-3">
        <div
          className="relative max-h-full max-w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={dataUrl}
            alt="Homework to crop"
            className="block max-h-full max-w-full object-contain"
            draggable={false}
          />
          <div
            className="pointer-events-none absolute border-2 border-[var(--teal)] bg-[var(--teal)]/15"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="safe-bottom flex shrink-0 flex-wrap justify-center gap-2 px-3 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish(true)}
          className="min-h-12 rounded-full border border-white/40 px-5 text-sm font-medium text-white"
        >
          整页
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void finish(false)}
          className="min-h-12 rounded-full bg-[var(--teal)] px-5 text-sm font-semibold text-white"
        >
          {busy ? "…" : "只用框选"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
