/**
 * Lightbox zoom constants and pure helpers.
 * All functions are deterministic → unit-testable without DOM.
 */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

/**
 * Clamp zoom to [ZOOM_MIN, ZOOM_MAX].
 * Rounds to nearest step quanta to keep display percentages tidy.
 */
export function clampZoom(z: number): number {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  // Round to nearest step
  const steps = Math.round(clamped / ZOOM_STEP);
  return Math.min(Math.max(ZOOM_MIN, steps * ZOOM_STEP), ZOOM_MAX);
}

export function zoomIn(z: number): number {
  return clampZoom(z + ZOOM_STEP);
}

export function zoomOut(z: number): number {
  return clampZoom(z - ZOOM_STEP);
}

/**
 * Format zoom as a percentage string.
 * Example: 1 → "100%", 1.25 → "125%", 4 → "400%"
 */
export function formatZoomPercent(z: number): string {
  const pct = clampZoom(z) * 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(0)}%`;
}
