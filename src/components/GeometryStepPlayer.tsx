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
  sanitizeSvg,
  type GeometrySpec,
} from "@/lib/geometry-svg";
import { getSharedSpeechEngine } from "@/lib/speech-player";

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
      <div className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface)] ring-1 ring-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgDataUri(views[active]!.svg)}
          alt={views[active]!.caption}
          className="mx-auto w-full max-w-full"
        />
      </div>

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