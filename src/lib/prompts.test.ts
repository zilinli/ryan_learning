import { describe, expect, it } from "vitest";
import { buildTutorPrompt } from "./prompts";

describe("buildTutorPrompt", () => {
  it("includes student message and tutor context", () => {
    const p = buildTutorPrompt({
      userText: "Help with fractions",
      imageCount: 0,
      voiceId: "ava",
    });
    expect(p).toContain("[Tutor context]");
    expect(p).toContain("[Student message]");
    expect(p).toContain("Help with fractions");
    expect(p).toContain("Reply language — English");
  });

  it("locks Mandarin / Cantonese / Spanish from voiceId", () => {
    expect(
      buildTutorPrompt({ userText: "hi", imageCount: 0, voiceId: "yunxi" }),
    ).toMatch(/普通话/);
    expect(
      buildTutorPrompt({ userText: "hi", imageCount: 0, voiceId: "wanLung" }),
    ).toMatch(/粤语/);
    expect(
      buildTutorPrompt({ userText: "hi", imageCount: 0, voiceId: "alvaro" }),
    ).toMatch(/Español/);
  });

  it("honors explicit replyLanguage over voiceId", () => {
    const p = buildTutorPrompt({
      userText: "hola",
      imageCount: 0,
      voiceId: "ava",
      replyLanguage: "es",
    });
    expect(p).toMatch(/Español/);
    expect(p).not.toMatch(/Reply language — English — REQUIRED/);
  });

  it("adds homework coach rules when images or files exist", () => {
    const withImage = buildTutorPrompt({
      userText: "",
      imageCount: 2,
      voiceId: "auto",
    });
    expect(withImage).toContain("Homework coach");
    expect(withImage).toContain("Photo 1…Photo 2");
    expect(withImage).toContain("Think-first coaching");
    expect(withImage).toContain("Hint ladder");
    expect(withImage).toContain("Anti-spoiler");
    expect(withImage).toMatch(/Interactive patterns|interactive/i);

    const withFile = buildTutorPrompt({
      userText: "see file",
      imageCount: 0,
      fileSummaries: ["--- File 1 (a.pdf) ---\nhello"],
      voiceId: "ava",
    });
    expect(withFile).toContain("Document text extracted");
    expect(withFile).toContain("hello");
  });

  it("requires think-first coaching even without attachments", () => {
    const p = buildTutorPrompt({
      userText: "How do I solve this equation?",
      imageCount: 0,
      voiceId: "ava",
    });
    expect(p).toContain("Think-first coaching");
    expect(p).toContain("Anti-spoiler");
    expect(p).toMatch(/interactive/i);
  });

  it("appends recent history (trimmed)", () => {
    const p = buildTutorPrompt({
      userText: "next",
      imageCount: 0,
      history: [
        { role: "user", content: "first" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "x".repeat(800) },
      ],
      voiceId: "auto",
    });
    expect(p).toContain("[Recent chat");
    expect(p).toContain("Student: first");
    expect(p).toContain("Tutor: ok");
    expect(p).toMatch(/Student: x{500}/);
    expect(p).not.toMatch(/Student: x{501}/);
  });

  it("uses localized find-this cue", () => {
    expect(
      buildTutorPrompt({ userText: "a", imageCount: 1, voiceId: "yunxi" }),
    ).toContain("找到这里");
    expect(
      buildTutorPrompt({ userText: "a", imageCount: 1, voiceId: "wanLung" }),
    ).toContain("睇呢度");
    expect(
      buildTutorPrompt({ userText: "a", imageCount: 1, voiceId: "jorge" }),
    ).toContain("Mira aquí");
  });
});
