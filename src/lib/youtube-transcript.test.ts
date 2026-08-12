import { describe, expect, it } from "vitest";
import { parseVttToText, parseSrtToText } from "./youtube-transcript";

describe("parseVttToText", () => {
  it("extracts narration and drops cue chrome", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:15.040 --> 00:00:17.109 align:start position:0%
[Music]
every<00:00:15.280><c> country</c><00:00:15.599><c> on</c><00:00:15.759><c> earth</c>

00:00:17.109 --> 00:00:17.119
every country on earth

00:00:18.000 --> 00:00:20.000
is inventing new ways
`;
    const text = parseVttToText(vtt);
    expect(text).toContain("every country on earth");
    expect(text).toContain("inventing new ways");
    expect(text).not.toContain("WEBVTT");
    expect(text).not.toContain("-->");
    expect(text).not.toMatch(/<\d{2}:/);
  });
});

describe("parseSrtToText", () => {
  it("joins dialogue lines", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Hello world.

2
00:00:04,000 --> 00:00:06,000
This is a test.
`;
    expect(parseSrtToText(srt)).toBe("Hello world. This is a test.");
  });
});
