import { describe, expect, it } from "vitest";
import {
  FAQ_AI_SYS,
  buildFaqAiUserPrompt,
  normalizeFaqReplyLang,
} from "./faq-ai";
import { createFaqAiTools } from "./console-harness";

describe("faq-ai prompt", () => {
  it("includes read-only mission language", () => {
    expect(FAQ_AI_SYS).toMatch(/Spark Help/);
    expect(FAQ_AI_SYS).toMatch(/MUST NOT edit/i);
    expect(FAQ_AI_SYS).toMatch(/docs\/DESIGN\.md/);
  });

  it("normalizes reply language", () => {
    expect(normalizeFaqReplyLang("ms")).toBe("ms");
    expect(normalizeFaqReplyLang("YUE")).toBe("yue");
    expect(normalizeFaqReplyLang("nope")).toBe("auto");
  });

  it("builds multilingual user prompt", () => {
    const ms = buildFaqAiUserPrompt({
      question: "Bagaimana nak tukar suara?",
      replyLang: "ms",
    });
    expect(ms).toMatch(/Bahasa Melayu/);
    expect(ms).toMatch(/tukar suara/);

    const auto = buildFaqAiUserPrompt({
      question: "How do I use Listen?",
      replyLang: "auto",
    });
    expect(auto).toMatch(/same language/i);
  });
});

describe("createFaqAiTools", () => {
  it("exposes only read-only tools", () => {
    const tools = createFaqAiTools();
    expect(Object.keys(tools).sort()).toEqual([
      "list_files",
      "read_file",
      "search_code",
    ]);
    expect(tools).not.toHaveProperty("write_file");
    expect(tools).not.toHaveProperty("deploy_live");
  });
});
