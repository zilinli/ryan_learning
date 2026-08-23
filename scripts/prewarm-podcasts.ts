/**
 * Podcast Lab prewarm — transcribe a few short episodes ahead of launch so
 * the first visitors get instant challenges.
 *
 * Usage:  npx tsx scripts/prewarm-podcasts.ts [--limit 6] [--per-show 1]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();

import { PODCAST_CATALOG, resolveShowFeed } from "../src/lib/entertain/podcast-catalog";
import { fetchPodcastEpisodes, type PodcastEpisode } from "../src/lib/entertain/podcast-rss";
import {
  getPodcastTranscriptJob,
  requestPodcastTranscript,
  type PodcastTranscriptJob,
} from "../src/lib/entertain/podcast-transcript";

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || 6);
const MAX_EPISODE_SEC = 1500; // skip long episodes; 25 min cap

async function pickEpisode(showId: string): Promise<PodcastEpisode | null> {
  const show = PODCAST_CATALOG.find((s) => s.id === showId);
  if (!show) return null;
  const feedUrl = await resolveShowFeed(show).catch(() => show.feedUrl);
  const episodes = await fetchPodcastEpisodes(feedUrl).catch(() => []);
  const sorted = [...episodes].sort(
    (a, b) => (a.durationSec || MAX_EPISODE_SEC) - (b.durationSec || MAX_EPISODE_SEC),
  );
  return (
    sorted.find((e) => (e.durationSec || 0) > 120 && (e.durationSec || 0) <= MAX_EPISODE_SEC) ||
    null
  );
}

async function waitDone(job: PodcastTranscriptJob): Promise<PodcastTranscriptJob> {
  let current = job;
  const deadline = Date.now() + 25 * 60_000;
  while (current.status === "queued" || current.status === "running") {
    if (current.bailianError) break; // bailian failed → whisper fallback; prewarm skips it
    if (Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 5000));
    current = (await getPodcastTranscriptJob(job.id)) || current;
    process.stdout.write(`  ${current.status} ${Math.round((current.progress || 0) * 100)}%\r`);
  }
  process.stdout.write("\n");
  return current;
}

async function main() {
  const failures: string[] = [];
  let transcribed = 0;
  for (const show of PODCAST_CATALOG) {
    if (transcribed >= limit) break;
    const episode = await pickEpisode(show.id);
    if (!episode) {
      console.log(`SKIP ${show.id} — no short episode found`);
      continue;
    }
    const job = await requestPodcastTranscript(show, episode);
    if (job.status === "done" && job.engine === "cache") {
      console.log(`CACHE ${show.id} — ${episode.title.slice(0, 50)} (already transcribed)`);
      continue;
    }
    console.log(`TRANSCRIBE ${show.id} — ${episode.title.slice(0, 50)} (${Math.round((episode.durationSec || 0) / 60)} min)`);
    const done = await waitDone(job);
    if (done.status === "done") {
      transcribed += 1;
      console.log(`  OK ${done.engine} ${(done.transcript || "").length} chars`);
    } else if (done.bailianError && done.status === "running") {
      // DashScope couldn't reach this CDN and whisper would take minutes —
      // leave it for on-demand users; don't block the prewarm on it.
      console.log(`  SKIP ${done.bailianError.slice(0, 60)}`);
    } else {
      failures.push(`${show.id}: ${done.status} ${done.error || ""}`);
    }
  }
  if (failures.length) {
    console.error("PREWARM FAIL", failures);
    process.exit(1);
  }
  console.log(`PREWARM DONE — ${transcribed} episodes transcribed fresh`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
