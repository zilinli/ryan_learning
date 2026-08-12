import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";
import * as bbcSearch from "@/lib/entertain/bbc-search";

beforeEach(() => {
  resetApiRateLimitForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/bbc/search", () => {
  it("returns live search results", async () => {
    vi.spyOn(bbcSearch, "searchBbcLive").mockResolvedValue({
      clips: [
        {
          videoId: "abc12345678",
          title: "Demo clip",
          series: "Nature",
          topic: "nature",
          durationSec: 240,
          gradeMin: 3,
          gradeMax: 8,
          blurb: "x",
          channel: "BBC Earth",
        },
      ],
      page: 0,
      nbPages: 2,
      nbHits: 10,
      query: "penguin",
      source: "youtube-live",
      cursor: "0:25",
      hasNextPage: true,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/bbc/search?q=penguin&grade=4"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.source).toBe("youtube-live");
    expect(data.clips[0].videoId).toBe("abc12345678");
  });

  it("refresh mode uses refreshBbcBatch", async () => {
    vi.spyOn(bbcSearch, "refreshBbcBatch").mockResolvedValue({
      clips: [
        {
          videoId: "xyz98765432",
          title: "Fresh",
          series: "Science",
          topic: "science",
          durationSec: 200,
          gradeMin: 3,
          gradeMax: 8,
          blurb: "Fresh",
          channel: "BBC Ideas",
        },
      ],
      page: 0,
      nbPages: 2,
      nbHits: 1,
      query: "",
      source: "youtube-live",
      cursor: "1:25",
      hasNextPage: true,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/bbc/search?mode=refresh"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("refresh");
    expect(data.clips[0].videoId).toBe("xyz98765432");
  });
});
