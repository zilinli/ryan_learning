/**
 * Spark Help (AI FAQ) — read-only agent prompt.
 * Answers product questions from docs/ + src/; never edits the repo.
 */

export type FaqReplyLang =
  | "auto"
  | "en"
  | "zh"
  | "yue"
  | "ms"
  | "es"
  | "fr"
  | "teo"
  | "hak"
  | "sha";

const LANG_LINE: Record<Exclude<FaqReplyLang, "auto">, string> = {
  en: "Reply in clear English.",
  zh: "用简体中文（普通话书面语）回答。",
  yue: "用粤语书面习惯回答（可用繁体字）。",
  ms: "Jawab dalam Bahasa Melayu yang mudah difahami.",
  es: "Responde en español claro y sencillo.",
  fr: "Réponds en français clair et simple.",
  teo: "用闽南话书面习惯回答（可用汉字）。",
  hak: "用客家话书面习惯回答（可用汉字）。",
  sha: "用上海话书面习惯回答（可用汉字）。",
};

export const FAQ_AI_SYS = `You are **Spark Help** for the Spark AI Tutor app (repo: ryan_learning).

## Mission
Answer the user's product / how-to / troubleshooting question using **this repository** — design docs and code — as the source of truth.

## Tools (read-only)
You may use: read_file, search_code, list_files.
You MUST NOT edit, create, delete, commit, push, deploy, or run tests.

## Where to look (priority)
1. docs/DESIGN.md — map of subsystems
2. docs/subsystems/*.md — voice, FAQ panel, dictionary, multi-tenant, etc.
3. docs/TODO.md / README.md — status and overview
4. src/components/*, src/app/api/*, src/lib/* — confirm current behavior

## Answer style
- Concise (students / parents). Prefer short steps over essays.
- If unsure after searching, say what you checked and what is unknown.
- Mention UI labels users actually see (e.g. "EN English", "Listen", "Help & feedback").
- When helpful, cite a path like \`docs/subsystems/voice-tts-stt.md\` in backticks.
- Do not invent features that are not in the repo.
- Photos / screenshots / PDFs: read visible text and answer from that + the codebase.

## Safety
Never reveal API keys, tokens, or contents of .env* / data/ secrets.`;

export function buildFaqAiUserPrompt(params: {
  question: string;
  replyLang: FaqReplyLang;
  fileSummaries?: string[];
}): string {
  const { question, replyLang, fileSummaries = [] } = params;
  const langLine =
    replyLang === "auto"
      ? "Detect the language of the question (and any OCR text) and reply in that same language."
      : LANG_LINE[replyLang];

  const files =
    fileSummaries.length > 0
      ? `\n\n[Attached file notes]\n${fileSummaries.join("\n")}`
      : "";

  return [
    langLine,
    "",
    "Search docs/ and src/ as needed, then answer.",
    "",
    `[Question]\n${question.trim() || "(see attached image / file)"}`,
    files,
  ].join("\n");
}

export function normalizeFaqReplyLang(raw: string | null | undefined): FaqReplyLang {
  const v = (raw || "auto").trim().toLowerCase();
  if (
    v === "en" ||
    v === "zh" ||
    v === "yue" ||
    v === "ms" ||
    v === "es" ||
    v === "fr" ||
    v === "teo" ||
    v === "hak" ||
    v === "sha"
  ) {
    return v;
  }
  return "auto";
}
