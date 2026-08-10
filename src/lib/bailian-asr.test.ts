import { describe, expect, it } from "vitest";
import {
  bailianAsrLanguageHint,
  extractBailianAsrText,
} from "./bailian-asr";

describe("bailianAsrLanguageHint", () => {
  it("maps dialect and CJK langs", () => {
    expect(bailianAsrLanguageHint("teo")).toBe("zh");
    expect(bailianAsrLanguageHint("hak")).toBe("zh");
    expect(bailianAsrLanguageHint("yue")).toBe("yue");
    expect(bailianAsrLanguageHint("en")).toBe("en");
    expect(bailianAsrLanguageHint("auto")).toBeUndefined();
  });

  it("returns ms for Malay", () => {
    expect(bailianAsrLanguageHint("ms")).toBe("ms");
  });
});

describe("extractBailianAsrText", () => {
  it("parses Fun-ASR nested output", () => {
    const { text } = extractBailianAsrText({
      output: {
        output: { text: "Hello World，这里是阿里巴巴语音实验室。" },
        text: "Hello World，这里是阿里巴巴语音实验室。",
      },
    });
    expect(text).toContain("阿里巴巴");
  });

  it("parses Qwen3-ASR choices content", () => {
    const { text, language } = extractBailianAsrText({
      output: {
        choices: [
          {
            message: {
              content: [{ text: "你好世界" }],
              annotations: [{ type: "audio_info", language: "zh" }],
            },
          },
        ],
      },
    });
    expect(text).toBe("你好世界");
    expect(language).toBe("zh");
  });
});
