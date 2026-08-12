import { describe, expect, it } from "vitest";
import {
  normalizeSongStyle,
  suggestStageStyle,
  styleCaptionSeed,
  stylesForTarget,
} from "./stage-styles";

describe("stage-styles", () => {
  it("normalizes legacy Hip-hop sketch", () => {
    expect(normalizeSongStyle("Hip-hop sketch")).toBe("Hip-hop");
    expect(normalizeSongStyle("indie")).toBe("Indie");
    expect(normalizeSongStyle("")).toBe("Indie");
  });

  it("suggests Hip-hop from rap/punchy lyrics", () => {
    const rap = "[Verse]\nMic check on the block\nFlow tight, beat knocks\n[Chorus]\nRap the night, hip-hop";
    expect(suggestStageStyle("music", rap)).toBe("Hip-hop");
  });

  it("suggests Ballad from tender lyrics", () => {
    expect(
      suggestStageStyle(
        "music",
        "[Verse]\nA tender lullaby in the quiet\n[Chorus]\nGentle tears, a ballad",
      ),
    ).toBe("Ballad");
  });

  it("falls back to Indie", () => {
    expect(suggestStageStyle("music", "Morning light on the desk and the kettle")).toBe(
      "Indie",
    );
  });

  it("image and video defaults", () => {
    expect(suggestStageStyle("image", "a student at a sunlit desk")).toBe("Photo");
    expect(suggestStageStyle("image", "watercolor wash of rain")).toBe("Watercolor");
    expect(suggestStageStyle("video", "documentary interview on the street")).toBe(
      "Documentary",
    );
    expect(suggestStageStyle("video", "playful daylight scene")).toBe("Playful");
  });

  it("caption seed includes style", () => {
    expect(styleCaptionSeed("music", "Hip-hop", "female")).toMatch(/Hip-hop/i);
    expect(styleCaptionSeed("image", "Comic")).toMatch(/Comic/i);
    expect(stylesForTarget("music")).toContain("Hip-hop");
    expect(stylesForTarget("image")).toContain("Watercolor");
  });
});
