/**
 * Report-v3 R8 — cross-discipline “Spark!” moments (hidden fence + UI badge).
 */

const FENCE_RE = /~~~spark\s*\n?([\s\S]*?)\n?~~~/gi;

export type SparkMoment = {
  title: string;
  subjects?: string[];
};

export function parseSparkFence(text: string): SparkMoment | null {
  if (!text) return null;
  let last: SparkMoment | null = null;
  const re = new RegExp(FENCE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = (m[1] || "").trim();
    if (!body) {
      last = { title: "Spark connection" };
      continue;
    }
    try {
      const o = JSON.parse(body) as { title?: string; subjects?: string[] };
      last = {
        title: (o.title || "Spark connection").slice(0, 80),
        subjects: Array.isArray(o.subjects)
          ? o.subjects.filter((s) => typeof s === "string").slice(0, 4)
          : undefined,
      };
    } catch {
      last = { title: body.slice(0, 80) };
    }
  }
  return last;
}

export function stripSparkFence(text: string): string {
  return (text || "").replace(FENCE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function sparkPromptLines(): string[] {
  return [
    "",
    "[Cross-discipline Spark moments — Report-v3 R8]",
    "When you make a genuine cross-subject link (e.g. fractions + Ancient Egypt), you MAY emit a hidden fence:",
    "~~~spark",
    '{"title":"Fractions meet the pyramids","subjects":["math","humanities"]}',
    "~~~",
    "Do this at most once per reply; never force a link. The UI shows a small Spark badge — do not narrate the fence.",
  ];
}
