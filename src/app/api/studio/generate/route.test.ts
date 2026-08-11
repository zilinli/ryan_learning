import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as music from "@/lib/music-generate";
import * as deapi from "@/lib/deapi-client";
import * as creations from "@/lib/entertain/creations-store";
import * as mediaStore from "@/lib/media-store";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

const OLD_ENV = { ...process.env };

function req(body: unknown) {
  return new Request("http://localhost/api/studio/generate", {
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

const VISUAL_PROMPT =
  "A thoughtful student at a sunlit desk with an open notebook, soft natural light, intimate indie still";

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

describe("POST /api/studio/generate", () => {
  it("rejects invalid kind", async () => {
    const res = await POST(req({ kind: "podcast", prompt: "x".repeat(20) }));
    expect(res.status).toBe(400);
  });

  it("music returns 503 when unconfigured", async () => {
    vi.spyOn(music, "isMusicGenerateConfigured").mockReturnValue(false);
    const res = await POST(
      req({ kind: "music", lyrics: LONG_LYRICS, caption: "Indie" }),
    );
    expect(res.status).toBe(503);
  });

  it("music rejects short lyrics", async () => {
    vi.spyOn(music, "isMusicGenerateConfigured").mockReturnValue(true);
    const res = await POST(
      req({ kind: "music", lyrics: "too short", caption: "x" }),
    );
    expect(res.status).toBe(400);
  });

  it("music persists audio from fallback success", async () => {
    vi.spyOn(music, "isMusicGenerateConfigured").mockReturnValue(true);
    vi.spyOn(music, "generateSongWithFallback").mockResolvedValue({
      ok: true,
      status: "done",
      provider: "deapi",
      audioBase64: Buffer.from("ID3fake-mp3").toString("base64"),
      mimeType: "audio/mpeg",
      attempts: ["ok:deapi"],
    });
    vi.spyOn(mediaStore, "writeMediaBytes").mockResolvedValue({
      mediaId: "song_test",
      mimeType: "audio/mpeg",
      sessionId: "writing-studio",
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
        kind: "music",
        lyrics: LONG_LYRICS,
        title: "Bay Song",
        accountId: "acct_test_gen",
        gender: "male",
        caption: "Indie mood",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.kind).toBe("music");
    expect(data.provider).toBe("deapi");
  });

  it("image/video return 503 when deAPI unconfigured", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(false);
    const res = await POST(req({ kind: "image", prompt: VISUAL_PROMPT }));
    expect(res.status).toBe(503);
  });

  it("rejects lyric-shaped image prompts", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(true);
    const res = await POST(
      req({
        kind: "image",
        prompt: LONG_LYRICS,
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(String(data.error)).toMatch(/lyrics/i);
  });

  it("rejects lyric-shaped video body even with caption", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(true);
    const res = await POST(
      req({
        kind: "video",
        lyrics: LONG_LYRICS,
        caption: "cinematic mood",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(String(data.error)).toMatch(/lyrics/i);
  });

  it("image generation stores media on success", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(true);
    vi.spyOn(deapi, "deapiGenerateImage").mockResolvedValue({
      status: "done",
      resultUrl: "https://cdn.example/img.png",
      mimeType: "image/png",
      model: "flux",
      requestId: "req_img",
    });
    vi.spyOn(mediaStore, "writeMediaBytes").mockResolvedValue({
      mediaId: "image_test",
      mimeType: "image/png",
      sessionId: "writing-studio",
      messageId: "image",
      attachmentId: "image_test",
      bytes: 4,
      accountId: "acct_img",
    });
    vi.spyOn(creations, "addCreation").mockResolvedValue({
      id: "cr_img",
      type: "image",
      title: "Desk",
      createdAt: 1,
      accountId: "acct_img",
      mediaId: "image_test",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("cdn.example")) {
          return new Response(Buffer.from("PNG!"), {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        }
        return new Response("no", { status: 404 });
      }),
    );

    const res = await POST(
      req({
        kind: "image",
        title: "Desk",
        accountId: "acct_img",
        prompt: VISUAL_PROMPT,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.kind).toBe("image");
    expect(data.url).toMatch(/\/api\/media\//);
    expect(data.provider).toBe("deapi");
  });

  it("video generation stores media on success", async () => {
    vi.spyOn(deapi, "isDeapiConfigured").mockReturnValue(true);
    vi.spyOn(deapi, "deapiGenerateVideo").mockResolvedValue({
      status: "done",
      resultUrl: "https://cdn.example/clip.mp4",
      mimeType: "video/mp4",
      model: "seedance",
      requestId: "req_vid",
    });
    vi.spyOn(mediaStore, "writeMediaBytes").mockResolvedValue({
      mediaId: "video_test",
      mimeType: "video/mp4",
      sessionId: "writing-studio",
      messageId: "video",
      attachmentId: "video_test",
      bytes: 4,
      accountId: "acct_vid",
    });
    vi.spyOn(creations, "addCreation").mockResolvedValue({
      id: "cr_vid",
      type: "video",
      title: "Pan",
      createdAt: 1,
      accountId: "acct_vid",
      mediaId: "video_test",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("cdn.example")) {
          return new Response(Buffer.from("mp4!"), {
            status: 200,
            headers: { "content-type": "video/mp4" },
          });
        }
        return new Response("no", { status: 404 });
      }),
    );

    const res = await POST(
      req({
        kind: "video",
        title: "Pan",
        accountId: "acct_vid",
        prompt:
          "Slow push-in on a quiet desk by a window, dust motes drifting, soft daylight",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.kind).toBe("video");
    expect(data.model).toBe("seedance");
  });
});
