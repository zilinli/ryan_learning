/**
 * CA-5 — Scratch-work vision fence (hidden from child UI).
 */

export type ScratchDiagnosis = {
  badStep: number;
  totalSteps: number;
  hint: string;
};

const FENCE_RE = /~~~scratch-diagnosis\s*\n([\s\S]*?)\n~~~/gi;

export function parseScratchDiagnosisFence(
  text: string,
): ScratchDiagnosis | null {
  if (!text) return null;
  let last: ScratchDiagnosis | null = null;
  const re = new RegExp(FENCE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[1]?.trim();
    if (!body) continue;
    try {
      const o = JSON.parse(body) as Partial<ScratchDiagnosis>;
      const badStep = Math.floor(Number(o.badStep));
      const totalSteps = Math.floor(Number(o.totalSteps));
      const hint = typeof o.hint === "string" ? o.hint.trim() : "";
      if (
        Number.isFinite(badStep) &&
        badStep >= 1 &&
        Number.isFinite(totalSteps) &&
        totalSteps >= badStep &&
        hint
      ) {
        last = {
          badStep,
          totalSteps,
          hint: hint.slice(0, 160),
        };
      }
    } catch {
      /* ignore */
    }
  }
  return last;
}

export function stripScratchDiagnosisFence(text: string): string {
  if (!text) return text;
  return text
    .replace(FENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function scratchDiagnosisPromptLines(hasImages: boolean): string[] {
  if (!hasImages) {
    return [
      "",
      "[Scratch-work — CA-5]",
      "Invite typed steps or a photo of notebook work. Coach the off-track step; do not rewrite their whole solution.",
    ];
  }
  return [
    "",
    "[Scratch-work vision — CA-5]",
    "If the photo shows student working (numbered steps / scratch):",
    "1) Locate the first off-track step.",
    "2) Emit a hidden fence (never explain the fence to the student):",
    "~~~scratch-diagnosis",
    '{"badStep":2,"totalSteps":4,"hint":"Check place value when adding tenths"}',
    "~~~",
    "3) Then coach at L2.5 around that step — second chance before stronger scaffold.",
    "4) Do not give the final answer unless parent check mode is on.",
  ];
}
