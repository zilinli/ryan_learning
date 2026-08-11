import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";
import * as tedSearch from "@/lib/entertain/ted-search";

beforeEach(() => {
  resetApiRateLimitForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/ted/search", () => {
  it("returns live search results", async () => {
    vi.spyOn(tedSearch, "searchTedLive").mockResolvedValue({
      talks: [
        {
          slug: "demo_talk",
          title: "Demo",
          speaker: "A",
          durationSec: 600,
          topics: ["ideas"],
          blurb: "x",
        },
      ],
      page: 0,
      nbPages: 3,
      nbHits: 40,
      query: "demo",
      source: "ted-live",
      officialSearchUrl: "https://www.ted.com/talks?q=demo",
      officialBrowseUrl: "https://www.ted.com/talks?sort=newest",
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/ted/search?q=demo&page=0"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.source).toBe("ted-live");
    expect(data.talks[0].slug).toBe("demo_talk");
    expect(data.nbHits).toBe(40);
  });

  it("refresh mode uses browseTedNewest", async () => {
    vi.spyOn(tedSearch, "browseTedNewest").mockResolvedValue({
      talks: [
        {
          slug: "new_one",
          title: "New",
          speaker: "B",
          durationSec: 400,
          topics: ["science"],
          blurb: "Fresh",
        },
      ],
      endCursor: "12",
      hasNextPage: true,
      source: "ted-live",
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/ted/search?mode=refresh"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("refresh");
    expect(data.endCursor).toBe("12");
    expect(data.talks[0].slug).toBe("new_one");
  });
});
