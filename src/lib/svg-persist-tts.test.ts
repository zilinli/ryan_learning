import { describe, expect, it } from "vitest";
import { geometrySpecToMarkdown } from "./geometry-svg";
import {
  cleanTutorSpeechText,
  pullSpeakableFromBuffer,
} from "./tts-text";
import {
  hasTutorDiagram,
  preferCompleteTutorText,
} from "./tutor-text-filter";
import { truncateMessageContent } from "./storage";

function streamSpeak(text: string, step = 20): string[] {
  let buf = "";
  const spoken: string[] = [];
  for (let i = 0; i < text.length; i += step) {
    buf += text.slice(i, i + step);
    const { ready, rest } = pullSpeakableFromBuffer(buf);
    buf = rest;
    spoken.push(...ready);
  }
  spoken.push(...pullSpeakableFromBuffer(buf, { force: true }).ready);
  return spoken.filter(Boolean);
}

const JUNK_RE =
  /svg|xmlns|viewBox|polygon|polyline|data:image|%3C|stroke-width|font-family|aria-label/i;

describe("svg persistence + tts silence", () => {
  const md = geometrySpecToMarkdown({
    title: "直角三角形 ABC",
    shapes: [
      {
        type: "triangle",
        points: [
          [40, 200],
          [280, 200],
          [40, 40],
        ],
        labels: ["C", "B", "A"],
      },
      {
        type: "right_angle",
        at: [40, 200],
        from: [280, 200],
        to: [40, 40],
      },
    ],
  });

  it("keeps / reinjects diagram when final omits SVG", () => {
    const streamed = `睇吓呢个图：\n${md}\n你注意到直角喺边度？`;
    const final =
      "睇吓呢个直角三角形 ABC。直角喺 C。你注意到边度最长？边度系直角？";
    const out = preferCompleteTutorText(streamed, final);
    expect(hasTutorDiagram(out)).toBe(true);
    expect(out).toContain("data:image/svg+xml");
    expect(out).toContain("你注意到");
  });

  it("does not speak SVG while streaming diagram markdown (short steps)", () => {
    const prose =
      "冇問題 Ryan！我画咗一幅直角三角形畀你——睇吓：\n" +
      md +
      "\n你头先已经讲啱：直角喺 C。";
    const spoken = streamSpeak(prose, 20);
    const joined = spoken.join(" || ");
    expect(joined).not.toMatch(JUNK_RE);
    expect(joined).toMatch(/直角|Ryan|睇吓|C/);
  });

  it("does not speak SVG with long prose before the figure", () => {
    const long = "Ryan，我而家画一个直角三角形畀你睇。".repeat(8);
    const prose = `${long}\n${md}\n你注意到直角喺边度？`;
    const spoken = streamSpeak(prose, 17);
    expect(spoken.join(" ")).not.toMatch(JUNK_RE);
  });

  it("does not speak raw <svg> streaming", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><polygon points="40,200 280,200 40,40"/></svg>';
    const prose = `睇吓呢个图：\n${svg}\n你睇到咩？`;
    const spoken = streamSpeak(prose, 15);
    expect(spoken.join(" ")).not.toMatch(JUNK_RE);
    expect(cleanTutorSpeechText(prose)).toMatch(/睇吓呢个图/);
    expect(cleanTutorSpeechText(prose)).not.toMatch(JUNK_RE);
  });

  it("truncateMessageContent never cuts through diagram URI", () => {
    const content = `${"讲解。".repeat(12_000)}\n${md}\n你注意到咩？`;
    const out = truncateMessageContent(content, 8_000);
    expect(out).toContain("data:image/svg+xml");
    expect(out).toContain("![直角三角形 ABC]");
  });
});
