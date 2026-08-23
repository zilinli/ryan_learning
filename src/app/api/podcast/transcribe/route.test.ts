import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import * as pt from "@/lib/entertain/podcast-transcript";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

const SHOW = {
  id: "radiolab",
  title: "Radiolab",
  host: "Lulu Miller & Latif Nasser",
  topics: ["science", "ideas", "history"],
  blurb: "A narrative science show.",
};

const EPISODE = {
  guid: "ep-1",
  title: "The Wonder Episode",
  description: "About wonder.",
  audioUrl: "https://cdn.example.com/ep1.mp3",
  durationSec: 3000,
  pubDate: "Tue, 01 Jan 2026 10:00:00 GMT",
};

beforeEach(() => {
  resetApiRateLimitForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/podcast/transcribe", () => {
  it("starts a job and returns it", async () => {
    const job = {
      id: "pod_1",
      showId: "radiolab",
      episodeGuid: "ep-1",
      status: "queued",
      progress: 0,
      engine: "bailian",
      createdAt: 1,
      updatedAt: 1,
    } as const;
    vi.spyOn(pt, "requestPodcastTranscript").mockResolvedValue(job as never);

    const res = await POST(
      new Request("http://localhost/api/podcast/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show: SHOW, episode: EPISODE }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.job.id).toBe("pod_1");
  });

  it("rejects missing episode", async () => {
    const res = await POST(
      new Request("http://localhost/api/podcast/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show: SHOW }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown shows", async () => {
    const res = await POST(
      new Request("http://localhost/api/podcast/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show: { id: "nope", title: "Nope" },
          episode: EPISODE,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/podcast/transcribe", () => {
  it("returns the current job state", async () => {
    const job = {
      id: "pod_2",
      showId: "radiolab",
      episodeGuid: "ep-1",
      status: "running",
      progress: 0.5,
      engine: "bailian",
      createdAt: 1,
      updatedAt: 2,
    } as const;
    vi.spyOn(pt, "getPodcastTranscriptJob").mockResolvedValue(job as never);

    const res = await GET(
      new Request("http://localhost/api/podcast/transcribe?id=pod_2"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.job.status).toBe("running");
  });

  it("returns 404 for unknown jobs", async () => {
    vi.spyOn(pt, "getPodcastTranscriptJob").mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/podcast/transcribe?id=zzz"),
    );
    expect(res.status).toBe(404);
  });
});
