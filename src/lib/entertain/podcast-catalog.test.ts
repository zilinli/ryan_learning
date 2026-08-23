import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findPodcastShow,
  parsePodcastShowId,
  PODCAST_CATALOG,
  resolveShowFeed,
  setPodcastFeedCacheDirForTests,
} from "./podcast-catalog";

describe("podcast catalog", () => {
  it("contains the 5 requested shows", () => {
    const titles = PODCAST_CATALOG.map((s) => s.title);
    expect(titles).toContain("Freakonomics Radio");
    expect(titles).toContain("Stuff You Should Know");
    expect(titles).toContain("TED Talks Daily");
    expect(titles).toContain("Radiolab");
    expect(titles).toContain("The Rest Is History");
  });

  it("finds shows by id (case-insensitive)", () => {
    expect(findPodcastShow("freakonomics-radio")?.title).toBe("Freakonomics Radio");
    expect(findPodcastShow("TED-TALKS-DAILY")?.id).toBe("ted-talks-daily");
    expect(findPodcastShow(null)).toBeNull();
    expect(findPodcastShow("nope")).toBeNull();
  });

  it("parses show ids by title", () => {
    expect(parsePodcastShowId("TED Talks Daily")).toBe("ted-talks-daily");
    expect(parsePodcastShowId("")).toBeNull();
  });

  it("every catalog show has a feed or a collectionId for resolution", () => {
    for (const s of PODCAST_CATALOG) {
      expect(Boolean(s.feedUrl || s.collectionId)).toBe(true);
    }
  });
});

describe("resolveShowFeed", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "podcast-feed-"));
    setPodcastFeedCacheDirForTests(dir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("returns the hardcoded feedUrl without network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
    const show = findPodcastShow("radiolab")!;
    const feed = await resolveShowFeed(show);
    expect(feed).toBe("https://feeds.simplecast.com/EmVW7VGp");
  });

  it("resolves via iTunes lookup when feedUrl is missing and caches the result", async () => {
    const show = {
      id: "custom-show",
      title: "Custom Show",
      host: "Host",
      collectionId: 9999,
      topics: ["ideas"] as const,
      blurb: "x",
    };
    const lookupUrl = "https://itunes.apple.com/lookup?id=9999&entity=podcast";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === lookupUrl) {
          return new Response(
            JSON.stringify({ resultCount: 1, results: [{ feedUrl: "https://cdn.example.com/feed.xml" }] }),
            { status: 200 },
          );
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const feed = await resolveShowFeed(show);
    expect(feed).toBe("https://cdn.example.com/feed.xml");

    // Second call must hit the disk cache, not iTunes.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
    const cached = await resolveShowFeed(show);
    expect(cached).toBe("https://cdn.example.com/feed.xml");
  });

  it("resolves via iTunes search when there is no collectionId", async () => {
    const show = {
      id: "search-only",
      title: "Mystery Radio",
      host: "Host",
      topics: ["history"] as const,
      blurb: "x",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        expect(String(url)).toContain("itunes.apple.com/search");
        return new Response(
          JSON.stringify({
            resultCount: 2,
            results: [
              { collectionName: "Other Thing", feedUrl: "https://other.example/feed.xml" },
              { collectionName: "Mystery Radio", feedUrl: "https://mystery.example/feed.xml" },
            ],
          }),
          { status: 200 },
        );
      }),
    );
    const feed = await resolveShowFeed(show);
    expect(feed).toBe("https://mystery.example/feed.xml");
  });

  it("throws when resolution fails and no feedUrl exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ resultCount: 0, results: [] }), { status: 200 }),
      ),
    );
    const show = {
      id: "broken",
      title: "Broken",
      host: "Host",
      collectionId: 1,
      topics: ["ideas"] as const,
      blurb: "x",
    };
    await expect(resolveShowFeed(show)).rejects.toThrow();
  });
});
