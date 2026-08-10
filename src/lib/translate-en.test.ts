/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gtxTranslatePassage,
  looksMostlyEnglish,
} from "./dict-translate";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("looksMostlyEnglish", () => {
  it("accepts plain English tutoring text", () => {
    expect(looksMostlyEnglish("Let's draw a right triangle together.")).toBe(
      true,
    );
  });

  it("rejects Chinese or mixed Han text", () => {
    expect(looksMostlyEnglish("我们来画一个直角三角形吧")).toBe(false);
    expect(looksMostlyEnglish("OK 我们再试一次")).toBe(false);
  });
});

describe("gtxTranslatePassage", () => {
  it("short-circuits when text is already English", async () => {
    const out = await gtxTranslatePassage(
      "Please solve this fraction problem step by step.",
      "en",
    );
    expect(out?.alreadyTarget).toBe(true);
    expect(out?.translation).toMatch(/fraction/);
  });

  it("chunks and joins Google gtx segments", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([[["Hello there.", "你好。", null, null, 10]]]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const out = await gtxTranslatePassage("你好。", "en");
    expect(out?.alreadyTarget).toBe(false);
    expect(out?.translation).toBe("Hello there.");
    expect(String(mockFetch.mock.calls[0]![0])).toContain("sl=auto");
    expect(String(mockFetch.mock.calls[0]![0])).toContain("tl=en");
  });
});
