import { describe, expect, it } from "vitest";
import { resolveBbcClip } from "./bbc-clip-resolve";
import { resolveRsaVideo } from "./rsa-video-resolve";
import { BBC_CATALOG } from "./bbc-catalog";
import { RSA_CATALOG } from "./rsa-catalog";

describe("live clip resolve", () => {
  it("resolves catalog BBC clip by id", () => {
    const id = BBC_CATALOG[0]!.videoId;
    expect(resolveBbcClip(id)?.videoId).toBe(id);
  });

  it("accepts live BBC payload when not in catalog", () => {
    const clip = resolveBbcClip("dQw4w9WgXcQ", {
      videoId: "dQw4w9WgXcQ",
      title: "Live BBC Earth clip",
      channel: "BBC Earth",
      topic: "nature",
      durationSec: 180,
      blurb: "Live",
    });
    expect(clip?.title).toMatch(/Live BBC/);
    expect(clip?.channel).toBe("BBC Earth");
  });

  it("accepts live RSA payload when not in catalog", () => {
    const id = "aaaaaaaaaaa";
    expect(resolveRsaVideo(id)).toBeNull();
    const v = resolveRsaVideo(id, {
      videoId: id,
      title: "RSA Short live",
      speaker: "Someone",
      series: "Shorts",
      topic: "ideas",
    });
    expect(v?.title).toBe("RSA Short live");
  });

  it("catalog RSA still resolves", () => {
    const id = RSA_CATALOG[0]!.videoId;
    expect(resolveRsaVideo(id)?.videoId).toBe(id);
  });
});
