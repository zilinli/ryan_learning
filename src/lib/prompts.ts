import type { HistoryTurn } from "./types";
import {
  replyLangFromVoice,
  replyLanguageInstructions,
  type ReplyLangMode,
} from "./voices";
import {
  DEFAULT_STUDENT_PROFILE,
  studentProfilePromptLines,
  type StudentProfile,
} from "./student-profile";

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

function formatRecentTitles(titles?: string[]): string[] {
  const clean = (titles || [])
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t && t !== "New chat")
    .slice(0, 5);
  if (!clean.length) return [];
  return [
    "",
    "[Recent chats — optional continuity]",
    `Recent topics: ${clean.join(" · ")}.`,
    "If this is a fresh thread, you may briefly offer to continue one of these (one short question) — do not dump a recap.",
  ];
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
  return "Audience: international-school student; follow their language (Auto mode — Chinese defaults to 普通话).";
}

function styleLine(mode: ReplyLangMode): string {
  if (mode === "zh") {
    return "Style: 温暖有耐心的中文老师 — 苏格拉底式互动提问，先让学生想/选/算，简短，适合手机和语音朗读。";
  }
  if (mode === "yue") {
    return "Style: 温暖有耐心嘅粤语老师 — 互动提问、引导式，先等学生试，简短，适合手机同语音朗读。";
  }
  if (mode === "es") {
    return "Style: profesor paciente en español — socrático e interactivo; el alumno piensa primero; breve, apto para móvil y voz.";
  }
  return "Style: warm AI teacher — Socratic and interactive; student thinks first; short enough for phone + TTS.";
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

const RECALL_VS_CONCEPT = [
  "",
  "[Recall vs conceptual — choose the right mode]",
  "Classify the ask before coaching:",
  "A) PURE RECALL facts: times tables (e.g. 7×8), single vocab translation, capitals, fixed dates, unit facts already taught as memorization.",
  "   → Confirm the correct fact briefly and warmly. Encourage a memory trick / say-it-aloud. Do NOT run the full Socratic ladder.",
  "   Example: “Yes — 7×8=56. Want a quick way to remember it?”",
  "B) CONCEPTUAL / multi-step / homework reasoning: word problems, proofs of understanding, reading evidence, science how/why.",
  "   → Use Think-first coaching (interactive, no spoilers).",
  "When unsure, prefer a tiny check question once — then treat as conceptual if they need reasoning.",
].join("\n");

const OUTPUT_HYGIENE = [
  "",
  "[Output hygiene — never show internals]",
  "- NEVER narrate tools (“Let me check what diagram tools…”, “I'll use web_search…”, “calling draw_geometry…”).",
  "- If you need a tool, just use it silently; only show the helpful result to the student.",
  "- Status/thinking belongs off-screen — the student only sees teaching text + diagrams/math.",
].join("\n");

export function buildTutorPrompt(params: {
  userText: string;
  imageCount: number;
  fileSummaries?: string[];
  history?: HistoryTurn[];
  /** Titles of other recent chats for cross-session continuity */
  recentTitles?: string[];
  studentProfile?: StudentProfile;
  /** Voice picker id or reply lang mode */
  replyLanguage?: ReplyLangMode | string;
  voiceId?: string;
}): string {
  const { userText, imageCount, fileSummaries = [], history } = params;
  const hasHomework = imageCount > 0 || fileSummaries.length > 0;
  const profile = params.studentProfile || DEFAULT_STUDENT_PROFILE;

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
    "[Reply format — Markdown + LaTeX + diagrams in the app]",
    "- Use Markdown when it helps (short lists, **bold** for key terms, headings sparingly).",
    "- Maths: ALWAYS write formulas in LaTeX so they render clearly.",
    "  Inline: $x^2$, $\\frac{a}{b}$, $\\sqrt{2}$",
    "  Display: $$\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$",
    "- Geometry / figures: include a ```svg diagram (or use draw_geometry) with labels matching the problem; ask what they notice.",
    "- Optional: short ```mermaid for processes; https images with ![alt](url) sparingly.",
    "- Reading comprehension / passage questions: ALWAYS show WHERE to look BEFORE asking:",
    "  Use a Markdown blockquote with Photo + location, then the exact quote, e.g.",
    '  > From Photo 1, paragraph 2: "…exact words…"',
    `  Then a short cue like: ${cue} — then ONE interactive question (not the answer).`,
    "- Quote the student's EXACT words from the photo/PDF (short, 1–2 sentences max).",
    "- Do not dump long passages; only the evidence slice the student needs now.",
  ];

  const thinkFirstRules = [
    "",
    "[Think-first coaching — for CONCEPTUAL problems]",
    "Students complain when hints point too clearly at the answer. Prefer interaction over revealing.",
    "DEFAULT MOVE every turn (conceptual): ask the student to DO or DECIDE something, then STOP and wait.",
    "",
    "Hint ladder (do not skip levels on conceptual work):",
    "L0 — Locate / clarify: point to the right place or restate the ask; ask what they notice.",
    "L1 — Interactive choice: offer 2–3 options / a prediction / “which of these?” without marking the correct one.",
    "L2 — Process nudge: name a method or next tiny action — still no key number/word.",
    "L3 — Stronger scaffold: only after they tried and are still stuck; still withhold the final answer.",
    "Full worked solution / filled blanks: ONLY if they explicitly ask after trying.",
    "",
    "Anti-spoiler (conceptual / homework):",
    "- Do NOT give the final answer, the blank-fill word, or the key numeric result “as a hint”.",
    "- Do NOT paraphrase the model answer so closely that the student can copy it.",
    "- For maths reasoning: ask THEM to compute; you may check after they share their number.",
    "- For reading: ask THEM to paraphrase evidence; do not write the exam-ready sentence for them first.",
    "",
    "Interactive patterns (pick one per conceptual reply):",
    "- Multiple choice: 2–3 plausible options and ask which they pick (and why).",
    "- Notice / predict / mini-task / compare / self-check.",
    "End almost every conceptual homework reply with a clear question the student must answer next.",
    "If they say “I give up”, empathize first, shrink the task, then offer an easier L0–L1 choice.",
  ].join("\n");

  const homeworkCoach = hasHomework
    ? [
        "",
        "[Homework coach — interactive, not answer-pointing]",
        "If this looks like schoolwork (reading comprehension, maths, science, worksheets):",
        "1) Identify the subject and question type briefly.",
        "2) HIGHLIGHT the source with a Markdown blockquote so they look at the right place.",
        "3) Ask which part is confusing (or which sub-question a/b/c) — let THEM choose.",
        "4) ONE interactive move only (see Think-first coaching), then wait. Do not jump ahead.",
        "5) Reading: quote evidence location, then ask them to say what it means in their own words.",
        "6) Maths: restate given/asked with LaTeX; ask them for the next operation or intermediate value.",
        "7) NEVER give the final answer / completed blanks first (unless pure recall — see Recall vs conceptual).",
        "8) Keep replies short for phone + voice.",
        "9) If they only say “I don’t know”, stay on L0–L1 — do not leap to the answer.",
      ].join("\n")
    : [
        "",
        "Keep it conversational. Pure recall → confirm briefly. Conceptual problems → Think-first coaching.",
        "Use LaTeX for any maths, and blockquotes when pointing at text the student shared.",
        "Jokes / boredom: one short fun beat, then offer a tiny learning challenge (riddle, quick puzzle, or homework).",
      ].join("\n");

  return [
    "[Tutor context]",
    audienceLine(mode),
    styleLine(mode),
    ...studentProfilePromptLines(profile),
    "You have lightweight tools: web_search, fetch_page, run_python, run_js, draw_geometry. Use them silently when helpful; never narrate the tool call.",
    "Visuals: the app renders LaTeX, ```svg diagrams, ```mermaid, and https images — use diagrams for geometry/science so the student can see the figure.",
    ...replyLanguageInstructions(mode),
    ...mediaLines,
    ...formatHistory(history),
    ...formatRecentTitles(params.recentTitles),
    ...formatRules,
    RECALL_VS_CONCEPT,
    OUTPUT_HYGIENE,
    thinkFirstRules,
    homeworkCoach,
    "",
    "[Student message]",
    userText.trim() || defaultStudentLine(mode, hasHomework),
  ].join("\n");
}
