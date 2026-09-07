import { describe, expect, it } from "vitest";
import {
  filterPodcastHits,
  type PodcastEpisodeHit,
} from "./podcast-search";

function hit(
  overrides: Partial<PodcastEpisodeHit> & Pick<
    PodcastEpisodeHit,
    "guid" | "title" | "showId" | "showTitle"
  >,
): PodcastEpisodeHit {
  return {
    description: "",
    audioUrl: "https://cdn.example.com/a.mp3",
    durationSec: 600,
    pubDate: "Tue, 01 Jan 2026 10:00:00 GMT",
    categories: [],
    showHost: "Host",
    topics: ["ideas"],
    ...overrides,
  };
}

describe("filterPodcastHits", () => {
  const pool: PodcastEpisodeHit[] = [
    hit({
      guid: "1",
      title: "Why Do Whales Sing?",
      showId: "radiolab",
      showTitle: "Radiolab",
      categories: ["Science", "Nature"],
      topics: ["science", "ideas"],
      description: "A deep dive into whale songs.",
    }),
    hit({
      guid: "2",
      title: "The French Revolution",
      showId: "the-rest-is-history",
      showTitle: "The Rest Is History",
      categories: ["History"],
      topics: ["history", "ideas"],
    }),
    hit({
      guid: "3",
      title: "TED Talk: Growing Up Curious",
      showId: "ted-talks-daily",
      showTitle: "TED Talks Daily",
      categories: ["Education"],
      topics: ["education", "ideas"],
      kidFriendly: true,
    }),
  ];

  it("matches episode title, not the show name alone", () => {
    // Searching the show name should NOT be required; title match works.
    const byTitle = filterPodcastHits(pool, "whales");
    expect(byTitle.map((h) => h.guid)).toEqual(["1"]);

    // "TED Talks Daily" as a query used to be the only hit shape — students
    // should find the episode title instead.
    const byEpisode = filterPodcastHits(pool, "growing up curious");
    expect(byEpisode.map((h) => h.guid)).toEqual(["3"]);
  });

  it("matches categories and topics", () => {
    expect(filterPodcastHits(pool, "nature").map((h) => h.guid)).toEqual(["1"]);
    expect(filterPodcastHits(pool, "education").map((h) => h.guid)).toEqual([
      "3",
    ]);
  });

  it("filters by topic chip (including kids)", () => {
    expect(filterPodcastHits(pool, "", "history").map((h) => h.guid)).toEqual([
      "2",
    ]);
    expect(filterPodcastHits(pool, "", "kids").map((h) => h.guid)).toEqual([
      "3",
    ]);
    expect(filterPodcastHits(pool, "curious", "kids").map((h) => h.guid)).toEqual([
      "3",
    ]);
  });

  it("returns all when query and topic are empty/all", () => {
    expect(filterPodcastHits(pool, "", "all")).toHaveLength(3);
  });
});
