export function buildTutorPrompt(params: {
  userText: string;
  imageCount: number;
  fileSummaries?: string[];
}): string {
  const { userText, imageCount, fileSummaries = [] } = params;
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

  const homeworkCoach = hasHomework
    ? [
        "",
        "[Homework coach — Doubao Aixue / AI老师 style]",
        "If this looks like schoolwork (reading comprehension, maths, science, worksheets):",
        "1) First identify the subject and question type.",
        "2) HIGHLIGHT the source: quote the key sentence/stem/numbers from the photo or file using a short blockquote, e.g.",
        '   > From Photo 1: "…exact words or expression…"',
        "   Point the student’s eyes to that part before teaching the method.",
        "3) Ask which part is confusing (or which sub-question a/b/c to start with).",
        "4) Guide ONE micro-step only, then wait. Do not jump ahead.",
        "5) For reading comprehension: help locate evidence in the passage (quote the line), then help them paraphrase — do not dump the model answer.",
        "6) For maths: check what is given/asked, suggest the next operation or diagram check, let them compute.",
        "7) NEVER give the final answer / completed blanks first. Full solution only if they explicitly ask after trying.",
        "8) Keep replies short for phone + voice: one focus question + one hint.",
      ].join("\n")
    : [
        "",
        "Keep it conversational. If a problem appears, still guide step by step—no final answer upfront.",
      ].join("\n");

  return [
    "[Tutor context]",
    "Audience: international-school student; English first language.",
    "Style: warm AI teacher — simple English, Socratic, encouraging, like a patient classroom tutor.",
    "Do not edit files or run commands.",
    ...mediaLines,
    homeworkCoach,
    "",
    "[Student message]",
    userText.trim() ||
      (hasHomework
        ? "Please look at my homework and help me understand it step by step."
        : "Please help me."),
  ].join("\n");
}
