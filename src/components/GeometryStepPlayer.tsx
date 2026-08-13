"use client";

/**
 * P3 — interactive geometry step player (report §8.7).
 * Renders a figure whose shapes dim step by step, with a measurement callout
 * showing "where the quantity is". Driven by the ```geom-steps JSON``` fence
 * that `geometrySpecToMarkdown` emits when the model supplies `steps`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildGeometryStepSvgs,
  describeGeometryShapes,
  sanitizeSvg,
  type GeometrySpec,
} from "@/lib/geometry-svg";
import { getSharedSpeechEngine } from "@/lib/speech-player";
import { ImageLightbox } from "./ImageLightbox";

type StepView = { caption: string; svg: string };

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(svg)))
  }`;
}

/** Parse the fence body into a geometry spec; null when malformed. */
export function parseGeometryStepsSpec(body: string): GeometrySpec | null {
  try {
    const parsed = JSON.parse(body) as Partial<GeometrySpec>;
    if (!Array.isArray(parsed.shapes) || !parsed.shapes.length) return null;
    if (!Array.isArray(parsed.steps) || !parsed.steps.length) return null;
    return parsed as GeometrySpec;
  } catch {
    return null;
  }
}

export function isGeometryStepsBody(body: string): boolean {
  return parseGeometryStepsSpec(body) != null;
}

export function GeometryStepPlayer({ body }: { body: string }) {
  const spec = useMemo(() => parseGeometryStepsSpec(body), [body]);
  const [active, setActive] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [zoom, setZoom] = useState(false);

  const views: StepView[] = useMemo(() => {
    if (!spec) return [];
    return buildGeometryStepSvgs(spec)
      .map((v) => ({ caption: v.caption, svg: sanitizeSvg(v.svg) || v.svg }))
      .filter((v) => v.svg);
  }, [spec]);

  useEffect(() => {
    setActive(0);
  }, [body]);

  useEffect(
    () => () => {
      getSharedSpeechEngine().stop();
    },
    [],
  );

  const speakStep = useCallback(() => {
    if (!views[active]) return;
    const engine = getSharedSpeechEngine();
    if (speaking) {
      engine.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    void engine.unlock().catch(() => undefined);
    engine
      .speak(views[active]!.caption, {
        voiceId: "auto",
        onError: () => setSpeaking(false),
      })
      .then(() => setSpeaking(false))
      .catch(() => setSpeaking(false));
  }, [speaking, views, active]);

  const step = spec?.steps?.[active];
  // P2-5 — current step's note + highlighted shape labels ("where the quantity is")
  const lookingAt = useMemo(
    () => (step ? describeGeometryShapes(spec, step.highlight) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, spec],
  );

  if (!spec || views.length < 2) return null;

  const go = (next: number) => {
    setActive(Math.max(0, Math.min(views.length - 1, next)));
  };

  return (
    <div className="my-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
          Step by step
        </p>
        <button
          type="button"
          onClick={speakStep}
          className={`min-h-9 rounded-lg px-2.5 text-[11px] font-semibold transition ${
            speaking
              ? "bg-[var(--coral)] text-white"
              : "text-[var(--teal)] hover:bg-[var(--teal)]/10"
          }`}
        >
          {speaking ? "Stop" : "Read aloud"}
        </button>
      </div>

      {/* Active figure */}
      <div className="tutor-diagram mt-2 !bg-[var(--surface)] !ring-[var(--line)]">
        <button
          type="button"
          className="tutor-diagram-view"
          onClick={() => setZoom(true)}
          aria-label="View larger diagram"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgDataUri(views[active]!.svg)}
            alt={views[active]!.caption}
            className="tutor-diagram-img animate-[fade-up_0.3s_ease]"
          />
        </button>
        <span className="tutor-diagram-zoom-hint" aria-hidden>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </span>
      </div>
      {zoom ? (
        <ImageLightbox
          src={svgDataUri(views[active]!.svg)}
          alt={views[active]!.caption}
          onClose={() => setZoom(false)}
        />
      ) : null}

      {/* P2-5 — "where the quantity is" callout (measurement note + shapes) */}
      {step && (step.note || lookingAt.length > 0) ? (
        <div className="mt-2 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/8 px-3 py-2">
          {step.note ? (
            <p className="text-[13px] font-semibold text-[var(--coral)]">
              {step.note}
            </p>
          ) : null}
          {lookingAt.length > 0 ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[var(--ink-muted)]">
              <span className="font-semibold uppercase tracking-wide">
                Where to look
              </span>
              {lookingAt.map((l) => (
                <span
                  key={l}
                  className="rounded-full border border-[var(--teal)]/35 bg-[var(--teal)]/10 px-2 py-0.5 font-medium text-[var(--teal)]"
                >
                  {l}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Caption */}
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink)]">
        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--teal)] text-[11px] font-bold text-white">
          {active}
        </span>
        {views[active]!.caption}
      </p>

      {/* Step dots + prev/next */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(active - 1)}
          disabled={active === 0}
          className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-medium disabled:opacity-40"
        >
          Prev
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {views.map((v, i) => (
            <button
              key={`${i}-${v.caption}`}
              type="button"
              onClick={() => go(i)}
              aria-label={v.caption}
              className={`h-2.5 rounded-full transition-all ${
                i === active
                  ? "w-6 bg-[var(--teal)]"
                  : "w-2.5 bg-[var(--line)] hover:bg-[var(--teal)]/50"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(active + 1)}
          disabled={active >= views.length - 1}
          className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-medium disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}