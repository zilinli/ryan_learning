import { describe, expect, it } from "vitest";
import {
  creationDownloadMediaId,
  creationDownloadUrl,
  withMediaDownloadParam,
} from "./creation-download";

describe("creationDownloadMediaId", () => {
  it("returns audioMediaId for songs when present", () => {
    expect(
      creationDownloadMediaId({
        type: "song",
        audioMediaId: "song_abc",
      }),
    ).toBe("song_abc");
  });

  it("returns null for songs when missing or absent", () => {
    expect(creationDownloadMediaId({ type: "song" })).toBeNull();
    expect(
      creationDownloadMediaId({
        type: "song",
        audioMediaId: "song_abc",
        audioMissing: true,
      }),
    ).toBeNull();
  });

  it("returns mediaId for video and image", () => {
    expect(
      creationDownloadMediaId({ type: "video", mediaId: "vid_1" }),
    ).toBe("vid_1");
    expect(
      creationDownloadMediaId({ type: "image", mediaId: "img_1" }),
    ).toBe("img_1");
  });

  it("returns null for video when mediaMissing", () => {
    expect(
      creationDownloadMediaId({
        type: "video",
        mediaId: "vid_1",
        mediaMissing: true,
      }),
    ).toBeNull();
  });

  it("returns null for TED / challenge types", () => {
    expect(
      creationDownloadMediaId({ type: "ted_challenge" }),
    ).toBeNull();
  });
});

describe("creationDownloadUrl", () => {
  it("builds /api/media/:id?download=1 for videos", () => {
    expect(
      creationDownloadUrl({ type: "video", mediaId: "vid_x" }),
    ).toBe("/api/media/vid_x?download=1");
  });

  it("encodes mediaId", () => {
    expect(
      creationDownloadUrl({ type: "song", audioMediaId: "song_a-b" }),
    ).toBe("/api/media/song_a-b?download=1");
  });
});

describe("withMediaDownloadParam", () => {
  it("appends ?download=1", () => {
    expect(withMediaDownloadParam("/api/media/vid_1")).toBe(
      "/api/media/vid_1?download=1",
    );
  });

  it("appends &download=1 when query exists", () => {
    expect(withMediaDownloadParam("/api/media/vid_1?x=1")).toBe(
      "/api/media/vid_1?x=1&download=1",
    );
  });

  it("is idempotent", () => {
    expect(withMediaDownloadParam("/api/media/vid_1?download=1")).toBe(
      "/api/media/vid_1?download=1",
    );
  });
});
