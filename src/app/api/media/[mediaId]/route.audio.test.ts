import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, parseBytesRange } from "./route";
import * as mediaStore from "@/lib/media-store";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseBytesRange", () => {
  it("parses start-end and suffix forms", () => {
    expect(parseBytesRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseBytesRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseBytesRange("bytes=-5", 100)).toEqual({ start: 95, end: 99 });
    expect(parseBytesRange("bytes=0-1", 0)).toBeNull();
    expect(parseBytesRange(null, 100)).toBeNull();
  });
});

describe("GET /api/media/[mediaId] — audio inline", () => {
  it("serves audio without Content-Disposition (for <audio> playback)", async () => {
    vi.spyOn(mediaStore, "readMedia").mockResolvedValue({
      buf: Buffer.from("ID3fake"),
      mimeType: "audio/mpeg",
      name: "Bay Song.mp3",
      kind: "file",
    });

    const res = await GET(
      new Request("http://localhost/api/media/song_123_abcd"),
      { params: Promise.resolve({ mediaId: "song_123_abcd" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Disposition")).toBeNull();
  });

  it("returns 206 Partial Content for Range requests (iOS Safari)", async () => {
    const buf = Buffer.from("0123456789ABCDEF");
    vi.spyOn(mediaStore, "readMedia").mockResolvedValue({
      buf,
      mimeType: "audio/mpeg",
      name: "clip.mp3",
      kind: "file",
    });

    const res = await GET(
      new Request("http://localhost/api/media/song_range_test", {
        headers: { Range: "bytes=0-1" },
      }),
      { params: Promise.resolve({ mediaId: "song_range_test" }) },
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(`bytes 0-1/${buf.length}`);
    expect(res.headers.get("Content-Length")).toBe("2");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(Buffer.from("01"))).toBe(true);
  });

  it("attaches Content-Disposition when download=1", async () => {
    vi.spyOn(mediaStore, "readMedia").mockResolvedValue({
      buf: Buffer.from("ID3fake"),
      mimeType: "audio/mpeg",
      name: "Bay Song.mp3",
    });

    const res = await GET(
      new Request("http://localhost/api/media/song_123_abcd?download=1"),
      { params: Promise.resolve({ mediaId: "song_123_abcd" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
  });
});
