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

  it("does not speak CSS from inside a fenced SVG (soft-break regression)", () => {
    // Production bug: mask used spaces, so soft-break cut at whitespace inside
    // <style>, then TTS read "font-family… .big { fill:#…"
    const prose =
      "圆仔笑讲：「莫傲啦！老师算面积，拢爱请我个朋友来相帮。」\n\n" +
      "```svg\n" +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 260">\n' +
      "<defs><style>\n" +
      "  .lab { font-family: system-ui, sans-serif; font-size:13px; fill:#222; }\n" +
      "  .big { font-family: system-ui, sans-serif; font-weight:700; fill:#1d3557; }\n" +
      "  @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }\n" +
      "</style></defs>\n" +
      '<text class="big" x="40" y="40">直角！锐角！钝角！</text>\n' +
      "</svg>\n" +
      "```\n\n" +
      "汝看图——红色彼个小角是啥物角？";

    let buf = "";
    const spoken: string[] = [];
    for (let i = 0; i < prose.length; i += 30) {
      buf += prose.slice(i, i + 30);
      const { ready, rest } = pullSpeakableFromBuffer(buf, {
        minChars: 48,
        maxWaitChars: 220,
      });
      buf = rest;
      spoken.push(...ready);
    }
    spoken.push(
      ...pullSpeakableFromBuffer(buf, { force: true }).ready,
    );

    const joined = spoken.join(" ");
    expect(joined).not.toMatch(
      /font-family|@keyframes|\.big|\.lab|fill:#|system-ui|translateY/i,
    );
    expect(joined).toContain("圆仔笑讲");
    expect(joined).toContain("啥物角");
  });
});
