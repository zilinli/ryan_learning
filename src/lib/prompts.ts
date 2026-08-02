import type { HistoryTurn } from "./types";
import {
  replyLangFromVoice,
  replyLanguageInstructions,
  type ReplyLangMode,
} from "./voices";

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

function audienceLine(mode: ReplyLangMode): string {
  if (mode === "zh") {
    return "Audience: student who wants tutoring mainly in Mandarin Chinese.";
  }
  if (mode === "yue") {
    return "Audience: student who wants tutoring mainly in Cantonese (粤语).";
  }
  if (mode === "es") {
    return "Audience: student who wants tutoring mainly in Spanish.";
  }
  if (mode === "en") {
    return "Audience: international-school student; reply in English.";
  }
  return "Audience: international-school student; follow their language (Auto mode).";
}

function styleLine(mode: ReplyLangMode): string {
  if (mode === "zh") {
    return "Style: 温暖有耐心的中文老师 — 苏格拉底式引导，简短，适合手机和语音朗读。";
  }
  if (mode === "yue") {
    return "Style: 温暖有耐心嘅粤语老师 — 引导式、简短，适合手机同语音朗读。";
  }
  if (mode === "es") {
    return "Style: profesor paciente en español — socrático, breve, apto para móvil y voz.";
  }
  return "Style: warm AI teacher — Socratic, encouraging, short enough for phone + TTS.";
}

function findThisCue(mode: ReplyLangMode): string {
  if (mode === "zh") return "**找到这里**";
  if (mode === "yue") return "**睇呢度**";
  if (mode === "es") return "**Mira aquí**";
  return "**Find this**";
}

function defaultStudentLine(mode: ReplyLangMode, hasHomework: boolean): string {
  if (!hasHomework) {
    if (mode === "zh") return "请帮帮我。";
    if (mode === "yue") return "请帮吓我。";
    if (mode === "es") return "Ayúdame por favor.";
    return "Please help me.";
  }
  if (mode === "zh") return "请看我的作业，一步一步教我。";
  if (mode === "yue") return "请睇吓我嘅功课，一步一步教我。";
  if (mode === "es") return "Por favor mira mi tarea y ayúdame paso a paso.";
  return "Please look at my homework and help me understand it step by step.";
}

export function buildTutorPrompt(params: {
  userText: string;
  imageCount: number;
  fileSummaries?: string[];
  history?: HistoryTurn[];
  /** Voice picker id or reply lang mode */
  replyLanguage?: ReplyLangMode | string;
  voiceId?: string;
}): string {
  const { userText, imageCount, fileSummaries = [], history } = params;
  const hasHomework = imageCount > 0 || fileSummaries.length > 0;

  const mode: ReplyLangMode =
    params.replyLanguage === "auto" ||
    params.replyLanguage === "en" ||
    params.replyLanguage === "zh" ||
    params.replyLanguage === "yue" ||
    params.replyLanguage === "es"
      ? params.replyLanguage
      : replyLangFromVoice(params.voiceId || params.replyLanguage);

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

  const cue = findThisCue(mode);
  const formatRules = [
    "",
    "[Reply format — rendered as Markdown + LaTeX in the app]",
    "- Use Markdown when it helps (short lists, **bold** for key terms, headings sparingly).",
    "- Maths: ALWAYS write formulas in LaTeX so they render clearly.",
    "  Inline: $x^2$, $\\frac{a}{b}$, $\\sqrt{2}$",
    "  Display: $$\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$",
    "- Reading comprehension / passage questions: ALWAYS show WHERE to look BEFORE the hint:",
    "  Use a Markdown blockquote with Photo + location, then the exact quote, e.g.",
    '  > From Photo 1, paragraph 2: "…exact words…"',
    `  Then a short cue like: ${cue} — then your micro-hint in the required reply language.`,
    "- Quote the student's EXACT words from the photo/PDF (short, 1–2 sentences max).",
    "- Do not dump long passages; only the evidence slice the student needs now.",
  ];

  const homeworkCoach = hasHomework
    ? [
        "",
        "[Homework coach — Doubao Aixue / AI老师 style]",
        "If this looks like schoolwork (reading comprehension, maths, science, worksheets):",
        "1) First identify the subject and question type.",
        "2) HIGHLIGHT the source with a Markdown blockquote so they look at the right place.",
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
    audienceLine(mode),
    styleLine(mode),
    "Do not edit files or run commands.",
    ...replyLanguageInstructions(mode),
    ...mediaLines,
    ...formatHistory(history),
    ...formatRules,
    homeworkCoach,
    "",
    "[Student message]",
    userText.trim() || defaultStudentLine(mode, hasHomework),
  ].join("\n");
}
