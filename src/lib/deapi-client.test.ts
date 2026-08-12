import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deapiGenerateImage,
  deapiGenerateMusic,
  deapiGenerateVideo,
  deapiListModels,
  estimateMusicDurationSec,
  estimateVideoDurationSec,
  isDeapiConfigured,
} from "./deapi-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("deapi-client", () => {
  it("isDeapiConfigured reads DEAPI_API_KEY", () => {
    vi.stubEnv("DEAPI_API_KEY", "");
    expect(isDeapiConfigured()).toBe(false);
    vi.stubEnv("DEAPI_API_KEY", "15571|test");
    expect(isDeapiConfigured()).toBe(true);
  });

  it("lists models and generates music via poll", async () => {
    vi.stubEnv("DEAPI_API_KEY", "test-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v2/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "AceStep Turbo",
                slug: "AceStep_1_5_Turbo",
                info: {
                  limits: {
                    min_duration: 10,
                    max_duration: 300,
                    min_steps: 8,
                    max_steps: 8,
                    min_guidance: 1,
                    max_guidance: 1,
                    max_caption: 300,
                    output_formats: ["mp3"],
                  },
                  defaults: { format: "mp3" },
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/v2/audio/music") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ data: { request_id: "music_req_1" } }),
          { status: 200 },
        );
      }
      if (url.includes("/api/v2/jobs/music_req_1")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "done",
              result_url: "https://results.deapi.ai/x.mp3",
              progress: 100,
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: "unexpected " + url }), {
        status: 500,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const listed = await deapiListModels("txt2music");
    expect(listed.ok).toBe(true);
    expect(listed.models[0]?.slug).toBe("AceStep_1_5_Turbo");

    const r = await deapiGenerateMusic({
      lyrics: "[Verse]\nhello world line enough",
      caption: "warm indie ballad",
      durationSec: 15,
    });
    expect(r.status).toBe("done");
    expect(r.resultUrl).toContain("results.deapi.ai");
    expect(r.model).toBe("AceStep_1_5_Turbo");
    expect(r.durationSec).toBe(15);
  });

  it("estimates longer music duration from rich lyrics", async () => {
    vi.stubEnv("DEAPI_API_KEY", "test-key");
    let postedDuration: number | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v2/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "AceStep Turbo",
                slug: "AceStep_1_5_Turbo",
                info: {
                  limits: {
                    min_duration: 10,
                    max_duration: 300,
                    min_steps: 8,
                    max_steps: 8,
                    min_guidance: 1,
                    max_guidance: 1,
                    max_caption: 300,
                    output_formats: ["mp3"],
                  },
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/v2/audio/music") && init?.method === "POST") {
        const form = init.body as FormData;
        postedDuration = Number(form.get("duration"));
        return new Response(
          JSON.stringify({ data: { request_id: "music_long" } }),
          { status: 200 },
        );
      }
      if (url.includes("/jobs/music_long")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "done",
              result_url: "https://results.deapi.ai/long.mp3",
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const lyrics = [
      "[Verse]",
      "Rain taps the cracked phone screen on the bus seat twice",
      "The diesel smell sticks to my hoodie after school today",
      "[Chorus]",
      "I pocket the silence and walk home alone in the cold",
      "One laugh from the back row lands at the wrong time again",
      "[Verse]",
      "Neon puddles mirror every step I try not to take",
      "My backpack straps dig in like reminders of the day",
      "[Chorus]",
      "I pocket the silence and walk home alone in the cold",
      "One laugh from the back row lands at the wrong time again",
    ].join("\n");
    const expected = estimateMusicDurationSec(lyrics);
    expect(expected).toBeGreaterThan(30);

    const r = await deapiGenerateMusic({
      lyrics,
      caption: "indie ballad",
    });
    expect(r.status).toBe("done");
    expect(postedDuration).toBe(expected);
    expect(r.durationSec).toBe(expected);
  });

  it("generates image with JSON body", async () => {
    vi.stubEnv("DEAPI_API_KEY", "test-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v2/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "Flux",
                slug: "Flux1schnell",
                info: {
                  limits: {
                    min_width: 256,
                    max_width: 2048,
                    min_height: 256,
                    max_height: 2048,
                    min_steps: 1,
                    max_steps: 10,
                  },
                  defaults: { width: 768, height: 768, steps: 4 },
                  features: { supports_negative_prompt: true },
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/images/generations") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { prompt: string };
        expect(body.prompt).toContain("sunset");
        return new Response(
          JSON.stringify({ data: { request_id: "img_1" } }),
          { status: 200 },
        );
      }
      if (url.includes("/jobs/img_1")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "done",
              result_url: "https://results.deapi.ai/y.png",
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await deapiGenerateImage({ prompt: "a soft sunset over hills" });
    expect(r.status).toBe("done");
    expect(r.mimeType).toBe("image/png");
  });

  it("generates video with frames/fps", async () => {
    vi.stubEnv("DEAPI_API_KEY", "test-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v2/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "LTX",
                slug: "Ltxv_13B_0_9_8_Distilled_FP8",
                inference_types: ["txt2video"],
                info: {
                  limits: {
                    min_width: 256,
                    max_width: 768,
                    min_height: 256,
                    max_height: 768,
                    min_frames: 30,
                    max_frames: 120,
                    min_fps: 30,
                    max_fps: 30,
                    min_steps: 1,
                    max_steps: 1,
                  },
                  defaults: {
                    width: 512,
                    height: 512,
                    frames: 60,
                    fps: 30,
                    steps: 1,
                  },
                  features: { supports_negative_prompt: true },
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/videos/generations") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ data: { request_id: "vid_1" } }),
          { status: 200 },
        );
      }
      if (url.includes("/jobs/vid_1")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "done",
              result_url: "https://results.deapi.ai/z.mp4",
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await deapiGenerateVideo({ prompt: "leaves falling gently" });
    expect(r.status).toBe("done");
    expect(r.mimeType).toBe("video/mp4");
  });

  it("scales video frames from prompt content instead of fixed default", async () => {
    vi.stubEnv("DEAPI_API_KEY", "test-key");
    let posted: { frames?: number; fps?: number; model?: string } = {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v2/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "LTX",
                slug: "Ltxv_13B_0_9_8_Distilled_FP8",
                inference_types: ["txt2video"],
                info: {
                  limits: {
                    min_width: 256,
                    max_width: 768,
                    min_height: 256,
                    max_height: 768,
                    min_frames: 30,
                    max_frames: 120,
                    min_fps: 30,
                    max_fps: 30,
                    min_steps: 1,
                    max_steps: 1,
                  },
                  defaults: {
                    width: 512,
                    height: 512,
                    frames: 30,
                    fps: 30,
                    steps: 1,
                  },
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/videos/generations") && init?.method === "POST") {
        posted = JSON.parse(String(init.body || "{}")) as typeof posted;
        return new Response(
          JSON.stringify({ data: { request_id: "vid_scale" } }),
          { status: 200 },
        );
      }
      if (url.includes("/jobs/vid_scale")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "done",
              result_url: "https://results.deapi.ai/scaled.mp4",
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rich =
      "A girl opens the bus window. Then the camera pans to rain on the cracked phone. After that, push-in on her hoodie. Next, tracking shot as she walks home alone.";
    const want = estimateVideoDurationSec(rich);
    expect(want).toBeGreaterThan(3);

    const r = await deapiGenerateVideo({ prompt: rich });
    expect(r.status).toBe("done");
    expect(posted.fps).toBe(30);
    expect(posted.frames).toBe(Math.min(120, Math.max(30, Math.round(want * 30))));
    expect(r.durationSec).toBeCloseTo((posted.frames || 0) / 30, 1);
  });

  it("picks longer-capable video model when content needs more than 4s", async () => {
    vi.stubEnv("DEAPI_API_KEY", "test-key");
    let posted: { frames?: number; fps?: number; model?: string } = {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v2/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "LTX short",
                slug: "Ltxv_13B_0_9_8_Distilled_FP8",
                inference_types: ["txt2video"],
                info: {
                  limits: {
                    min_frames: 30,
                    max_frames: 120,
                    min_fps: 30,
                    max_fps: 30,
                    min_width: 256,
                    max_width: 768,
                    min_height: 256,
                    max_height: 768,
                  },
                  defaults: { fps: 30, frames: 120, width: 512, height: 512 },
                },
              },
              {
                name: "LTX2 long",
                slug: "Ltx2_3_22B_Dist_INT8",
                inference_types: ["txt2video"],
                info: {
                  limits: {
                    min_frames: 49,
                    max_frames: 241,
                    min_fps: 24,
                    max_fps: 24,
                    min_width: 256,
                    max_width: 768,
                    min_height: 256,
                    max_height: 768,
                  },
                  defaults: { fps: 24, frames: 120, width: 768, height: 768 },
                },
              },
            ],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/videos/generations") && init?.method === "POST") {
        posted = JSON.parse(String(init.body || "{}")) as typeof posted;
        return new Response(
          JSON.stringify({ data: { request_id: "vid_long" } }),
          { status: 200 },
        );
      }
      if (url.includes("/jobs/vid_long")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "done",
              result_url: "https://results.deapi.ai/long.mp4",
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const rich =
      "Open on a rainy bus. Then pan to the cracked phone. After that, push-in on the hoodie. Next, tracking shot down the wet street. Finally dusk lights flicker on empty windows.";
    const want = estimateVideoDurationSec(rich);
    expect(want).toBeGreaterThan(4);

    const r = await deapiGenerateVideo({ prompt: rich });
    expect(r.status).toBe("done");
    expect(posted.model).toBe("Ltx2_3_22B_Dist_INT8");
    expect(posted.fps).toBe(24);
    expect(posted.frames).toBe(
      Math.min(241, Math.max(49, Math.round(want * 24))),
    );
    expect(r.durationSec).toBeGreaterThan(4);
  });

  it("estimateVideoDurationSec grows with scene beats", () => {
    const short = estimateVideoDurationSec("A cat sits in warm sun.");
    const long = estimateVideoDurationSec(
      "A girl opens the bus window. Then the camera pans to rain. After that, push-in on her hoodie. Next, tracking shot home. Finally dusk lights flicker.",
    );
    expect(long).toBeGreaterThan(short);
    expect(short).toBeLessThanOrEqual(4);
    expect(long).toBeGreaterThan(4);
  });

  it("estimateMusicDurationSec grows with lyric length", () => {
    const short = estimateMusicDurationSec("[Verse]\nhello world");
    const long = estimateMusicDurationSec(
      "[Verse]\n" +
        "line one with many words about the bus ride home\n".repeat(8) +
        "[Chorus]\n" +
        "hook line that repeats with feeling and detail\n".repeat(4),
    );
    expect(long).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(30);
  });
});
