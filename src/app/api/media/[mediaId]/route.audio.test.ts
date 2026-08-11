import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import * as mediaStore from "@/lib/media-store";

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(res.headers.get("Content-Disposition")).toBeNull();
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
