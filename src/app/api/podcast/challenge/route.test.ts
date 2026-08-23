import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import * as transcriptCache from "@/lib/entertain/podcast-transcript";
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
  description: "About wonder and science.",
  audioUrl: "https://cdn.example.com/ep1.mp3",
  durationSec: 3000,
  pubDate: "Tue, 01 Jan 2026 10:00:00 GMT",
};

const TRANSCRIPT =
  "In this episode they explain how wonder drives discovery. " +
  "Scientists observed children who kept asking why. " +
  "A famous story shows a question leading to a new experiment. " +
  "The hosts argue that wonder matters more than facts. ".repeat(3);

function body(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ show: SHOW, episode: EPISODE, ...overrides });
}

beforeEach(() => {
  resetApiRateLimitForTests();
  process.env.PODCAST_CHALLENGE_FORCE_FALLBACK = "1";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.PODCAST_CHALLENGE_FORCE_FALLBACK;
});

describe("POST /api/podcast/challenge", () => {
  it("rejects missing show/episode", async () => {
    const res = await POST(
      new Request("http://localhost/api/podcast/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when the transcript is not ready", async () => {
    vi.spyOn(transcriptCache, "readTranscriptCache").mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/podcast/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body(),
      }),
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.status).toBe("transcript_pending");
  });

  it("builds a valid hybrid challenge from the cached transcript", async () => {
    vi.spyOn(transcriptCache, "readTranscriptCache").mockResolvedValue(TRANSCRIPT);
    const res = await POST(
      new Request("http://localhost/api/podcast/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body({ learner: { age: 9, grade: 4 } }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.challenge.talkSlug).toBe("podcast:radiolab:ep-1");
    expect(data.challenge.items.length).toBeGreaterThanOrEqual(4);
    const kinds = new Set(data.challenge.items.map((i: { kind: string }) => i.kind));
    expect(kinds.has("literal")).toBe(true);
    expect(kinds.has("critique")).toBe(true);
  });

  it("rejects shows not in the catalog", async () => {
    const res = await POST(
      new Request("http://localhost/api/podcast/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          show: { id: "evil-show", title: "Evil" },
          episode: EPISODE,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
