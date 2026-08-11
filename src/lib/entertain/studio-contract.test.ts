import { describe, expect, it } from "vitest";
import type { GameId, GameCategory } from "./types";
import { TED_CATALOG, searchTedCatalog, parseTedSlug } from "./ted-catalog";
import { buildFallbackChallenge } from "./ted-challenge";
import {
  structureDraftLocal,
  looksLikeLyricStructure,
} from "./studio-structure";

const STUDIO_IDS: GameId[] = ["ted-lab", "writing-studio", "creations"];

describe("Studio product contract", () => {
  it("exposes Studio GameIds", () => {
    for (const id of STUDIO_IDS) {
      expect(id).toBeTruthy();
    }
    const cat: GameCategory = "studio";
    expect(cat).toBe("studio");
  });

  it("catalog is large enough for V1 search", () => {
    expect(TED_CATALOG.length).toBeGreaterThanOrEqual(35);
    expect(searchTedCatalog("introvert").length).toBeGreaterThan(0);
    expect(parseTedSlug("https://www.ted.com/talks/foo_bar_baz")).toBe(
      "foo_bar_baz",
    );
  });

  it("fallback challenge is advanced (mixed kinds, open prompts)", () => {
    const talk = TED_CATALOG[0]!;
    const c = buildFallbackChallenge(
      talk,
      "A ".repeat(50) +
        "claim with evidence. Middle of the talk expands. Closing implication for listeners who want rigor.",
    );
    expect(c.items.every((i) => i.prompt.length > 20)).toBe(true);
    expect(c.items.some((i) => i.kind === "retell")).toBe(true);
    // Prefer open response — choices optional/rare
    const withChoices = c.items.filter((i) => i.choices && i.choices.length);
    expect(withChoices.length).toBeLessThanOrEqual(1);
  });

  it("modality structure: music vs image vs video formats differ", () => {
    const draft = "Quiet rain. Bus stop. Grey coat. Waiting.";
    const music = structureDraftLocal(draft, "Indie", "music");
    const image = structureDraftLocal(draft, "Indie", "image");
    const video = structureDraftLocal(draft, "Indie", "video");
    expect(looksLikeLyricStructure(music.body)).toBe(true);
    expect(looksLikeLyricStructure(image.prompt)).toBe(false);
    expect(looksLikeLyricStructure(video.prompt)).toBe(false);
    expect(image.prompt).not.toEqual(music.body);
    expect(video.prompt).not.toEqual(music.body);
  });
});
