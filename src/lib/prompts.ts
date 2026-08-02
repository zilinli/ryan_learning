import type { HistoryTurn } from "./types";

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 500;

function formatHistory(history?: HistoryTurn[]): string[] {
  if (!history?.length) return [];
  const turns = history.slice(-MAX_HISTORY_TURNS).map((t) => {
    const role = t.role === "user" ? "Student" : "Tutor";
    const text = t.content.replace(/\s+/g, " ").trim().slice(0, MAX_HISTORY_CHARS);
    return `${role}: ${text}`;
  });
  return ["", "[Recent chat — continue this thread]", ...turns];
}

export function buildTutorPrompt(params: {
  userText: string;
  imageCount: number;
  fileSummaries?: string[];
  history?: HistoryTurn[];
}): string {
  const { userText, imageCount, fileSummaries = [], history } = params;
  const hasHomework = imageCount > 0 || fileSummaries.length > 0;

  const mediaLines: string[] = [];
  if (imageCount > 0) {
    mediaLines.push(
      `The student attached ${imageCount} photo(s)/image(s) (Photo 1…Photo ${imageCount}). Treat them as pages/parts of the same worksheet when they belong together.`,
    );
  }
  if (fileSummaries.length > 0) {
    mediaLines.push("Document text extracted from uploads:");
    for (const s of fileSummaries) mediaLines.push(s);
  }

  const formatRules = [
    "",
    "[Reply format — rendered as Markdown + LaTeX in the app]",
    "- Use Markdown when it helps (short lists, **bold** for key terms, headings sparingly).",
    "- Maths: ALWAYS write formulas in LaTeX so they render clearly.",
    "  Inline: $x^2$, $\\frac{a}{b}$, $\\sqrt{2}$",
    "  Display: $$\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$",
    "- Reading comprehension / passage questions: ALWAYS show WHERE to look BEFORE the hint:",
    "  Use a Markdown blockquote that starts with Photo + location, then the exact quote, e.g.",
    "  > From Photo 1, paragraph 2: \"The river froze overnight, so the boats could not leave.\"",
    "  or",
    "  > From Photo 1, lines near the question stem: \"Which word best replaces …\"",
    "  Quote the student's EXACT words from the photo/PDF (short, 1–2 sentences max).",
    "- After the quote, add one short line like: **Find this** in the passage, then your micro-hint.",
    "- Do not dump long passages; only the evidence slice the student needs now.",
  ];

  const homeworkCoach = hasHomework
    ? [
        "",
        "[Homework coach — Doubao Aixue / AI老师 style]",
        "If this looks like schoolwork (reading comprehension, maths, science, worksheets):",
        "1) First identify the subject and question type.",
        "2) HIGHLIGHT the source with a Markdown blockquote (see format rules) so they look at the right place in their photo.",
        "3) Ask which part is confusing (or which sub-question a/b/c to start with).",
        "4) Guide ONE micro-step only, then wait. Do not jump ahead.",
        "5) For reading comprehension: locate evidence (quote it), then help them paraphrase — do not dump the model answer.",
        "6) For maths: restate given/asked with LaTeX, suggest the next operation, let them compute.",
        "7) NEVER give the final answer / completed blanks first. Full solution only if they explicitly ask after trying.",
        "8) Keep replies short for phone + voice: source quote + one focus question + one hint.",
      ].join("\n")
    : [
        "",
        "Keep it conversational. If a problem appears, still guide step by step—no final answer upfront.",
        "Use LaTeX for any maths, and blockquotes when pointing at text the student shared.",
      ].join("\n");

  return [
    "[Tutor context]",
    "Audience: international-school student; English first language.",
    "Style: warm AI teacher — simple English, Socratic, encouraging, like a patient classroom tutor.",
    "Do not edit files or run commands.",
    ...mediaLines,
    ...formatHistory(history),
    ...formatRules,
    homeworkCoach,
    "",
    "[Student message]",
    userText.trim() ||
      (hasHomework
        ? "Please look at my homework and help me understand it step by step."
        : "Please help me."),
  ].join("\n");
}
