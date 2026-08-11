import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as music from "@/lib/music-generate";
import * as creations from "@/lib/entertain/creations-store";
import * as mediaStore from "@/lib/media-store";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

const OLD_ENV = { ...process.env };

function req(body: unknown) {
  return new Request("http://localhost/api/lyric-studio/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const LONG_LYRICS = `[Verse]
A quiet morning by the bay with gulls
[Chorus]
Hold the feeling, say it twice again
`;

beforeEach(() => {
  process.env = { ...OLD_ENV };
  resetApiRateLimitForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/lyric-studio/generate", () => {
  it("returns 503 when no provider configured", async () => {
    vi.spyOn(music, "isMusicGenerateConfigured").mockReturnValue(false);
    const res = await POST(req({ lyrics: LONG_LYRICS, caption: "Indie" }));
    expect(res.status).toBe(503);
  });

  it("rejects short lyrics", async () => {
    vi.spyOn(music, "isMusicGenerateConfigured").mockReturnValue(true);
    const res = await POST(req({ lyrics: "too short", caption: "x" }));
    expect(res.status).toBe(400);
  });

  it("persists audio from fallback success", async () => {
    vi.spyOn(music, "isMusicGenerateConfigured").mockReturnValue(true);
    vi.spyOn(music, "generateSongWithFallback").mockResolvedValue({
      ok: true,
      status: "done",
      provider: "volc-postpaid",
      audioBase64: Buffer.from("ID3fake-mp3").toString("base64"),
      mimeType: "audio/mpeg",
      attempts: ["fail:bailian", "ok:volc-postpaid"],
    });
    vi.spyOn(mediaStore, "writeMediaBytes").mockResolvedValue({
      mediaId: "song_test",
      mimeType: "audio/mpeg",
      sessionId: "lyric-studio",
      messageId: "generate",
      attachmentId: "song_test",
      bytes: 11,
      accountId: "acct_test_gen",
    });
    vi.spyOn(creations, "addCreation").mockResolvedValue({
      id: "cr_1",
      type: "song",
      title: "Bay Song",
      createdAt: 1,
      accountId: "acct_test_gen",
      lyrics: LONG_LYRICS,
      audioMediaId: "song_test",
    });

    const res = await POST(
      req({
        lyrics: LONG_LYRICS,
        title: "Bay Song",
        accountId: "acct_test_gen",
        gender: "male",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.provider).toBe("volc-postpaid");
    expect(data.attempts.length).toBeGreaterThan(0);
  });
});
