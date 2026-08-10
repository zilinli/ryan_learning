import { describe, expect, it, afterEach, vi } from "vitest";
import {
  bailianAsrLanguageHint,
  bailianAsrModelFor,
  bailianAsrScriptMismatch,
  extractBailianAsrText,
  loadBailianAsrConfig,
} from "./bailian-asr";

const OLD = { ...process.env };

afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

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

describe("bailianAsrModelFor", () => {
  it("routes Malay to Qwen / MTL instead of Chinese Fun-ASR primary", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    delete process.env.ALIYUN_ASR_MTL_MODEL;
    process.env.ALIYUN_ASR_MODEL = "fun-asr-flash-2026-06-15";
    process.env.ALIYUN_ASR_FALLBACK_MODEL = "qwen3-asr-flash";
    const cfg = loadBailianAsrConfig();
    expect(bailianAsrModelFor("ms", cfg)).toBe("qwen3-asr-flash");
    expect(bailianAsrModelFor("zh", cfg)).toBe("fun-asr-flash-2026-06-15");
  });

  it("honors ALIYUN_ASR_MTL_MODEL for Malay", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    process.env.ALIYUN_ASR_MTL_MODEL = "fun-asr-mtl";
    const cfg = loadBailianAsrConfig();
    expect(bailianAsrModelFor("ms", cfg)).toBe("fun-asr-mtl");
  });
});

describe("bailianAsrScriptMismatch", () => {
  it("flags Chinese transcript when Malay/English was requested", () => {
    expect(bailianAsrScriptMismatch("你好，我们来做数学题", "ms")).toBe(true);
    expect(bailianAsrScriptMismatch("Selamat pagi, mari belajar", "ms")).toBe(
      false,
    );
    expect(bailianAsrScriptMismatch("Hello there", "en")).toBe(false);
    expect(bailianAsrScriptMismatch("你好世界测试", "en")).toBe(true);
    expect(bailianAsrScriptMismatch("你好", "zh")).toBe(false);
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
