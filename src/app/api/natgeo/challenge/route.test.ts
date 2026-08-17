import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Live-network and Cursor-Agent calls are not available in CI / sandbox:
// catalog articles exist locally, but YouTube CC fetch + NatGeo scrape + the
// Cursor agent would hang. Force deterministic fallback and stub the network.
vi.mock("@/lib/youtube-transcript", () => ({
  fetchYouTubeTranscript: vi.fn(async () => null),
}));

vi.mock("@/lib/entertain/natgeo-scrape", () => ({
  fetchNatGeoArticle: vi.fn(async () => null),
}));

describe("POST /api/natgeo/challenge", () => {
  beforeEach(() => {
    process.env.NATGEO_CHALLENGE_FORCE_FALLBACK = "1";
  });

  afterEach(() => {
    delete process.env.NATGEO_CHALLENGE_FORCE_FALLBACK;
  });

  it("returns fallback challenge for catalog article", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "african-lion",
        learner: { grade: 4, englishLevel: "developing" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.challenge).toBeTruthy();
    expect(body.challenge.articleSlug).toBe("african-lion");
    expect(body.challenge.items.length).toBe(5);
    expect(body.challenge.generatedFromAI).toBe(false);
  });

  it("returns 400 for missing slug", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown article slug", async () => {
    // Env already set in beforeEach — keep for clarity
    process.env.NATGEO_CHALLENGE_FORCE_FALLBACK = "1";
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "nonexistent-article-12345" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  it("challenge items have valid structure", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "african-lion",
        learner: { grade: 6, englishLevel: "confident" },
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    for (const item of body.challenge.items) {
      expect(item.id).toBeTruthy();
      expect(item.prompt.length).toBeGreaterThan(5);
      expect(item.choices.length).toBe(4);
      expect(item.correctChoices.length).toBeGreaterThanOrEqual(1);
    }
  });
});
