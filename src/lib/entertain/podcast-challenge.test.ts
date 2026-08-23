import { describe, expect, it } from "vitest";
import {
  buildPodcastChallenge,
  episodeDurationLabel,
  episodeToTalk,
  parsePodcastEpisodeId,
  podcastChallengeSystemPrompt,
} from "./podcast-challenge";
import type { PodcastShow } from "./podcast-catalog";
import type { PodcastEpisode } from "./podcast-rss";

const SHOW: PodcastShow = {
  id: "unit-show",
  title: "Unit Show",
  host: "Unit Host",
  feedUrl: "https://example.com/feed.xml",
  topics: ["history", "kids"],
  blurb: "Unit blurb about the past.",
};

const EPISODE: PodcastEpisode = {
  guid: "ep-1",
  title: "The Great Idea",
  description: "A story about a big idea.",
  audioUrl: "https://cdn.example.com/ep1.mp3",
  durationSec: 3600,
  pubDate: "Tue, 01 Jan 2026 10:00:00 GMT",
  categories: ["ideas"],
};

describe("episodeToTalk", () => {
  it("maps show+episode onto a TedTalk with podcast slug", () => {
    const talk = episodeToTalk(SHOW, EPISODE);
    expect(talk.slug).toBe("podcast:unit-show:ep-1");
    expect(talk.title).toBe("The Great Idea");
    expect(talk.speaker).toBe("Unit Host");
    expect(talk.durationSec).toBe(3600);
    expect(talk.blurb).toContain("big idea");
  });

  it("maps podcast topics to TED topics (history/kids → ideas/education)", () => {
    const talk = episodeToTalk(SHOW, EPISODE);
    expect(talk.topics).toContain("ideas");
    expect(talk.topics).toContain("education");
    expect(talk.topics).not.toContain("history");
  });
});

describe("parsePodcastEpisodeId", () => {
  it("parses podcast:show:guid ids", () => {
    expect(parsePodcastEpisodeId("podcast:unit-show:ep-1")).toEqual({
      showId: "unit-show",
      guid: "ep-1",
    });
  });

  it("handles guids containing colons", () => {
    expect(parsePodcastEpisodeId("podcast:show:a:b:c")).toEqual({
      showId: "show",
      guid: "a:b:c",
    });
  });

  it("rejects junk", () => {
    expect(parsePodcastEpisodeId(null)).toBeNull();
    expect(parsePodcastEpisodeId("ted:susan_cain_x")).toBeNull();
    expect(parsePodcastEpisodeId("podcast:")).toBeNull();
  });
});

describe("buildPodcastChallenge", () => {
  it("builds a hybrid challenge grounded in the transcript", () => {
    const transcript =
      "The episode explains that curiosity drives learning. Evidence includes " +
      "a study of children asking questions. Another example shows how a small " +
      "question can change behavior. In the end, curiosity matters for every age. ".repeat(3);
    const challenge = buildPodcastChallenge(SHOW, EPISODE, transcript, {
      age: 9,
      grade: 4,
    });
    expect(challenge.items.length).toBeGreaterThanOrEqual(4);
    expect(challenge.talkSlug).toBe("podcast:unit-show:ep-1");
    const kinds = new Set(challenge.items.map((i) => i.kind));
    expect(kinds.has("literal")).toBe(true);
    expect(kinds.has("critique")).toBe(true);
    expect(challenge.items.some((i) => i.prompt.toLowerCase().includes("curiosity"))).toBe(
      true,
    );
  });

  it("still returns items for a thin transcript", () => {
    const challenge = buildPodcastChallenge(SHOW, EPISODE, "Short.", null);
    expect(challenge.items.length).toBeGreaterThanOrEqual(3);
  });
});

describe("podcastChallengeSystemPrompt", () => {
  it("includes show, episode, and level context", () => {
    const prompt = podcastChallengeSystemPrompt(SHOW, EPISODE, { grade: 4 });
    expect(prompt).toContain("Unit Show");
    expect(prompt).toContain("The Great Idea");
    expect(prompt).toContain("Grade 4");
  });
});

describe("episodeDurationLabel", () => {
  it("formats minutes and hours", () => {
    expect(episodeDurationLabel(0)).toBe("");
    expect(episodeDurationLabel(600)).toBe("10 min");
    expect(episodeDurationLabel(3600)).toBe("1h 0m");
  });
});
