import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";
import * as rsaSearch from "@/lib/entertain/rsa-search";

beforeEach(() => {
  resetApiRateLimitForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/rsa/search", () => {
  it("returns live search results", async () => {
    vi.spyOn(rsaSearch, "searchRsaLive").mockResolvedValue({
      videos: [
        {
          videoId: "abc12345678",
          title: "Demo RSA",
          speaker: "RSA",
          series: "Animate",
          topic: "ideas",
          durationSec: 600,
          gradeMin: 6,
          gradeMax: 12,
          blurb: "x",
        },
      ],
      page: 0,
      nbPages: 2,
      nbHits: 5,
      query: "motivation",
      source: "youtube-live",
      cursor: "25",
      hasNextPage: true,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/rsa/search?q=motivation"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("youtube-live");
    expect(data.videos[0].title).toBe("Demo RSA");
  });

  it("falls back to curated on refresh mock", async () => {
    vi.spyOn(rsaSearch, "refreshRsaBatch").mockResolvedValue({
      videos: [
        {
          videoId: "curated0001",
          title: "Curated",
          speaker: "RSA",
          series: "Shorts",
          topic: "psychology",
          durationSec: 120,
          gradeMin: 6,
          gradeMax: 12,
          blurb: "backup",
        },
      ],
      page: 0,
      nbPages: 1,
      nbHits: 1,
      query: "",
      source: "curated-fallback",
      cursor: "1",
      hasNextPage: false,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/rsa/search?mode=refresh"),
    );
    const data = await res.json();
    expect(data.source).toBe("curated-fallback");
  });
});
