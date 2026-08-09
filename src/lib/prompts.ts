import type { HistoryTurn } from "./types";
import {
  replyLangFromVoice,
  replyLanguageInstructions,
  type ReplyLangMode,
} from "./voices";
import {
  RYAN_PROFILE,
  curriculumPromptLines,
  studentProfilePromptLines,
  type GradeBand,
  type StudentProfile,
} from "./student-profile";
import {
  learningMemoryPromptLines,
  detectConfidenceMismatch,
  type LearningMemory,
} from "./learning-memory";
import type { EngagementState } from "./engagement";
import { scratchDiagnosisPromptLines } from "./scratch-diagnosis";
import { misconceptionPromptLines } from "./misconceptions";
import {
  isRepresentation,
  multiRepPromptLines,
  pickForcedRepresentation,
  type Representation,
} from "./multi-rep";

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 500;

// ── Age-Adaptive Language Presets (Phase 12B) ─────────────────────

/** Coaching language tuned to developmental stage — same hint ladder, different vocabulary. */
export type LanguagePreset = {
  confirm: string;
  encourage: string;
  stuck: string;
  error: string;
  thinkAloud: string;
};

export function languageForBand(band: GradeBand): LanguagePreset {
  switch (band) {
    case "early":
      return {
        confirm: "Yes! You got it!",
        encourage: "Keep going — you're doing great!",
        stuck: "Let's try together",
        error: "Almost! Want to try again?",
        thinkAloud: "Can you tell me what you're thinking?",
      };
    case "elementary":
      return {
        confirm: "That's correct",
        encourage: "Great thinking!",
        stuck: "What do you notice about...",
        error: "That's not quite right — let's look again",
        thinkAloud: "Walk me through what you're thinking",
      };
    case "middle":
      return {
        confirm: "Correct",
        encourage: "Good — keep reasoning",
        stuck: "Consider the relationship between...",
        error: "Re-examine your approach",
        thinkAloud: "Explain your reasoning step by step",
      };
    case "high":
      return {
        confirm: "That works",
        encourage: "Sound logic",
        stuck: "What assumptions are you making?",
        error: "Review step 3 — there's an error",
        thinkAloud: "Walk me through your proof",
      };
  }
}

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
  if (mode === "fr") {
    return "Audience: student who wants tutoring mainly in French.";
  }
  if (mode === "en") {
    return "Audience: international-school student; reply in English.";
  }
  return "Audience: international-school student; follow their language (Auto mode — Chinese defaults to 粤语 / 广东话).";
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
  if (mode === "fr") {
    return "Style: professeur patient en français — socratique et interactif ; l'élève réfléchit d'abord ; court, adapté au téléphone et à la voix.";
  }
  return "Style: warm AI teacher — Socratic and interactive; student thinks first; short enough for phone + TTS.";
}

function findThisCue(mode: ReplyLangMode): string {
  if (mode === "zh") return "**找到这里**";
  if (mode === "yue") return "**睇呢度**";
  if (mode === "es") return "**Mira aquí**";
  if (mode === "fr") return "**Regarde ici**";
  return "**Find this**";
}

function defaultStudentLine(mode: ReplyLangMode, hasHomework: boolean): string {
  if (!hasHomework) {
    if (mode === "zh") return "请帮帮我。";
    if (mode === "yue") return "请帮吓我。";
    if (mode === "es") return "Ayúdame por favor.";
    if (mode === "fr") return "Aide-moi s'il te plaît.";
    return "Please help me.";
  }
  if (mode === "zh") return "请看我的作业，一步一步教我。";
  if (mode === "yue") return "请睇吓我嘅功课，一步一步教我。";
  if (mode === "es") return "Por favor mira mi tarea y ayúdame paso a paso.";
  if (mode === "fr") return "S'il te plaît, regarde mon devoir et aide-moi étape par étape.";
  return "Please look at my homework and help me understand it step by step.";
}

