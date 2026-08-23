import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseDurationSec,
  parsePodcastFeed,
  setPodcastFeedCacheDirForTests,
} from "./podcast-rss";

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>Test Show</title>
  <item>
    <title><![CDATA[First &amp; Only Episode]]></title>
    <description><![CDATA[<p>An <b>exciting</b> story about whales.</p>]]></description>
    <guid>abc-123</guid>
    <pubDate>Tue, 01 Jan 2026 10:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/ep1.mp3" length="123" type="audio/mpeg"/>
    <itunes:duration>1:02:33</itunes:duration>
    <itunes:category text="Science"/>
    <category>Nature</category>
    <itunes:keywords>whales, ocean, kids</itunes:keywords>
  </item>
  <item>
    <title>Second Episode</title>
    <description>No audio here.</description>
    <guid>def-456</guid>
    <itunes:duration>600</itunes:duration>
  </item>
</channel>
</rss>`;

describe("parseDurationSec", () => {
  it("parses plain seconds", () => {
    expect(parseDurationSec("600")).toBe(600);
  });

  it("parses h:mm:ss", () => {
    expect(parseDurationSec("1:02:33")).toBe(3753);
  });

  it("parses m:ss", () => {
    expect(parseDurationSec("12:34")).toBe(754);
  });

  it("returns 0 for junk / empty", () => {
    expect(parseDurationSec("abc")).toBe(0);
    expect(parseDurationSec("")).toBe(0);
    expect(parseDurationSec("1:2:x")).toBe(0);
  });
});

describe("parsePodcastFeed", () => {
  it("parses titles with CDATA + entities, strips HTML from descriptions", () => {
    const eps = parsePodcastFeed(FIXTURE);
    expect(eps).toHaveLength(1); // only the episode with http(s) audio
    const ep = eps[0]!;
    expect(ep.title).toBe("First & Only Episode");
    expect(ep.description).toBe("An exciting story about whales.");
    expect(ep.audioUrl).toBe("https://cdn.example.com/ep1.mp3");
    expect(ep.durationSec).toBe(3753);
    expect(ep.guid).toBe("abc-123");
    expect(ep.pubDate).toContain("2026");
    expect(ep.categories).toEqual(
      expect.arrayContaining(["Science", "Nature", "whales", "ocean", "kids"]),
    );
  });

  it("falls back to title-based guid when guid is missing", () => {
    const xml = FIXTURE.replace(/<guid>[^<]+<\/guid>/, "");
    const eps = parsePodcastFeed(xml);
    expect(eps[0]!.guid).toContain("first-only-episode");
  });

  it("tolerates bad / empty input", () => {
    expect(parsePodcastFeed("")).toEqual([]);
    expect(parsePodcastFeed("<html>not a feed</html>")).toEqual([]);
  });

  it("drops items without an http(s) enclosure", () => {
    const eps = parsePodcastFeed(FIXTURE);
    expect(eps.every((e) => e.audioUrl.startsWith("http"))).toBe(true);
  });
});

describe("setPodcastFeedCacheDirForTests", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "podcast-rss-"));
    setPodcastFeedCacheDirForTests(dir);
  });

  afterEach(async () => {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("accepts a cache override (smoke)", async () => {
    await fs.writeFile(path.join(dir, "feed_x.xml"), "ok", "utf8");
    const raw = await fs.readFile(path.join(dir, "feed_x.xml"), "utf8");
    expect(raw).toBe("ok");
  });
});
