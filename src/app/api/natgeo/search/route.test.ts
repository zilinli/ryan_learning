import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";
import * as natgeoSearch from "@/lib/entertain/natgeo-search";

beforeEach(() => {
  resetApiRateLimitForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/natgeo/search", () => {
  it("returns search results", async () => {
    vi.spyOn(natgeoSearch, "searchNatGeoLive").mockResolvedValue({
      articles: [
        {
          slug: "african-lion",
          title: "African Lion",
          topic: "animals",
          gradeMin: 2,
          gradeMax: 6,
          readingTimeMin: 3,
          blurb: "Lions",
          imageUrl: "https://example.com/lion",
          body: "Lion body text long enough for tests.",
        },
      ],
      page: 0,
      nbPages: 1,
      nbHits: 1,
      query: "lion",
      source: "natgeo-live",
      cursor: "1",
      hasNextPage: false,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/natgeo/search?q=lion"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.articles[0].slug).toBe("african-lion");
    expect(data.source).toBe("natgeo-live");
  });

  it("refresh mode uses refreshNatGeoBatch", async () => {
    vi.spyOn(natgeoSearch, "refreshNatGeoBatch").mockResolvedValue({
      articles: [
        {
          slug: "emperor-penguin",
          title: "Emperor Penguin",
          topic: "animals",
          gradeMin: 2,
          gradeMax: 6,
          readingTimeMin: 2,
          blurb: "Penguins",
          imageUrl: "https://example.com/penguin",
          body: "Penguin body.",
        },
      ],
      page: 0,
      nbPages: 2,
      nbHits: 30,
      query: "",
      source: "curated-fallback",
      cursor: "18",
      hasNextPage: true,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/natgeo/search?mode=refresh"),
    );
    const data = await res.json();
    expect(data.mode).toBe("refresh");
    expect(data.articles[0].slug).toBe("emperor-penguin");
  });
});
