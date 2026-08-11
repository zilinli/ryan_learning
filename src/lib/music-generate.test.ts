import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateSongWithFallback } from "./music-generate";
import * as fun from "./fun-music-client";
import * as volc from "./volc-gensong-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateSongWithFallback", () => {
  it("uses Bailian when it succeeds", async () => {
    vi.spyOn(fun, "isFunMusicConfigured").mockReturnValue(true);
    vi.spyOn(volc, "isVolcMusicConfigured").mockReturnValue(true);
    vi.spyOn(fun, "funMusicGenerate").mockResolvedValue({
      ok: true,
      status: "done",
      audioUrl: "https://bailian.example/a.mp3",
      mimeType: "audio/mpeg",
    });
    const volcSpy = vi.spyOn(volc, "volcGenerateSongWithBillingFallback");

    const r = await generateSongWithFallback({
      lyrics: "[Verse]\nenough text for a song line",
      gender: "female",
    });
    expect(r.status).toBe("done");
    expect(r.provider).toBe("bailian-fun-music");
    expect(volcSpy).not.toHaveBeenCalled();
  });

  it("falls back to Volc when Bailian Access denied", async () => {
    vi.spyOn(fun, "isFunMusicConfigured").mockReturnValue(true);
    vi.spyOn(volc, "isVolcMusicConfigured").mockReturnValue(true);
    vi.spyOn(fun, "funMusicGenerate").mockResolvedValue({
      ok: false,
      status: "error",
      error: "Access denied",
    });
    vi.spyOn(volc, "volcGenerateSongWithBillingFallback").mockResolvedValue({
      ok: true,
      status: "done",
      provider: "volc-postpaid",
      billing: "postpaid",
      audioUrl: "https://volc.example/b.mp3",
      mimeType: "audio/mpeg",
      attempts: ["ok:postpaid/GenSongForTime"],
    });

    const r = await generateSongWithFallback({
      lyrics: "[Verse]\nenough text for a song line",
    });
    expect(r.status).toBe("done");
    expect(r.provider).toBe("volc-postpaid");
    expect(r.attempts.some((a) => a.includes("fail:bailian"))).toBe(true);
  });

  it("returns unconfigured when neither provider set", async () => {
    vi.spyOn(fun, "isFunMusicConfigured").mockReturnValue(false);
    vi.spyOn(volc, "isVolcMusicConfigured").mockReturnValue(false);
    const r = await generateSongWithFallback({
      lyrics: "[Verse]\nenough text for a song line",
    });
    expect(r.status).toBe("unconfigured");
  });
});
