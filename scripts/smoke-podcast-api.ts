/**
 * Live Podcast Lab API route checks.
 * Usage:
 *   PODCAST_CHALLENGE_FORCE_FALLBACK=1 npx tsx scripts/smoke-podcast-api.ts          # catalog + episodes + wiring
 *   PODCAST_SMOKE_TRANSCRIBE=1 npx tsx scripts/smoke-podcast-api.ts                  # + real transcribe (DashScope/whisper)
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
process.env.PODCAST_CHALLENGE_FORCE_FALLBACK = "1";

import { GET as search } from "../src/app/api/podcast/search/route";
import { GET as getJob, POST as postTranscribe } from "../src/app/api/podcast/transcribe/route";
import { POST as postChallenge } from "../src/app/api/podcast/challenge/route";

async function main() {
  const failures: string[] = [];
  const showId = "radiolab";

  const catalog = await search(new Request("http://localhost/api/podcast/search"));
  const catalogBody = await catalog.json();
  console.log("catalog", catalog.status, "shows", catalogBody.shows?.length);
  if (catalog.status !== 200 || (catalogBody.shows?.length || 0) < 5) {
    failures.push("catalog failed");
  } else console.log("PASS catalog");

  const eps = await search(
    new Request(`http://localhost/api/podcast/search?show=${showId}`),
  );
  const epsBody = await eps.json();
  console.log(
    "episodes",
    eps.status,
    "show",
    epsBody.show?.title,
    "count",
    epsBody.episodes?.length,
    "first",
    epsBody.episodes?.[0]?.title,
  );
  if (eps.status !== 200 || !epsBody.episodes?.length) {
    failures.push("episodes failed");
  } else console.log("PASS episodes");

  const show = epsBody.show;
  const episodes = epsBody.episodes as Array<{
    guid: string;
    title: string;
    audioUrl: string;
    durationSec?: number;
    description?: string;
  }>;

  // The pending gate uses the newest episode (never transcribed by this smoke).
  const gateEpisode = episodes[0];

  // If the transcript already exists the challenge answers 200; otherwise it
  // must answer 409 transcript_pending. Either is a PASS (fresh + re-run safe).
  const pending = await postChallenge(
    new Request("http://localhost/api/podcast/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show, episode: gateEpisode }),
    }),
  );
  const pendingBody = await pending.json();
  console.log("challenge(gate)", pending.status, pendingBody.status);
  if (pending.status === 409 && pendingBody.status === "transcript_pending") {
    console.log("PASS challenge pending gate");
  } else if (pending.status === 200) {
    console.log("PASS challenge gate (transcript already cached)");
  } else {
    failures.push(`gate contract broken: ${pending.status} ${pendingBody.status}`);
  }

  if (process.env.PODCAST_SMOKE_TRANSCRIBE === "1") {
    // Transcribe the shortest episode so the smoke finishes quickly.
    const sorted = [...episodes].sort(
      (a, b) => (a.durationSec || 3600) - (b.durationSec || 3600),
    );
    const episode =
      sorted.find((e) => (e.durationSec || 0) > 60 && (e.durationSec || 0) <= 1500) ||
      sorted[0];
    console.log("transcribing episode:", episode.title, episode.durationSec, "sec");
    const start = await postTranscribe(
      new Request("http://localhost/api/podcast/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show, episode }),
      }),
    );
    const startBody = await start.json();
    console.log("transcribe start", start.status, startBody.job?.status, startBody.job?.id);
    if (start.status !== 200 || !startBody.job?.id) {
      failures.push("transcribe start failed");
    } else {
      let job = startBody.job;
      const deadline = Date.now() + 20 * 60_000;
      while ((job.status === "queued" || job.status === "running") && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        const poll = await getJob(
          new Request(`http://localhost/api/podcast/transcribe?id=${job.id}`),
        );
        const pollBody = await poll.json();
        job = pollBody.job;
        console.log("  progress", job.status, Math.round((job.progress || 0) * 100) + "%");
      }
      if (job.status !== "done") {
        failures.push(`transcribe did not finish (${job.status} ${job.error || ""})`);
      } else {
        console.log("PASS transcribe", job.engine, "chars", (job.transcript || "").length);
        const ch = await postChallenge(
          new Request("http://localhost/api/podcast/challenge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ show, episode }),
          }),
        );
        const chBody = await ch.json();
        console.log(
          "challenge",
          ch.status,
          "items",
          chBody.challenge?.items?.length,
          "kinds",
          (chBody.challenge?.items || []).map((i: { kind: string }) => i.kind).join(","),
        );
        if (ch.status !== 200 || (chBody.challenge?.items?.length || 0) < 4) {
          failures.push("challenge build failed");
        } else console.log("PASS challenge build");
      }
    }
  }

  if (failures.length) {
    console.error("FAIL", failures);
    process.exit(1);
  }
  console.log("PODCAST API SMOKE PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
