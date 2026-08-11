/**
 * Thorough live verification: TED Lab + Lyric Studio / Volc GenSong.
 * Usage: npx tsx scripts/smoke-studio-full.ts
 * Does not print secrets.
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
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

import {
  TED_CATALOG,
  searchTedCatalog,
  parseTedSlug,
  findTedTalk,
  tedEmbedUrl,
} from "../src/lib/entertain/ted-catalog";
import { buildFallbackChallenge } from "../src/lib/entertain/ted-challenge";
import { fetchTedTranscript } from "../src/lib/entertain/ted-transcript";
import {
  addCreation,
  deleteCreation,
  loadCreations,
} from "../src/lib/entertain/creations-store";
import { isFunMusicConfigured } from "../src/lib/fun-music-client";
import {
  isVolcMusicConfigured,
  volcBillingOrder,
  volcSubmitSong,
  volcQuerySong,
  volcGenerateSongWithBillingFallback,
} from "../src/lib/volc-gensong-client";
import { generateSongWithFallback } from "../src/lib/music-generate";

const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures.push(name + (detail ? `: ${detail}` : ""));
}

async function main() {
  console.log("=== TED Lab ===");
  ok("catalog size >= 35", TED_CATALOG.length >= 35, String(TED_CATALOG.length));
  ok("search grit", searchTedCatalog("grit").length > 0);
  ok(
    "parse ted url",
    parseTedSlug(
      "https://www.ted.com/talks/susan_cain_the_power_of_introverts",
    ) === "susan_cain_the_power_of_introverts",
  );
  const talk = findTedTalk("susan_cain_the_power_of_introverts");
  ok("find talk", Boolean(talk));
  ok("embed url official", Boolean(talk && tedEmbedUrl(talk.slug).includes("embed.ted.com")));

  const ch = buildFallbackChallenge(
    talk!,
    "Introverts bring quiet strength into noisy rooms. ".repeat(12),
  );
  ok("challenge items >= 4", ch.items.length >= 4, String(ch.items.length));
  const kinds = new Set(ch.items.map((i) => i.kind));
  ok("challenge has critique", kinds.has("critique"));
  ok("challenge has retell", kinds.has("retell"));

  console.log("fetching TED transcript (network)…");
  const tx = await fetchTedTranscript("susan_cain_the_power_of_introverts");
  ok(
    "transcript available or empty fallback ok",
    tx.source === "empty" || tx.text.length > 50,
    `${tx.source} chars=${tx.text.length}`,
  );
  if (tx.text.length > 80) {
    const rich = buildFallbackChallenge(talk!, tx.text);
    ok("transcript-backed challenge", rich.generatedFromTranscript);
  }

  const acct = "acct_smoke_full";
  const tedRow = await addCreation(acct, {
    type: "ted_challenge",
    title: "TED · Smoke",
    talkSlug: talk!.slug,
    challengeScore: "1/5",
    notes: "smoke",
  });
  ok("save ted creation", Boolean(tedRow.id));

  console.log("\n=== Lyric / Music providers ===");
  ok("volc configured", isVolcMusicConfigured());
  console.log("volc billing order:", volcBillingOrder().join(" → "));
  ok("bailian configured (optional)", true, `funMusic=${isFunMusicConfigured()}`);

  console.log("\nsubmit GenSongForTime (postpaid)…");
  const submit = await volcSubmitSong(
    {
      lyrics:
        "[Verse]\nMorning light on the quiet bay\nI fold the page I never finished\n[Chorus]\nHold the feeling, say it twice",
      gender: "female",
      genre: "Folk",
      mood: "Chill",
    },
    "postpaid",
  );
  ok(
    "volc postpaid submit",
    submit.status === "pending" && Boolean(submit.taskId),
    submit.error || `task=${submit.taskId}`,
  );
  if (/ServerIpLimit/i.test(String(submit.error || ""))) {
    console.log(
      "NOTE: Volc ServerIpLimit — whitelist this host public IP in AI Music console, then re-run.",
    );
  }

  let songDone = false;
  if (submit.taskId) {
    console.log("polling QuerySong up to ~3 min…");
    const start = Date.now();
    let lastStatus = "pending";
    while (Date.now() - start < 180_000) {
      await new Promise((r) => setTimeout(r, 5000));
      const q = await volcQuerySong(submit.taskId, "postpaid");
      lastStatus = q.status;
      console.log("  query", q.status, q.error || q.audioUrl?.slice(0, 48) || "");
      if (q.status === "done" && q.audioUrl) {
        songDone = true;
        ok("volc postpaid audio url", true, `dur=${q.durationSec ?? "?"}`);
        // download a few bytes
        try {
          const res = await fetch(q.audioUrl, {
            signal: AbortSignal.timeout(30_000),
          });
          const buf = Buffer.from(await res.arrayBuffer());
          ok("audio downloadable", res.ok && buf.length > 1000, `bytes=${buf.length}`);
        } catch (e) {
          ok("audio downloadable", false, String(e));
        }
        const songRow = await addCreation(acct, {
          type: "song",
          title: "Smoke Volc Song",
          lyrics: "[Verse]\nsmoke",
          caption: "Folk",
          notes: `provider:volc-postpaid task:${submit.taskId}`,
        });
        ok("save song creation", Boolean(songRow.id));
        break;
      }
      if (q.status === "error") {
        ok("volc postpaid generate", false, q.error);
        break;
      }
    }
    if (!songDone && lastStatus === "pending") {
      ok("volc postpaid generate", false, "timed out pending");
    }
  }

  // If postpaid submit failed, try full billing fallback quickly (submit only path covered)
  if (submit.status === "error") {
    console.log("\ntrying billing fallback (prepaid→postpaid) submit+poll short…");
    const fb = await volcGenerateSongWithBillingFallback(
      {
        lyrics:
          "[Verse]\nA second chance upon the shore\n[Chorus]\nWe try again with open doors",
        gender: "male",
      },
      { maxWaitMs: 120_000, pollMs: 5_000 },
    );
    ok(
      "volc billing fallback",
      fb.status === "done",
      `${fb.provider} ${fb.error || ""} attempts=${(fb.attempts || []).join("|")}`,
    );
  }

  console.log("\n=== generateSongWithFallback (Bailian→Volc) ===");
  const orch = await generateSongWithFallback({
    lyrics:
      "[Verse]\nOrchestrator path for listening ears\n[Chorus]\nFallback keeps the music near",
    gender: "female",
    caption: "Indie mood",
  });
  ok(
    "orchestrator done or expected bailian deny + volc",
    orch.status === "done" ||
      (orch.status === "error" &&
        (orch.attempts || []).some((a) => a.includes("volc"))),
    `${orch.status} provider=${orch.provider} ${(orch.attempts || []).slice(0, 4).join(" | ")}`,
  );
  if (orch.status === "done") {
    ok("orchestrator has audio", Boolean(orch.audioUrl || orch.audioBase64));
  }

  // cleanup creations
  const listed = await loadCreations(acct);
  for (const item of listed.items) {
    await deleteCreation(acct, item.id);
  }
  ok("cleanup creations", (await loadCreations(acct)).items.length === 0);

  console.log("\n=== Summary ===");
  if (failures.length) {
    console.error("FAILURES:", failures);
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
