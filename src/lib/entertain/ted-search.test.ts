import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browseTedNewest,
  officialTedBrowseUrl,
  officialTedSearchUrl,
  searchTedLive,
  TED_SEARCH_INDEX,
} from "./ted-search";

const OLD_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = OLD_FETCH;
  vi.restoreAllMocks();
});

describe("ted-search helpers", () => {
  it("builds official TED search / browse URLs", () => {
    expect(officialTedBrowseUrl()).toMatch(/ted\.com\/talks/);
    expect(officialTedSearchUrl("creativity", "science")).toMatch(/q=creativity/);
    expect(officialTedSearchUrl("creativity", "science")).toMatch(/topics/);
  });
});

describe("searchTedLive", () => {
  it("maps InstantSearch hits from TED /api/search", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        results: [
          {
            query: "creativity",
            page: 0,
            nbPages: 10,
            nbHits: 100,
            hits: [
              {
                slug: "sir_ken_robinson_do_schools_kill_creativity",
                title: "Do schools kill creativity?",
                speakers: "Sir Ken Robinson",
                duration: "1164",
              },
            ],
          },
        ],
      }),
    ) as typeof fetch;

    const r = await searchTedLive({ query: "creativity", page: 0 });
    expect(r.source).toBe("ted-live");
    expect(r.nbHits).toBe(100);
    expect(r.talks[0]?.slug).toContain("robinson");
    expect(r.talks[0]?.title).toMatch(/creativity/i);
    expect(TED_SEARCH_INDEX).toMatch(/coyote_models/);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toContain("ted.com/api/search");
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].params.query).toBe("creativity");
  });

  it("applies topic facetFilters", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        results: [
          {
            query: "",
            page: 0,
            nbPages: 5,
            nbHits: 50,
            hits: [
              {
                slug: "some_science_talk",
                title: "Science talk",
                speakers: "Ada",
                duration: 600,
              },
            ],
          },
        ],
      }),
    ) as typeof fetch;

    await searchTedLive({ query: "", topic: "science", page: 1 });
    const body = JSON.parse(
      String(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
          .body,
      ),
    );
    expect(body[0].params.page).toBe(1);
    expect(body[0].params.facetFilters).toEqual([["tags:science"]]);
  });

  it("falls back to curated catalog when TED search fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const r = await searchTedLive({ query: "grit", topic: "all" });
    expect(r.source).toBe("curated-fallback");
    expect(r.talks.length).toBeGreaterThan(0);
    expect(r.talks.some((t) => t.slug.includes("grit"))).toBe(true);
  });
});

describe("browseTedNewest", () => {
  it("maps GraphQL videos page", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        data: {
          videos: {
            edges: [
              {
                node: {
                  slug: "fresh_new_talk",
                  title: "A fresh talk",
                  duration: 500,
                  presenterDisplayName: "Speaker X",
                  topics: { nodes: [{ name: "science" }] },
                },
              },
            ],
            pageInfo: { endCursor: "18", hasNextPage: true },
          },
        },
      }),
    ) as typeof fetch;

    const r = await browseTedNewest({ first: 12 });
    expect(r.source).toBe("ted-live");
    expect(r.hasNextPage).toBe(true);
    expect(r.endCursor).toBe("18");
    expect(r.talks[0]?.slug).toBe("fresh_new_talk");
    expect(r.talks[0]?.topics).toContain("science");
  });
});
