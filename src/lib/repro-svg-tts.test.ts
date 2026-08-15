import { describe, expect, it } from "vitest";
import { geometrySpecToMarkdown } from "./geometry-svg";
import { pullSpeakableFromBuffer } from "./tts-text";

describe("streaming TTS must not speak diagrams", () => {
  it("does not speak svg while streaming diagram markdown", () => {
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
          stroke: "#e67e22",
        },
        {
          type: "right_angle",
          at: [40, 200],
          from: [280, 200],
          to: [40, 40],
        },
        {
          type: "segment",
          from: [40, 40],
          to: [280, 200],
          stroke: "#e67e22",
          midLabel: "AB",
        },
      ],
    });
    const prose =
      "冇問題 Ryan！可能頭先嗰幅圖冇顯示到。我重新畫咗一幅俾你——睇吓而家出唔出得嚟：\n" +
      md +
      "\n你頭先已經講啱：直角喺 C。";

    let buf = "";
    const spoken: string[] = [];
    for (let i = 0; i < prose.length; i += 40) {
      buf += prose.slice(i, i + 40);
      const { ready, rest } = pullSpeakableFromBuffer(buf);
      buf = rest;
      spoken.push(...ready);
    }
    spoken.push(...pullSpeakableFromBuffer(buf, { force: true }).ready);

    const joined = spoken.join(" ");
    expect(joined).not.toMatch(/svg|xmlns|viewBox|polygon|data:image|%3C/i);
    expect(joined).toContain("冇問題");
    expect(joined).toContain("直角喺");
  });

  it("does not speak raw svg while streaming", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><polygon points="40,200 280,200 40,40"/></svg>';
    const prose = "睇吓呢个图：\n" + svg + "\n你睇到咩？";
    let buf = "";
    const spoken: string[] = [];
    for (let i = 0; i < prose.length; i += 25) {
      buf += prose.slice(i, i + 25);
      const { ready, rest } = pullSpeakableFromBuffer(buf);
      buf = rest;
      spoken.push(...ready);
    }
    spoken.push(...pullSpeakableFromBuffer(buf, { force: true }).ready);
    const joined = spoken.join(" ");
    expect(joined).not.toMatch(/svg|xmlns|viewBox|polygon/i);
    expect(joined).toContain("睇吓呢个图");
    expect(joined).toContain("你睇到咩");
  });
});
