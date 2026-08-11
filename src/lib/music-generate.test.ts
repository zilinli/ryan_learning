import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSongWithFallback } from "./music-generate";
import * as deapi from "./deapi-client";
import * as fun from "./fun-music-client";
import * as volc from "./volc-gensong-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateSongWithFallback", () => {
  it("prefers deAPI when configured", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(true);
    vi.spyOn(fun, "isFunMusicConfigured").mockReturnValue(true);
    vi.spyOn(volc, "isVolcMusicConfigured").mockReturnValue(true);
    vi.spyOn(deapi, "deapiGenerateMusic").mockResolvedValue({
      ok: true,
      status: "done",
      resultUrl: "https://results.deapi.ai/a.mp3",
      mimeType: "audio/mpeg",
      requestId: "req_1",
      model: "AceStep_1_5_Turbo",
    });
    const funSpy = vi.spyOn(fun, "funMusicGenerate");

    const r = await generateSongWithFallback({
      lyrics: "[Verse]\nenough text for a song line here",
      caption: "indie ballad",
      gender: "female",
    });
    expect(r.status).toBe("done");
    expect(r.provider).toBe("deapi");
    expect(funSpy).not.toHaveBeenCalled();
  });

  it("uses Bailian when deAPI missing and Bailian succeeds", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(false);
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

  it("falls back to Volc when Bailian Access denied and deAPI off", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(false);
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

  it("falls back to Bailian when deAPI fails", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(true);
    vi.spyOn(fun, "isFunMusicConfigured").mockReturnValue(true);
    vi.spyOn(volc, "isVolcMusicConfigured").mockReturnValue(false);
    vi.spyOn(deapi, "deapiGenerateMusic").mockResolvedValue({
      ok: false,
      status: "error",
      error: "quota",
    });
    vi.spyOn(fun, "funMusicGenerate").mockResolvedValue({
      ok: true,
      status: "done",
      audioUrl: "https://bailian.example/c.mp3",
      mimeType: "audio/mpeg",
    });

    const r = await generateSongWithFallback({
      lyrics: "[Verse]\nenough text for a song line",
    });
    expect(r.status).toBe("done");
    expect(r.provider).toBe("bailian-fun-music");
    expect(r.attempts.some((a) => a.includes("fail:deapi"))).toBe(true);
  });

  it("returns unconfigured when no provider set", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(false);
    vi.spyOn(fun, "isFunMusicConfigured").mockReturnValue(false);
    vi.spyOn(volc, "isVolcMusicConfigured").mockReturnValue(false);
    const r = await generateSongWithFallback({
      lyrics: "[Verse]\nenough text for a song line",
    });
    expect(r.status).toBe("unconfigured");
  });
});
