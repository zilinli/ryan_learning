/**
 * Per-dialect STT engine routing order.
 *
 * Instead of a single hardcoded "Bailian → iFlytek-on-failure → local" chain,
 * each language gets an ordered list of engines to try.
 *
 * Today: teo/hak both default to Bailian-first (matched by route.ts's current behavior).
 * After TEO.0 A/B eval: if iFlytek proves better for Teochew, override via env
 *   STT_ENGINE_ORDER_TEO=iflytek,bailian,local
 *
 * Design: [teochew-stt-remediation.md](../docs/subsystems/teochew-stt-remediation.md) §5
 */

export type SttEngine = "bailian" | "iflytek" | "local";

const DEFAULT_ORDER: Record<string, SttEngine[]> = {
  teo: ["bailian", "iflytek", "local"],
  hak: ["bailian", "iflytek", "local"],
};

/** Languages that support multi-engine quality routing (dialect-only for now). */
const MULTI_ENGINE_LANGS = new Set(["teo", "hak"]);

/**
 * Return the ordered list of STT engines to try for a given language.
 *
 * - Dialect languages (teo/hak): walks the list, allows trying next engine even
 *   when the previous one returned text (quality routing, not just outage recovery).
 * - Non-dialect languages: returns the standard Bailian → local fallback,
 *   short-circuiting on first success (current outage-recovery behavior).
 *
 * Can be overridden at runtime via STT_ENGINE_ORDER_{LANG} env var
 * (comma-separated list of "bailian", "iflytek", "local").
 */
export function sttEngineOrder(lang: string): SttEngine[] {
  const raw = process.env[`STT_ENGINE_ORDER_${lang.toUpperCase()}`];
  if (raw) {
    const order = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is SttEngine =>
        s === "bailian" || s === "iflytek" || s === "local",
      );
    if (order.length > 0) return order;
  }
  return DEFAULT_ORDER[lang] ?? ["bailian", "local"];
}

/**
 * Whether a language should use quality-routing (try-next on non-empty text)
 * instead of outage-recovery (stop on first success).
 */
export function isMultiEngineLang(lang: string): boolean {
  return MULTI_ENGINE_LANGS.has(lang);
}
