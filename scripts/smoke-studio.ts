/**
 * Live smoke for Studio (catalog / creations / Fun-Music probe).
 * Run: npx tsx scripts/smoke-studio.ts
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
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

import {
  funMusicEndpoint,
  funMusicGenerate,
  isFunMusicConfigured,
} from "../src/lib/fun-music-client";
import { buildFallbackChallenge } from "../src/lib/entertain/ted-challenge";
import {
  TED_CATALOG,
  searchTedCatalog,
} from "../src/lib/entertain/ted-catalog";
import {
  addCreation,
  deleteCreation,
  loadCreations,
} from "../src/lib/entertain/creations-store";

async function main() {
  const failures: string[] = [];
  console.log("=== Studio smoke ===");

  if (TED_CATALOG.length < 35) failures.push("catalog too small");
  console.log(
    "catalog",
    TED_CATALOG.length,
    "grit hits",
    searchTedCatalog("grit").length,
  );

  const talk =
    TED_CATALOG.find((t) => t.slug.includes("susan_cain")) || TED_CATALOG[0]!;
  const ch = buildFallbackChallenge(
    talk,
    "Introverts bring quiet strength. ".repeat(20),
  );
  if (ch.items.length < 4) failures.push("challenge too thin");
  console.log(
    "challenge items",
    ch.items.length,
    "kinds",
    [...new Set(ch.items.map((i) => i.kind))].join(","),
  );

  const acct = "acct_smoke_studio";
  const row = await addCreation(acct, {
    type: "song",
    title: "Smoke",
    lyrics: "[Verse]\nhello world again",
    caption: "Indie",
  });
  const listed = await loadCreations(acct);
  if (listed.items[0]?.id !== row.id) failures.push("creations list mismatch");
  await deleteCreation(acct, row.id);
  if ((await loadCreations(acct)).items.length !== 0) {
    failures.push("creations delete failed");
  }
  console.log("creations CRUD ok");

  console.log("funMusic configured", isFunMusicConfigured());
  console.log("endpoint", funMusicEndpoint());

  const { isVolcMusicConfigured, volcBillingOrder, volcGenerateSongWithBillingFallback } =
    await import("../src/lib/volc-gensong-client");
  console.log("volc configured", isVolcMusicConfigured());
  console.log("volc billing order", volcBillingOrder().join(" → "));

  let funMusicNote = "skipped";
  if (isFunMusicConfigured()) {
    const r = await funMusicGenerate({
      lyrics:
        "[Verse]\nA small smoke test for listening ears\n[Chorus]\nKeep it short and clear today",
      gender: "female",
    });
    console.log("funMusic status", r.status, "ok", r.ok);
    if (r.error) console.log("funMusic error", r.error.slice(0, 240));
    console.log(
      "funMusic hasUrl",
      Boolean(r.audioUrl),
      "req",
      r.requestId || "-",
    );
    if (r.status === "done" && r.audioUrl) {
      funMusicNote = "live_ok";
    } else if (r.status === "error") {
      funMusicNote = `live_error:${r.error?.slice(0, 80)}`;
    }
  } else {
    funMusicNote = "unconfigured";
  }
  console.log("funMusicNote", funMusicNote);

  let volcNote = "skipped";
  if (isVolcMusicConfigured()) {
    const r = await volcGenerateSongWithBillingFallback(
      {
        lyrics:
          "[Verse]\nA small smoke test for listening ears\n[Chorus]\nKeep it short and clear today",
        gender: "female",
      },
      { maxWaitMs: 120_000, pollMs: 5_000 },
    );
    console.log("volc status", r.status, "provider", r.provider, "ok", r.ok);
    if (r.error) console.log("volc error", String(r.error).slice(0, 240));
    console.log("volc attempts", (r.attempts || []).join(" | "));
    console.log("volc hasUrl", Boolean(r.audioUrl), "task", r.taskId || "-");
    if (r.status === "done" && r.audioUrl) volcNote = `live_ok:${r.provider}`;
    else volcNote = `live_${r.status}:${String(r.error || "").slice(0, 60)}`;
  } else {
    failures.push("VOLC AK/SK missing");
    volcNote = "unconfigured";
  }
  console.log("volcNote", volcNote);

  if (!isFunMusicConfigured() && !isVolcMusicConfigured()) {
    failures.push("no music provider configured");
  }

  if (failures.length) {
    console.error("FAIL", failures);
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