const RECALL_VS_CONCEPT = [
  "",
  "[Recall vs conceptual vs computation — choose the right mode]",
  "Classify the ask before coaching:",
  "A) PURE RECALL facts: single times-table facts (e.g. 7×8), single vocab translation, capitals, fixed dates, unit facts taught as memorization.",
  "   → Confirm the correct fact briefly and warmly. Encourage a memory trick / say-it-aloud. Do NOT run the full Socratic ladder.",
  "   Example: “Yes — 7×8=56. Want a quick way to remember it?”",
  "B) CONCEPTUAL / multi-step / homework reasoning: fractions, word problems, proofs of understanding, reading evidence, science how/why.",
  "   → Use Think-first coaching (interactive, no spoilers).",
  "C) MEDIUM COMPUTATION (multi-digit ÷ or × that needs decomposition / place value — e.g. 256÷8, 432÷6, 48×17):",
  "   → HINT FIRST on turn 1: one scaffold only (break into friendly parts / related fact). Do NOT dump the final quotient/product on the first reply.",
  "   Example opener: “Can you break 256 into parts that 8 divides easily? (Hint: 8×30=240…) What is left?”",
  "   → After the student tries — or is clearly stuck after that hint — confirm/correct with a short check and warm praise.",
  "   Times-table singles stay in A. Fraction / word-problem reasoning stays in B.",
  "When unsure between B and C, prefer a tiny hint/check once — never leap to the final number on turn 1 for multi-digit work.",
].join("\n");

function subjectCoachingLines(band?: GradeBand): string {
  const lang = languageForBand(band || "elementary");
  const mathFractionHint =
    band === "early" ? "Fractions: use concrete objects (cookies, blocks, pizza slices). Keep it visual and hands-on." :
    band === "middle" ? "Fractions: extend to rational numbers, ratios, and proportional reasoning." :
    band === "high" ? "Fractions: rational functions, asymptotes, complex fraction operations." :
    "Fractions: anchor to «same-size pieces», not just rules. Use food or sharing metaphors (G4–G5 accessible).";

  return [
    "",
    "[Subject-specific coaching — math / reading / science / writing]",
    "",
    "► MATH:",
    "- Always use LaTeX for equations, numbers, and symbols.",
    "- For word problems: restate given/asked, draw Singapore bar models when helpful.",
    `- Hint ladder: ${lang.stuck} → (2) 「what should we find?」→ (3) 「can you draw it?」→ (4) scaffold a similar-but-simpler problem.`,
    "- For mental math: offer estimation first, then precise calculation.",
    `- ${mathFractionHint}`,
    "- Praise the process — not just the answer — especially when they self-correct.",
    "",
    "► READING / COMPREHENSION:",
    "- Point to text with blockquotes. Never give an interpretation without the evidence.",
    `- Ask: «which sentence tells you that?» before any conclusion. ${lang.thinkAloud}.`,
    "- When the answer is explicit in the text: confirm and ask «can you find another clue?»",
    "- When the answer requires inference: scaffold with «what do you already know about…?» then «what does the text add?»",
    "- Vocabulary: define with context first, not a dictionary dump. Ask them to invent their own sentence.",
    "",
    "► SCIENCE:",
    "- Connect to something they've seen or touched («remember when you dropped both balls?»).",
    "- Use «what if…?» to probe understanding. Invite small predictions.",
    "- Diagrams via draw_geometry for models / cycles / comparisons.",
    "- Avoid jargon unless they've heard it — define in simple words first.",
    "",
    "► WRITING:",
    "- Focus on one paragraph or one paragraph element at a time (topic sentence today, details tomorrow, conclusion next).",
    "- Give a tiny specific tip («start your sentence with the subject»), not a rewrite.",
    "- Ask them to read their sentence aloud — catches many issues faster than rereading.",
    "- Praise specific choices: «nice verb here», «good detail about the dog's ears».",
    "",
    "► MIXED / UNKNOWN:",
    "- Ask «is this math, reading, science, or writing?» then switch to the right mode.",
    "Progressive disclosure: when showing step-by-step work, wrap each step in a",
    "`~~~step` code fence (numbered), so the UI can reveal them one at a time.",
    "",
  ].join("\n");
}

function crossDisciplineLines(): string {
  return [
    "",
    "[Cross-discipline connections — build lateral thinking]",
    "- When a topic naturally bridges subjects, connect them:",
    "  • Ancient Egypt, Rome, etc. → weave in fractions, measurement, or scaling (math + humanities)",
    "  • Reading a science passage → the same evidence skills apply as in reading comprehension",
    "  • Writing about ecosystems or space → combine science facts + narrative structure",
    "  • Word problems about animals or history → reading comprehension meets math reasoning",
    "- If the student shows curiosity about a cross-subject link, lean into it — this is BASIS-style interdisciplinary thinking.",
    "- Do NOT force a connection if the topic is clearly single-subject and the student is focused.",
    "",
  ].join("\n");
}

