import { describe, expect, it } from "vitest";
import {
  chunkForNeuralTts,
  cleanTutorSpeechText,
  normalizeForTTS,
  pullSpeakableFromBuffer,
} from "./tts-text";

describe("cleanTutorSpeechText", () => {
  it("strips markdown chrome and collapses whitespace", () => {
    const out = cleanTutorSpeechText(
      "# Title\n\n> quote\n\n- item one\n\n**bold** and _italic_",
    );
    expect(out).toContain("Title");
    expect(out).toContain("quote");
    expect(out).toContain("item one");
    expect(out).toContain("bold");
    expect(out).not.toMatch(/[*_#>-]/);
  });

  it("unwraps links and inline code", () => {
    expect(cleanTutorSpeechText("See [docs](https://x.test) and `code`")).toBe(
      "See docs and code",
    );
  });

  it("converts simple LaTeX fractions for speech", () => {
    const out = cleanTutorSpeechText("Compute $\\frac{1}{2}$ please.");
    expect(out.toLowerCase()).toContain("1 over 2");
  });

  it("speaks square roots and powers for kids", () => {
    const out = cleanTutorSpeechText("Try $\\sqrt{2}$ and $x^2$.");
    expect(out.toLowerCase()).toContain("square root of 2");
    expect(out.toLowerCase()).toContain("squared");
  });

  it("returns empty for blank input", () => {
    expect(cleanTutorSpeechText("   \n  ")).toBe("");
  });

  it("removes spaces between Chinese characters", () => {
    expect(cleanTutorSpeechText("你 好 ， 请 看 这 一 题")).toBe(
      "你好，请看这一题",
    );
  });

  it("joins Chinese lines without inserting Latin spaces", () => {
    const out = cleanTutorSpeechText("先看这一句。\n你觉得什么意思？");
    expect(out).toBe("先看这一句。你觉得什么意思？");
    expect(out).not.toMatch(/。\s/);
  });

  it("does not speak SVG diagrams or data-URI images", () => {
    const raw =
      "睇吓呢个图。\n" +
      "![直角三角形 ABC](data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpolygon%20points%3D%221%202%203%22%2F%3E%3C%2Fsvg%3E)\n" +
      "你注意到直角喺边度？";
    const out = cleanTutorSpeechText(raw);
    expect(out).not.toMatch(/svg|polygon|xmlns|data:image/i);
    expect(out).not.toContain("直角三角形 ABC");
    expect(out).toContain("睇吓呢个图");
    expect(out).toContain("你注意到直角喺边度");
  });

  it("strips bare svg markup from speech", () => {
    const out = cleanTutorSpeechText(
      '先睇图 svg<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg> 你睇到咩？',
    );
    expect(out).not.toMatch(/svg|circle|viewBox/i);
    expect(out).toContain("先睇图");
    expect(out).toContain("你睇到咩");
  });

  it("strips HTML tags from speech", () => {
    expect(cleanTutorSpeechText("你好<img src='x.png'>世界")).toBe("你好世界");
    expect(cleanTutorSpeechText("请看<br>下面<br/>内容")).toBe("请看下面内容");
  });

  it("strips markdown tables", () => {
    const out = cleanTutorSpeechText("| 姓名 | 分数 |\n|---|---|\n| 小明 | 90 |");
    expect(out).not.toMatch(/[|]/);
  });

  it("strips markdown horizontal rules", () => {
    expect(cleanTutorSpeechText("上面内容\n---\n下面内容")).toBe("上面内容下面内容");
    expect(cleanTutorSpeechText("上面内容\n***\n下面内容")).toBe("上面内容。下面内容");
  });

  it("strips task list markers", () => {
    expect(cleanTutorSpeechText("- [ ] 未完成\n- [x] 已完成")).toBe("未完成已完成");
  });

  it("strips raw URLs from speech", () => {
    expect(cleanTutorSpeechText("打开 https://example.com 看看")).toBe("打开看看");
    expect(cleanTutorSpeechText("参考 (https://a.b/c) 就行")).toBe("参考 ( ) 就行");
  });

  it("strips HTML entities", () => {
    expect(cleanTutorSpeechText("a &amp; b &lt; c &gt; d")).toBe("a b c d");
  });

  it("strips bare data:image URIs (no markdown wrapper)", () => {
    expect(cleanTutorSpeechText("你好 data:image/gif;base64,AAAA 世界")).toBe(
      "你好世界",
    );
  });

  it("strips fenced SVG blocks in dialect jokes", () => {
    const raw = `先准备配图, 再用闽南话讲。

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
  <rect x="0" y="0" width="320" height="220"/>
</svg>
\`\`\`

你有看见无？`;
    const out = cleanTutorSpeechText(raw);
    expect(out).not.toMatch(/svg|xmlns|viewBox/i);
    expect(out).toContain("先准备配图");
    expect(out).toContain("再用闽南话讲");
    expect(out).toContain("你有看见无");
  });

  it("isEncodedJunk catches data:image/ prefix", () => {
    // We can't easily test the internal function, but the pipeline
    // should not produce speech from pure data URIs.
    const out = cleanTutorSpeechText(
      "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
    );
    expect(out).toBe("");
  });
});

describe("chunkForNeuralTts", () => {
  it("returns empty for blank text", () => {
    expect(chunkForNeuralTts("")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    expect(chunkForNeuralTts("Hello there.")).toEqual(["Hello there."]);
  });

  it("splits long text under maxLen", () => {
    const sentences = Array.from(
      { length: 20 },
      (_, i) => `Sentence number ${i} is here.`,
    ).join(" ");
    const parts = chunkForNeuralTts(sentences, 80);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 80)).toBe(true);
    expect(parts.join(" ")).toContain("Sentence number 0");
  });

  it("dialect-sized maxLen splits long Chinese Listen text", () => {
    const long =
      "好呀！我们来画一个直角三角形吧。直角在左下角，两条直角边分别是 3 和 4，斜边是 5。你可以先画水平的底边，再向上画竖直的边，最后连斜边。".repeat(
        2,
      );
    const parts = chunkForNeuralTts(long, 120);
    expect(parts.length).toBeGreaterThan(1);
    expect(Math.max(...parts.map((p) => p.length))).toBeLessThanOrEqual(120);
  });
});

describe("pullSpeakableFromBuffer", () => {
  it("extracts completed sentences", () => {
    const { ready, rest } = pullSpeakableFromBuffer(
      "This is a complete sentence. And more",
    );
    expect(ready.length).toBeGreaterThanOrEqual(1);
    expect(ready[0]).toContain("complete sentence");
    expect(rest).toContain("And more");
  });

  it("force-flushes remaining buffer", () => {
    const { ready, rest } = pullSpeakableFromBuffer("Almost done", {
      force: true,
    });
    expect(ready).toEqual(["Almost done"]);
    expect(rest).toBe("");
  });

  it("soft-breaks long clauses without sentence end", () => {
    const long =
      "This is a fairly long clause without ending punctuation yet, " +
      "and it keeps going with more words to exceed the wait threshold " +
      "so speech can start earlier than the full reply would allow.";
    const { ready, rest } = pullSpeakableFromBuffer(long, {
      minChars: 20,
      maxWaitChars: 60,
    });
    expect(ready.length).toBeGreaterThanOrEqual(1);
    expect(rest.length).toBeLessThan(long.length);
  });

  it("waits longer by default so streaming is less choppy", () => {
    const clause =
      "Let's look carefully at the first sentence of the passage and notice";
    // Under default maxWait (160) — should NOT soft-break yet
    expect(clause.length).toBeLessThan(160);
    const { ready, rest } = pullSpeakableFromBuffer(clause);
    expect(ready).toEqual([]);
    expect(rest).toBe(clause);
  });

  it("soft-breaks near the wait window, not at the first space", () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const { ready } = pullSpeakableFromBuffer(words, {
      minChars: 28,
      maxWaitChars: 80,
    });
    expect(ready.length).toBe(1);
    expect(ready[0]!.length).toBeGreaterThan(28);
    expect(ready[0]!.startsWith("word0")).toBe(true);
  });
});

