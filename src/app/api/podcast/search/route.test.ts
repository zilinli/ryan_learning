import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "./route";
import { setPodcastFeedCacheDirForTests } from "@/lib/entertain/podcast-rss";
import { setPodcastFeedCacheDirForTests as setCatalogFeedCacheDir } from "@/lib/entertain/podcast-catalog";
import { resetApiRateLimitForTests } from "@/lib/api-rate-limit";

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>Freakonomics Radio</title>
  <item>
    <title>Why Do We Do That?</title>
    <description>Exploring a strange human habit.</description>
    <guid>why-1</guid>
    <pubDate>Wed, 02 Jan 2026 10:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/why1.mp3" type="audio/mpeg"/>
    <itunes:duration>30:00</itunes:duration>
    <itunes:category text="Society &amp; Culture"/>
    <itunes:keywords>habits, economics</itunes:keywords>
  </item>
  <item>
    <title>Second Episode</title>
    <guid>why-2</guid>
    <pubDate>Tue, 01 Jan 2026 10:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/why2.mp3" type="audio/mpeg"/>
  </item>
</channel>
</rss>`;

describe("GET /api/podcast/search", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "podcast-search-"));
    setPodcastFeedCacheDirForTests(dir);
    setCatalogFeedCacheDir(dir);
    resetApiRateLimitForTests();
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

  it("returns the catalog when no show param (legacy)", async () => {
    const res = await GET(new Request("http://localhost/api/podcast/search"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.shows.length).toBeGreaterThanOrEqual(5);
  });

  it("filters the catalog by query (legacy)", async () => {
    const res = await GET(
      new Request("http://localhost/api/podcast/search?q=radiolab"),
    );
    const data = await res.json();
    expect(data.shows.map((s: { id: string }) => s.id)).toContain("radiolab");
  });

  it("mode=search returns episode hits by title/category", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(RSS, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        }),
      ),
    );
    const res = await GET(
      new Request(
        "http://localhost/api/podcast/search?mode=search&q=habits&pageSize=40",
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.episodes)).toBe(true);
    expect(data.episodes.length).toBeGreaterThanOrEqual(1);
    expect(data.episodes[0].title).toBe("Why Do We Do That?");
    expect(data.episodes[0].showId).toBeTruthy();
    expect(data.episodes[0].categories.join(" ").toLowerCase()).toMatch(
      /society|habits|economics/,
    );
  });

  it("fetches and parses episodes for a show", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(RSS, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        }),
      ),
    );
    const res = await GET(
      new Request("http://localhost/api/podcast/search?show=freakonomics-radio"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.show.id).toBe("freakonomics-radio");
    expect(data.episodes.length).toBe(2);
    expect(data.episodes[0].title).toBe("Why Do We Do That?");
    expect(data.episodes[0].audioUrl).toBe("https://cdn.example.com/why1.mp3");
    expect(data.episodes[0].durationSec).toBe(1800);
    expect(data.episodes[0].categories).toEqual(
      expect.arrayContaining(["Society & Culture", "habits", "economics"]),
    );
  });

  it("returns 404 for unknown shows", async () => {
    const res = await GET(
      new Request("http://localhost/api/podcast/search?show=nope"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 when the feed fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    const res = await GET(
      new Request("http://localhost/api/podcast/search?show=radiolab"),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
