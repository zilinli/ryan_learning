import { describe, expect, it } from "vitest";
import {
  parseVttToText,
  parseSrtToText,
  parseAvailableCaptionLangs,
  fetchViaAutoCc,
  fetchYouTubeTranscript,
} from "./youtube-transcript";

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

describe("parseAvailableCaptionLangs", () => {
  it("extracts locale list from youtube-transcript errors", () => {
    expect(
      parseAvailableCaptionLangs(
        "No transcripts are available in en this video. Available languages: ar, nl-NL, en-US, fr",
      ),
    ).toEqual(["ar", "nl-NL", "en-US", "fr"]);
  });
});

describe("fetchViaAutoCc (live)", () => {
  it(
    "pulls English auto-CC when bare en is missing (en-US fallback)",
    async () => {
      // Spy in the Huddle — often exposes en-US auto captions, not bare `en`
      const text = await fetchViaAutoCc("cTQ3Ko9ZKg8");
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(200);
      expect(text!.toLowerCase()).toMatch(/attenborough|moon|penguin|earth|ocean|antarctica|bird/);
    },
    60_000,
  );

  it(
    "pulls auto-CC for NatGeo Lions 101",
    async () => {
      const text = await fetchViaAutoCc("OMkEVX23BdM");
      expect(text).toBeTruthy();
      expect(text!.toLowerCase()).toContain("lion");
    },
    60_000,
  );

  it(
    "returns null when the uploader disabled all transcripts",
    async () => {
      // Official Iguana vs Snakes clip — YouTube reports transcripts disabled
      const text = await fetchViaAutoCc("el4CQj-TCbA");
      expect(text).toBeNull();
    },
    60_000,
  );
});

describe("fetchYouTubeTranscript (live)", () => {
  it(
    "uses auto-cc source for RSA Drive",
    async () => {
      const t = await fetchYouTubeTranscript("zDZFcDGpL4U");
      expect(t).toBeTruthy();
      expect(t!.text.toLowerCase()).toMatch(/education|motivat|country/);
      expect(["auto-cc", "cache", "yt-dlp"]).toContain(t!.source);
    },
    90_000,
  );
});
