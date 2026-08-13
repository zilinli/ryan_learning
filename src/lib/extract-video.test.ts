import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FILE_INPUT_ACCEPT,
  isAllowedAttachment,
  isVideoAttachment,
  normalizeMime,
} from "./attachments";
import { buildFileSummaries } from "./extract-files";
import { extractVideoSummary, frameTimestampsSec } from "./extract-video";

describe("short video allowlist", () => {
  it("allows mp4/webm/mov/m4v by extension and MIME", () => {
    expect(isAllowedAttachment("video/mp4", "clip.mp4")).toBe(true);
    expect(isAllowedAttachment("", "demo.webm")).toBe(true);
    expect(isAllowedAttachment("video/quicktime", "phone.mov")).toBe(true);
    expect(isAllowedAttachment("", "screen.m4v")).toBe(true);
    expect(isVideoAttachment("video/mp4", "x")).toBe(true);
    expect(isVideoAttachment("", "x.mp4")).toBe(true);
  });

  it("still rejects exe/zip/legacy avi", () => {
    expect(isAllowedAttachment("", "a.exe")).toBe(false);
    expect(isAllowedAttachment("application/zip", "a.zip")).toBe(false);
    expect(isAllowedAttachment("", "old.avi")).toBe(false);
    expect(isVideoAttachment("video/x-msvideo", "old.avi")).toBe(false);
  });

  it("normalizeMime maps video extensions", () => {
    expect(normalizeMime("", "a.mp4")).toBe("video/mp4");
    expect(normalizeMime("", "a.m4v")).toBe("video/mp4");
    expect(normalizeMime("", "a.webm")).toBe("video/webm");
    expect(normalizeMime("", "a.mov")).toBe("video/quicktime");
  });

  it("FILE_INPUT_ACCEPT lists video tokens", () => {
    expect(FILE_INPUT_ACCEPT).toContain("video/*");
    expect(FILE_INPUT_ACCEPT).toContain(".mp4");
    expect(FILE_INPUT_ACCEPT).toContain("video/webm");
  });
});

describe("frameTimestampsSec", () => {
  it("samples across longer clips", () => {
    expect(frameTimestampsSec(10)).toEqual([1, 5, 9]);
  });

  it("uses a single mid point for tiny clips", () => {
    expect(frameTimestampsSec(0.5)).toEqual([0.2]);
  });
});

describe("extractVideoSummary", () => {
  it("combines transcript and frame OCR via deps", async () => {
    const payload = Buffer.from(
      "fake-video-bytes-long-enough-for-gate",
    ).toString("base64");
    const text = await extractVideoSummary(payload, "lesson.mp4", {
      probeDurationSec: async () => 4,
      extractAudioWav: async (_videoPath, wavPath) => {
        writeFileSync(wavPath, Buffer.alloc(128, 1));
      },
      extractFrames: async (_videoPath, dir) => {
        const framePath = path.join(dir, "frame-0.jpg");
        writeFileSync(framePath, Buffer.alloc(128, 2));
        return [framePath];
      },
      transcribeWav: async () => "two plus two is four",
      ocrFrame: async () => "2 + 2 = ?",
    });
    expect(text).toContain("Duration");
    expect(text).toContain("two plus two is four");
    expect(text).toContain("2 + 2 = ?");
  });

  it("returns empty when payload is tiny", async () => {
    expect(await extractVideoSummary("AAAA", "x.mp4")).toBe("");
  });
});

describe("buildFileSummaries video", () => {
  it("reports honest failure when video has no binary", async () => {
    const out = await buildFileSummaries([
      {
        name: "clip.mp4",
        mimeType: "video/mp4",
        kind: "file",
      },
    ]);
    expect(out[0]).toMatch(/binary payload was missing/i);
  });

  it("includes extracted video summary text", async () => {
    const out = await buildFileSummaries([
      {
        name: "clip.mp4",
        mimeType: "video/mp4",
        kind: "file",
        data: Buffer.from("not-a-real-video").toString("base64"),
      },
    ]);
    expect(out[0]).toMatch(
      /could not be extracted|Speech transcript|On-screen|Duration/i,
    );
  });
});
