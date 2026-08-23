/**
 * Podcast Lab challenge builders — reuses the TED challenge engine.
 * An episode is mapped to a TedTalk so buildFallbackChallenge, the Cursor
 * Agent polish loop, and the inline discuss UI all work unchanged.
 */

import type { TedTalk, TedTopic } from "./ted-catalog";
import type {
  TedChallenge,
  TedChallengeLearner,
} from "./ted-challenge";
import {
  buildFallbackChallenge,
  normalizeLearnerGrade,
  resolveTedChallengeLevel,
} from "./ted-challenge";
import type { PodcastShow } from "./podcast-catalog";
import type { PodcastEpisode as RssEpisode } from "./podcast-rss";

const PODCAST_TOPIC_TO_TED: Record<string, TedTopic> = {
  ideas: "ideas",
  science: "science",
  society: "society",
  education: "education",
  creativity: "creativity",
  technology: "technology",
  history: "ideas",
  kids: "education",
};

function tedTopicsFor(show: PodcastShow): TedTopic[] {
  return show.topics
    .map((t) => PODCAST_TOPIC_TO_TED[t] || "ideas")
    .filter((t, i, arr) => arr.indexOf(t) === i);
}

export function episodeToTalk(
  show: PodcastShow,
  episode: RssEpisode,
): TedTalk {
  return {
    slug: `podcast:${show.id}:${episode.guid}`,
    title: episode.title.slice(0, 160),
    speaker: show.host || show.title,
    durationSec: episode.durationSec || 0,
    topics: tedTopicsFor(show),
    blurb: episode.description.slice(0, 300) || show.blurb,
  };
}

/** Episodes are stable per show — guid is the identity key. */
export function parsePodcastEpisodeId(
  raw: string | null | undefined,
): { showId: string; guid: string } | null {
  const s = String(raw || "").trim();
  if (!s.startsWith("podcast:")) return null;
  const [showId, ...rest] = s.slice("podcast:".length).split(":");
  if (!showId || rest.length === 0) return null;
  return { showId, guid: rest.join(":") };
}

export function buildPodcastChallenge(
  show: PodcastShow,
  episode: RssEpisode,
  transcript: string,
  learner?: TedChallengeLearner | null,
): TedChallenge {
  const talk = episodeToTalk(show, episode);
  return buildFallbackChallenge(talk, transcript, learner);
}

export function podcastChallengeSystemPrompt(
  show: PodcastShow,
  episode: RssEpisode,
  learner?: TedChallengeLearner | null,
): string {
  const level = resolveTedChallengeLevel(learner);
  const grade = normalizeLearnerGrade(learner?.grade);
  return [
    `You design podcast listening challenges for a ${level} English listener in Grade ${grade}.`,
    `The episode is "${episode.title}" from the podcast ${show.title} (host: ${show.host}).`,
    "Ground every question in concrete claims, stories, and evidence from the episode.",
    "Students listen only — no video. Keep prompts clear and concrete.",
    `Episode description for context: ${episode.description.slice(0, 500)}`,
  ].join("\n");
}

export function episodeDurationLabel(sec: number): string {
  if (!sec || sec <= 0) return "";
  const m = Math.round(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m} min`;
}
