import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deapiGenerateImage,
  deapiGenerateMusic,
  deapiGenerateVideo,
  deapiListModels,
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
});
