import { describe, expect, it } from "vitest";
import {
  assertVisualPromptOk,
  buildVisualPrompt,
  looksLikeLyricStructure,
  structureDraftLocal,
  structureImageLocal,
  structureMusicLocal,
  structureVideoLocal,
} from "./studio-structure";

const DRAFT = [
  "Morning light on the desk",
  "I fold the page I never finished",
  "The kettle clicks once",
  "And the day begins again",
].join("\n");

describe("studio-structure", () => {
  it("music structure uses lyric section tags", () => {
    const r = structureMusicLocal(DRAFT, "Ballad");
    expect(r.target).toBe("music");
    expect(r.lyrics).toMatch(/\[Verse\]/);
    expect(r.lyrics).toMatch(/\[Chorus\]/);
    expect(r.body).toBe(r.lyrics);
    expect(r.caption).toMatch(/Ballad/i);
    expect(looksLikeLyricStructure(r.body)).toBe(true);
  });

  it("image structure never emits lyric tags", () => {
    const r = structureImageLocal(DRAFT, "Indie");
    expect(r.target).toBe("image");
    expect(looksLikeLyricStructure(r.body)).toBe(false);
    expect(looksLikeLyricStructure(r.prompt)).toBe(false);
    expect(r.body).not.toMatch(/\[Verse\]|\[Chorus\]/i);
    expect(r.prompt.length).toBeGreaterThan(20);
    expect(r.caption).toMatch(/Indie|visual/i);
  });

  it("video structure is cinematic without lyric tags", () => {
    const r = structureVideoLocal(DRAFT, "Orchestral");
    expect(r.target).toBe("video");
    expect(looksLikeLyricStructure(r.body)).toBe(false);
    expect(r.body.toLowerCase()).toMatch(/push|crane|track|pan|camera|motion|cinematic|shot/);
    expect(r.prompt).not.toMatch(/\[Verse\]/i);
  });

  it("structureDraftLocal dispatches by target", () => {
    expect(structureDraftLocal(DRAFT, "Indie", "music").target).toBe("music");
    expect(structureDraftLocal(DRAFT, "Indie", "image").target).toBe("image");
    expect(structureDraftLocal(DRAFT, "Indie", "video").target).toBe("video");
  });

  it("strips accidental lyric tags when building visual prompt", () => {
    const dirty = "[Verse]\nA quiet desk by the window\n[Chorus]\nHold the light";
    const p = buildVisualPrompt(dirty, "soft daylight, editorial photo");
    expect(looksLikeLyricStructure(p)).toBe(false);
    expect(p).toMatch(/quiet desk/i);
    expect(p).toMatch(/soft daylight/i);
  });

  it("assertVisualPromptOk rejects lyric-shaped prompts", () => {
    expect(
      assertVisualPromptOk("[Verse]\nhello world this is long enough\n[Chorus]\nx"),
    ).toMatch(/lyrics/i);
    expect(assertVisualPromptOk("short")).toMatch(/short/i);
    expect(
      assertVisualPromptOk(
        "A student at a sunlit desk with an open notebook, soft natural light",
      ),
    ).toBeNull();
  });

  it("image/video local strip tags from draft input", () => {
    const tagged = `[Verse]\n${DRAFT}\n[Chorus]\nHold on`;
    const img = structureImageLocal(tagged, "Ballad");
    const vid = structureVideoLocal(tagged, "Ballad");
    expect(looksLikeLyricStructure(img.prompt)).toBe(false);
    expect(looksLikeLyricStructure(vid.prompt)).toBe(false);
  });
});