function confidenceMismatchPromptLines(mem?: LearningMemory | null, studentName?: string): string[] {
  const name = studentName || "the student";
  if (!mem) return [];
  const mismatch = detectConfidenceMismatch(mem);
  if (!mismatch) return [];
  if (mismatch.type === "underconfident") {
    return [
      "",
      `[Confidence note: ${name} rated confidence ${mismatch.confidence}/3 on "${mismatch.label}" but BKT shows ~${Math.round(mismatch.pKnown * 100)}%. They may know more than they think — encourage them gently if this topic comes up.]`,
    ];
  }
  return [
    "",
    `[Confidence note: ${name} rated confidence ${mismatch.confidence}/3 on "${mismatch.label}" but BKT tracks ~${Math.round(mismatch.pKnown * 100)}%. If this topic comes up, gently check their reasoning — celebrate enthusiasm while confirming understanding.]`,
  ];
}

function formatEngagementLines(engagement?: EngagementState | null): string[] {
  if (!engagement || engagement.totalSolves <= 0) return [];
  const bits = [
    `streak ${engagement.streak}d`,
    `today ${engagement.solvesToday}`,
    `total turns ${engagement.totalSolves}`,
  ];
  if (engagement.badges.length) {
    bits.push(`badge: ${engagement.badges[engagement.badges.length - 1]}`);
  }
  return [
    "",
    "[Progress / celebration — use sparingly]",
    `Engagement: ${bits.join(" · ")}.`,
    "Occasionally celebrate cumulative progress in one short line (e.g. streak or topic win). Never interrupt a stuck moment with badges.",
  ];
}

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
  historyImageCount?: number;
  fileSummaries?: string[];
  history?: HistoryTurn[];
  /** Titles of other recent chats for cross-session continuity */
  recentTitles?: string[];
  studentProfile?: StudentProfile;
  /** Cross-session topic / mastery snapshot */
  learningMemory?: LearningMemory | null;
  /** Streak / daily solves for light celebration */
  engagement?: EngagementState | null;
  /** Voice picker id or reply lang mode */
  replyLanguage?: ReplyLangMode | string;
  voiceId?: string;
  /** D1 — parent check mode: show full steps / answers */
  checkMode?: boolean;
}): string {
  const { userText, imageCount, fileSummaries = [], history } = params;
  const hasHomework = imageCount > 0 || fileSummaries.length > 0;
  const profile = params.studentProfile || RYAN_PROFILE;

  const mode: ReplyLangMode =
    params.replyLanguage === "auto" ||
    params.replyLanguage === "en" ||
    params.replyLanguage === "zh" ||
    params.replyLanguage === "yue" ||
    params.replyLanguage === "es" ||
    params.replyLanguage === "fr"
      ? params.replyLanguage
      : replyLangFromVoice(params.voiceId || params.replyLanguage);

  const mediaLines: string[] = [];
  if (imageCount > 0) {
    const fromHistory = params.historyImageCount && params.historyImageCount > 0
      ? ` (${params.historyImageCount} from earlier, re-sent as context)`
      : "";
    mediaLines.push(
      `The student attached ${imageCount} photo(s)/image(s)${fromHistory} (Photo 1…Photo ${imageCount}). Treat them as pages/parts of the same worksheet when they belong together.`,
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
    "- Voice / TTS: also say the math in plain words once (e.g. “square root of 2”) beside the LaTeX — kids follow by ear.",
    "- Keep spoken-friendly chunks: aim for 2–3 short sentences, then a question (pause for the student).",
    "- Geometry / figures: call draw_geometry with a stable diagramId + rising revision, then paste its markdown image UNCHANGED (no code fence).",
    "  Alt text is set as geo:<diagramId>:<revision> Title — the app replaces older same-id figures (CA-8).",
    "  After the figure: ask what they notice AND invite a ‘measuring’ move (e.g. “If you had a ruler, what would you measure first?” / “Point to the right angle”).",
    "  Prefer discovery marks on the diagram (label a side “?”, leave the answer unmarked) — not the final number.",
    "  Optional step highlights: use SVG path/shape ids step-1, step-2… for progressive focus.",
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
    "L1.5 — Explain reasoning (BASIS-critical): AFTER they pick an option and BEFORE you mark right/wrong,",
    "       ask WHY (e.g. “Good — you picked B. Before I say if that’s right, why did you choose B? What clues did you notice?”).",
    "L2 — Process nudge: name a method or next tiny action — still no key number/word.",
    "L2.5 — Wrong answer → second chance (do NOT reveal the correct answer yet):",
    "       1) Point to which part of their reasoning may need a second look;",
    "       2) Ask them to re-read / re-check that bit;",
    "       3) Let them try once more before a stronger L3 scaffold.",
    "L3 — Stronger scaffold: only after they tried and are still stuck; still withhold the final answer.",
    "Full worked solution / filled blanks: ONLY if they explicitly ask after trying.",
    "",
    "Partial attempts / scratch work (text or photo of their steps):",
    "- Welcome drafts. Focus on WHERE thinking went off track, not just that it’s wrong.",
    "- Example: “I can see how you got to [their number]. Let’s find the tricky step together…”",
    "- When a notebook photo is present, follow [Scratch-work vision — CA-5] fence rules.",
    "",
    "Analogy / multi-rep switch (CA-7): if they say “I still don’t get it” more than once on the SAME skill,",
    "switch to the NEXT unused representation BEFORE L3 — cycle: bar_model → number_line → story → money → blocks.",
    "Do not reuse the same analogy; prefer the forced rep from learning memory when present.",
    "",
    "Self-check after a harder win (once, lightly): ask confidence 1–3",
    "(1=still confused, 2=getting there, 3=I could teach someone) and remember that feeling next turn.",
    "",
    "Writing drafts (narrative / short responses):",
    "1) Specific praise for ONE thing done well first;",
    "2) ONE question about a unclear moment (feelings, detail, clarity);",
    "3) ONE small improvement using THEIR words;",
    "4) Never rewrite their sentence for them.",
    "",
    "Science how/why: ask what they already know → a thought experiment (“What if…?”) →",
    "something they can observe → kid-friendly sources via web_search (NASA Kids, Nat Geo Kids) when useful.",
    "",
    "Anti-spoiler (conceptual / homework):",
    "- Do NOT give the final answer, the blank-fill word, or the key numeric result “as a hint”.",
    "- Do NOT paraphrase the model answer so closely that the student can copy it.",
    "- For maths reasoning: ask THEM to compute; you may check after they share their number.",
    "- For reading: ask THEM to paraphrase evidence; do not write the exam-ready sentence for them first.",
    "",
    "Interactive patterns (pick one per conceptual reply):",
    "- Multiple choice: 2–3 plausible options and ask which they pick — then WHY (L1.5).",
    "- Notice / predict / mini-task / compare / self-check.",
    "End almost every conceptual homework reply with a clear question the student must answer next.",
    "If they say “I give up”, empathize first, shrink the task, then offer an easier L0–L1 choice.",
    "Bored / “what should I do?”: offer an optional 5-minute brain teaser tied to a recent topic (riddle, number puzzle, spot-the-mistake) — keep it light.",
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
        "6) Maths: restate given/asked with LaTeX + plain-word aside; invite their next step or photo of scratch work.",
        "7) NEVER give the final answer / completed blanks first (unless pure recall A — or after a hint attempt for medium computation C).",
        "8) Keep replies short for phone + voice (2–3 sentences then a question).",
        "9) If they only say “I don’t know”, stay on L0–L1 — do not leap to the answer.",
        "10) After they choose an option, ask WHY before marking right/wrong (L1.5).",
        "11) On a wrong try: L2.5 second chance before stronger scaffold.",
        "",
        "[Worksheet planner — CA-1 multi-problem pages]",
        "If the photo/PDF looks like a worksheet with TWO OR MORE numbered items (Q1/Q2, 1a/1b, ①②…):",
        "1) FIRST count the numbered items carefully (scan the whole page) — total MUST match that count.",
        "2) Do NOT tutor the whole page at once — one item at a time.",
        "3) Emit (and later update) a hidden fence the app parses (never explain the fence to the student):",
        "~~~worksheet-plan",
        '{"total":N,"current":1,"items":[{"id":1,"label":"Q1","status":"active"},{"id":2,"label":"Q2","status":"pending"}]}',
        "~~~",
        "4) status values: pending | active | done | skipped. Keep exactly one active — never two actives.",
        "5) After the student finishes or skips an item, bump current, update statuses, re-emit the fence.",
        "6) When all done: one short celebration + weak-skill summary — still no mega answer dump.",
        "7) If the page has ONLY ONE question/item: do NOT emit a worksheet-plan fence.",
      ].join("\n")
    : [
        "",
        "Keep it conversational. Pure recall → confirm briefly. Conceptual problems → Think-first coaching.",
        "Use LaTeX for any maths, and blockquotes when pointing at text the student shared.",
        "Jokes / boredom: one short fun beat, then offer a tiny optional 5-minute challenge (riddle / puzzle) tied to recent learning.",
        "Invite scratch work: they can type steps or photo a page of working — coach the off-track step.",
      ].join("\n");

  const lang = languageForBand(profile.gradeBand);

  const checkModeBlock = params.checkMode
    ? [
        "",
        "[Parent check mode — D1 ACTIVE]",
        "A parent unlocked check mode. You MAY show full worked solutions, filled blanks, and final answers.",
        "Still be clear and educational (label steps). When check mode ends, Socratic rules return automatically.",
      ].join("\n")
    : "";

  const mem = params.learningMemory;
  const preferredRaw = mem?.preferredRepBySkill || {};
  const preferred: Record<string, Representation> = {};
  for (const [k, v] of Object.entries(preferredRaw)) {
    if (isRepresentation(v)) preferred[k] = v;
  }
  const stuck = mem?.stuckStreakBySkill || {};
  let forced: { skillId: string; rep: Representation } | null = null;
  for (const [skillId, streak] of Object.entries(stuck)) {
    const rep = pickForcedRepresentation(skillId, Number(streak) || 0, preferred);
    if (rep) {
      forced = { skillId, rep };
      break;
    }
  }
  const recentMc = (mem?.skills || [])
    .flatMap((s) => s.misconceptionHits || [])
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 4);

  return [
    "[Tutor context]",
    audienceLine(mode),
    styleLine(mode),
    `[Language style — ${profile.gradeBand} band] Confirm: "${lang.confirm}". Encourage: "${lang.encourage}". When stuck: "${lang.stuck}". On error: "${lang.error}". Prefer "${lang.thinkAloud}" before giving answers.`,
    ...studentProfilePromptLines(profile),
    ...curriculumPromptLines(profile),
    ...subjectCoachingLines(profile.gradeBand),
    ...crossDisciplineLines(),
    ...learningMemoryPromptLines(params.learningMemory),
    ...confidenceMismatchPromptLines(params.learningMemory, profile.name),
    ...formatEngagementLines(params.engagement),
    "You have lightweight tools: web_search, fetch_page, run_python, run_js, draw_geometry, recall_learner_skills. Use them silently when helpful; never narrate the tool call.",
    "Skill memory: the prompt already includes the student's BKT strengths/weaknesses — use that when asking questions. Call recall_learner_skills if you need a fresh snapshot.",
    "Visuals: the app renders LaTeX, ```svg diagrams, ```mermaid, and https images — use diagrams for geometry/science so the student can see the figure.",
    ...replyLanguageInstructions(mode),
    ...mediaLines,
    ...formatHistory(history),
    ...formatRecentTitles(params.recentTitles),
    ...formatRules,
    RECALL_VS_CONCEPT,
    OUTPUT_HYGIENE,
    params.checkMode
      ? [
          "",
          "[Think-first coaching — SUSPENDED while check mode is on]",
          "Parent check mode overrides anti-spoiler and the hint ladder for this turn.",
        ].join("\n")
      : thinkFirstRules,
    homeworkCoach,
    ...scratchDiagnosisPromptLines(hasHomework),
    ...misconceptionPromptLines(recentMc),
    ...multiRepPromptLines(preferred, forced),
    checkModeBlock,
    "",
    "[Student message]",
    userText.trim() || defaultStudentLine(mode, hasHomework),
  ].join("\n");
}