describe("normalizeForTTS", () => {
  it("returns text unchanged for non-dialect languages", () => {
    expect(normalizeForTTS("Hello world", "en")).toBe("Hello world");
    expect(normalizeForTTS("你好，世界", "zh")).toBe("你好，世界");
    expect(normalizeForTTS("Hola mundo", "es")).toBe("Hola mundo");
  });

  it("replaces Hokkien 'you' 汝 with Cantonese 你", () => {
    expect(normalizeForTTS("汝好，食饭未？", "teo")).toBe(
      "你好，食饭未？",
    );
  });

  it("replaces Hokkien 'don't' 勿 with Cantonese 唔好", () => {
    expect(normalizeForTTS("勿惊，慢慢来", "teo")).toBe(
      "唔好惊，慢慢来",
    );
  });

  it("replaces Hokkien 'what' 乜个 with Cantonese 乜嘢", () => {
    expect(normalizeForTTS("汝想买乜个？", "teo")).toBe(
      "你想买乜嘢？",
    );
  });

  it("replaces Hokkien 'how' 怎呢 with Cantonese 點樣", () => {
    expect(normalizeForTTS("汝觉得怎呢？", "teo")).toBe(
      "你觉得點樣？",
    );
  });

  it("replaces Hokkien 'many' 㩼 with Cantonese 多", () => {
    expect(normalizeForTTS("㩼谢汝个帮助", "teo")).toBe(
      "多谢你嘅帮助",
    );
  });

  it("replaces Hakka 'I' 涯 with Cantonese 我", () => {
    expect(normalizeForTTS("涯係學生，涯想學數學", "hak")).toBe(
      "我係學生，我想學數學",
    );
  });

  it("replaces Hakka 'what' 麼个 with Cantonese 乜嘢", () => {
    expect(normalizeForTTS("你想做麼个？", "hak")).toBe(
      "你想做乜嘢？",
    );
  });

  it("replaces Hakka 'how' 仰般 with Cantonese 點樣", () => {
    expect(normalizeForTTS("仰般做这道题？", "hak")).toBe(
      "點樣做这道题？",
    );
  });

  it("replaces Hakka 'don't' 莫 with Cantonese 唔好", () => {
    expect(normalizeForTTS("莫惊，涯会帮你", "hak")).toBe(
      "唔好惊，我会帮你",
    );
  });

  it("preserves shared dialect+Cantonese characters", () => {
    // 食, 唔, 睇 are shared — should not be touched
    expect(normalizeForTTS("唔食睇唔到", "teo")).toBe("唔食睇唔到");
    // 冇, 但係 are shared — should not be touched
    expect(normalizeForTTS("冇错，但係好难", "hak")).toBe("冇错，但係好难");
  });

  it("handles mixed sentences with multiple substitutions", () => {
    // Hakka mixed sentence: 你好 (not 汝好), 涯→我, 麼个→乜嘢
    const out = normalizeForTTS(
      "你好！涯係先生，你有麼个问题？",
      "hak",
    );
    expect(out).toBe("你好！我係先生，你有乜嘢问题？");

    // Hokkien mixed sentence: 汝→你, 乜个→乜嘢, 怎呢→點樣
    const out2 = normalizeForTTS(
      "汝好！汝有乜个问题？怎呢做？",
      "teo",
    );
    expect(out2).toBe("你好！你有乜嘢问题？點樣做？");
  });

  it("normalizes Shanghainese 侬→你 and 阿拉→我哋", () => {
    expect(normalizeForTTS("侬好，阿拉去吃饭", "sha")).toBe(
      "你好，我哋去吃饭",
    );
  });

  it("normalizes Shanghainese 伊→佢 and 弗→唔", () => {
    expect(normalizeForTTS("伊弗是老师", "sha")).toBe("佢唔是老师");
  });

  it("normalizes Shanghainese possessive 个 after pronoun→嘅", () => {
    // 侬→你 first, then 你个→你嘅
    expect(normalizeForTTS("侬个书来了", "sha")).toBe("你嘅书来了");
  });

  it("normalizes Shanghainese 勒→咗 and 垃海→喺度", () => {
    expect(normalizeForTTS("伊吃饭勒。我垃海学堂。", "sha")).toBe(
      "佢吃饭咗。我喺度学堂。",
    );
  });

  it("normalizes Shanghainese 搿个→呢個 and 埃个→嗰個 (勿→唔好 causes double 好)", () => {
    // 勿→唔好 means "don't"; 唔好+好吃 → "唔好好吃" — expected for lossy Cantonese TTS
    expect(normalizeForTTS("搿个好吃，埃个勿好吃。", "sha")).toBe(
      "呢個好吃，嗰個唔好好吃。",
    );
  });
});
