"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ZOOM_MIN,
  ZOOM_STEP,
  zoomIn as zoomInFn,
  zoomOut as zoomOutFn,
  formatZoomPercent,
} from "@/lib/lightbox-zoom";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

/*
 * Overlay z-index ladder:
 *   z-10  — main chat column
 *   z-20  — desktop History sidebar
 *   z-30  — Code Agent panel (right drawer)
 *   z-40  — mobile sidebar overlay
 *   z-50  — Camera / PinGate / delete confirm modals
 *   z-80  — old ImageLightbox (trapped under z-20 ancestor)
 *   z-200 — new ImageLightbox (portalled to <body>)
 */

export function ImageLightbox({ src, alt, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const moveTotal = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => zoomInFn(z)), []);
  const zoomOut = useCallback(() => setZoom((z) => zoomOutFn(z)), []);
  const zoomReset = useCallback(() => {
    setZoom(ZOOM_MIN);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        zoomReset();
        return;
      }
    },
    [onClose, zoomIn, zoomOut, zoomReset],
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= ZOOM_MIN) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    moveTotal.current += Math.abs(dx) + Math.abs(dy);
    setOffset({
      x: dragRef.current.offsetX + dx,
      y: dragRef.current.offsetY + dy,
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setTimeout(() => {
      moveTotal.current = 0;
    }, 0);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && moveTotal.current < 5) {
      onClose();
    }
    moveTotal.current = 0;
  };

  const content = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Photo"}
      onClick={handleBackdropClick}
    >
      {/* Zoom toolbar — safe-area aware */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 p-3 pt-[max(env(safe-area-inset-top),12px)] sm:p-4">
        <div className="flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-2 py-1.5">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 disabled:opacity-30"
            aria-label="Zoom out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span className="min-w-[44px] text-center text-xs font-medium text-white tabular-nums" aria-live="polite">
            {formatZoomPercent(zoom)}
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= 4}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 disabled:opacity-30"
            aria-label="Zoom in"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur text-white/80 transition hover:bg-white/25"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Image area — pan when zoomed */}
      <div
        className="overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          cursor: zoom > ZOOM_MIN ? "grab" : "default",
          touchAction: zoom > ZOOM_MIN ? "none" : "auto",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || "Homework photo"}
          className="max-h-[min(92dvh,920px)] max-w-full rounded-lg object-contain shadow-2xl select-none"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
          style={{
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            transformOrigin: "center",
            transition: "transform 0.15s ease-out",
          }}
        />
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
