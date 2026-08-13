import { describe, expect, it, afterEach, vi } from "vitest";
import {
  buildImageOcrSummaries,
  extractImageOcrText,
  loadImageOcrConfig,
  ocrCompletionsUrl,
  ocrContentFromResponse,
  parseWorksheetItems,
  stripCodeFence,
  worksheetGradingBlock,
  worksheetGradingBlockFromSummaries,
} from "./image-ocr";

const OLD = { ...process.env };

afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

describe("stripCodeFence", () => {
  it("removes a wrapping markdown fence", () => {
    expect(stripCodeFence("```json\n{\"a\":1}\n```")).toBe('{"a":1}');
    expect(stripCodeFence("```\nlinger\nliterature\n```")).toBe(
      "linger\nliterature",
    );
  });

  it("leaves plain text untouched", () => {
    expect(stripCodeFence("linger")).toBe("linger");
    expect(stripCodeFence("")).toBe("");
  });
});

describe("ocrContentFromResponse", () => {
  it("parses string content", () => {
    expect(
      ocrContentFromResponse({
        choices: [{ message: { content: "linger\nliterature" } }],
      }),
    ).toBe("linger\nliterature");
  });

  it("parses array content blocks", () => {
    expect(
      ocrContentFromResponse({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "linger" },
                { type: "text", text: "literature" },
              ],
            },
          },
        ],
      }),
    ).toBe("linger\nliterature");
  });

  it("strips a fenced response and returns empty for missing data", () => {
    expect(
      ocrContentFromResponse({
        choices: [{ message: { content: "```json\n{\"a\":1}\n```" } }],
      }),
    ).toBe('{"a":1}');
    expect(ocrContentFromResponse(null)).toBe("");
    expect(ocrContentFromResponse({})).toBe("");
  });
});

describe("loadImageOcrConfig", () => {
  it("returns null without a key", () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    expect(loadImageOcrConfig()).toBeNull();
  });

  it("returns config with defaults and honors ALIYUN_OCR_MODEL", () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    delete process.env.ALIYUN_OCR_MODEL;
    expect(loadImageOcrConfig()).toMatchObject({
      apiKey: "sk-test",
      model: "qwen-vl-ocr-latest",
      region: "cn-beijing",
    });

    process.env.ALIYUN_OCR_MODEL = "qwen-vl-ocr-2025-11-20";
    expect(loadImageOcrConfig()?.model).toBe("qwen-vl-ocr-2025-11-20");
  });
});

describe("ocrCompletionsUrl", () => {
  it("uses workspace id when present", () => {
    process.env.ALIYUN_WORKSPACE_ID = "ws-test";
    process.env.ALIYUN_DASHSCOPE_REGION = "cn-beijing";
    expect(ocrCompletionsUrl()).toBe(
      "https://ws-test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
  });

  it("falls back to dashscope.aliyuncs.com without a workspace id", () => {
    delete process.env.ALIYUN_WORKSPACE_ID;
    expect(ocrCompletionsUrl()).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
  });
});

describe("extractImageOcrText", () => {
  it("returns empty for short/empty base64", async () => {
    expect(await extractImageOcrText("", "image/jpeg")).toBe("");
    expect(await extractImageOcrText("abc", "image/jpeg")).toBe("");
  });
});

describe("buildImageOcrSummaries", () => {
  it("returns empty when no OCR key is configured", async () => {
    delete process.env.ALIYUN_DASHSCOPE_API_KEY;
    const out = await buildImageOcrSummaries(
      [{ kind: "image", name: "camera-1.jpg", mimeType: "image/jpeg", data: "aGVsbG8=" }],
      { ocrFn: async () => "linger" },
    );
    expect(out).toEqual([]);
  });

  it("labels each photo and drops blank OCR results", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    const attachments = [
      { kind: "image", name: "camera-1.jpg", mimeType: "image/jpeg", data: "aGVsbG8=" },
      { kind: "image", name: "camera-2.jpg", mimeType: "image/jpeg", data: "d29ybGQ=" },
      { kind: "image", name: "camera-3.jpg", mimeType: "image/jpeg", data: "Zm9vYmFy" },
    ];
    // All blank → no summaries (fall back to raw vision)
    const blank = await buildImageOcrSummaries(attachments, {
      ocrFn: async () => "",
    });
    expect(blank).toEqual([]);

    const out = await buildImageOcrSummaries(attachments, {
      ocrFn: async () => "linger",
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("--- Photo 1 (camera-1.jpg) ---\nlinger");
    expect(out[2]).toBe("--- Photo 3 (camera-3.jpg) ---\nlinger");
  });

  it("drops OCR text that is too short", async () => {
    process.env.ALIYUN_DASHSCOPE_API_KEY = "sk-test";
    const out = await buildImageOcrSummaries(
      [{ kind: "image", name: "camera-1.jpg", mimeType: "image/jpeg", data: "aGVsbG8=" }],
      { ocrFn: async () => "ab" },
    );
    expect(out).toEqual([]);
  });
});

describe("parseWorksheetItems (P1-2 逐题解析)", () => {
  it("splits OCR text into numbered items with continuation lines", () => {
    const items = parseWorksheetItems(`1. What is 1/2 + 1/4?
Show your work.
2) 9 × 8 =
3. Solve for x: 2x + 3 = 11
   Explain the steps.`);
    expect(items.map((i) => i.number)).toEqual([1, 2, 3]);
    expect(items[0]?.text).toMatch(/What is 1\/2 \+ 1\/4/);
    expect(items[0]?.text).toMatch(/Show your work/);
    expect(items[1]?.text).toMatch(/9 × 8/);
    expect(items[2]?.text).toMatch(/2x \+ 3 = 11/);
    expect(items[2]?.text).toMatch(/Explain the steps/);
  });

  it("supports Q-prefixed and 第N题 markers", () => {
    const items = parseWorksheetItems("Q1. Which planet is largest?\nQ2 What is photosynthesis?\n第3题 请列出五种动物");
    expect(items.map((i) => i.text)).toHaveLength(3);
    expect(items[0]?.text).toMatch(/largest/);
    expect(items[2]?.text).toMatch(/五种动物/);
  });

  it("returns [] for unnumbered content (word lists / paragraphs)", () => {
    expect(parseWorksheetItems("linger\nliterature\nlocate")).toEqual([]);
    expect(parseWorksheetItems("")).toEqual([]);
  });
});

describe("worksheetGradingBlock (P1-2 整页批改)", () => {
  it("produces a grading block naming the item count", () => {
    const block = worksheetGradingBlock("1. 12 + 7 =\n2. 9 × 3 =\n3. 100 − 23 =");
    expect(block).not.toBeNull();
    expect(block).toMatch(/3 numbered item/);
    expect(block).toMatch(/✓ or ✗/);
    expect(block).toMatch(/redo/);
  });

  it("returns null when the page has no numbered items", () => {
    expect(worksheetGradingBlock("frog\ntoad\npond")).toBeNull();
  });

  it("builds the block from OCR summary lines", () => {
    const block = worksheetGradingBlockFromSummaries([
      "--- Photo 1 (cam.jpg) ---\n1. 12 + 7 =\n2. 9 × 3 =",
    ]);
    expect(block).toMatch(/2 numbered item/);
    expect(worksheetGradingBlockFromSummaries([])).toBeNull();
  });
});
