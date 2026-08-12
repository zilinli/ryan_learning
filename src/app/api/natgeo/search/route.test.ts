import { describe, expect, it } from "vitest";

describe("GET /api/natgeo/search", () => {
  it("returns all articles with no query", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/search");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.articles.length).toBeGreaterThanOrEqual(25);
    expect(body.total).toBe(body.articles.length);
    expect(body.topics).toBeTruthy();
  });

  it("filters by topic", async () => {
    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/natgeo/search?topic=space",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    for (const a of body.articles) {
      expect(a.topic).toBe("space");
    }
  });

  it("filters by query", async () => {
    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/natgeo/search?q=volcano",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.articles.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by grade", async () => {
    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/natgeo/search?grade=4",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    for (const a of body.articles) {
      expect(a.gradeMin).toBeLessThanOrEqual(4);
      expect(a.gradeMax).toBeGreaterThanOrEqual(4);
    }
  });

  it("handles unknown topic gracefully", async () => {
    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/natgeo/search?topic=unknown",
    );
    const res = await GET(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Should return all articles since topic is invalid
    expect(body.articles.length).toBeGreaterThan(0);
  });

  it("each article has only metadata (no body)", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/natgeo/search");
    const res = await GET(req);
    const body = await res.json();
    for (const a of body.articles) {
      expect(a.slug).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.topic).toBeTruthy();
      expect(a.gradeMin).toBeGreaterThanOrEqual(1);
      expect(a.gradeMax).toBeLessThanOrEqual(12);
      expect(a.readingTimeMin).toBeGreaterThanOrEqual(1);
      expect(a.blurb).toBeTruthy();
      // Search endpoint should NOT return full body
      expect(a.body).toBeUndefined();
    }
  });
});
