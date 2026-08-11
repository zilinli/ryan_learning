/**
 * Live smoke: deAPI.txt2music / txt2img / txt2video (uses DEAPI_API_KEY).
 * Usage: npx tsx scripts/smoke-deapi.ts [--music] [--image] [--video] [--all]
 * Default: --image (cheapest/fastest) + models list. Use --all for full suite.
 */

import {
  deapiGenerateImage,
  deapiGenerateMusic,
  deapiGenerateVideo,
  deapiListModels,
  isDeapiConfigured,
} from "../src/lib/deapi-client";

function loadDotEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const p = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (k && process.env[k] == null) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

async function main() {
  loadDotEnv();
  const args = new Set(process.argv.slice(2));
  const all = args.has("--all");
  const doMusic = all || args.has("--music");
  const doImage = all || args.has("--image") || (!args.has("--music") && !args.has("--video"));
  const doVideo = all || args.has("--video");

  if (!isDeapiConfigured()) {
    console.error("DEAPI_API_KEY missing — set in .env.local");
    process.exit(1);
  }

  for (const t of ["txt2music", "txt2img", "txt2video"] as const) {
    const listed = await deapiListModels(t);
    console.log(
      `[models] ${t}:`,
      listed.ok
        ? listed.models.map((m) => m.slug).join(", ")
        : listed.error,
    );
  }

  if (doImage) {
    console.log("[image] submitting…");
    const r = await deapiGenerateImage({
      prompt: "soft watercolor hills at dusk, calm study mood, no text",
      width: 512,
      height: 512,
      steps: 4,
    });
    console.log("[image]", r.status, r.model, r.requestId, r.resultUrl?.slice(0, 80), r.error || "ok");
    if (r.status !== "done") process.exitCode = 2;
  }

  if (doMusic) {
    console.log("[music] submitting…");
    const r = await deapiGenerateMusic({
      caption: "gentle indie ballad for kids learning",
      lyrics:
        "[Verse]\nLittle spark learns every day\nQuestions light the cloudy way\n[Chorus]\nThink it through, then say it clear\nCourage grows when friends are near",
      durationSec: 15,
    });
    console.log("[music]", r.status, r.model, r.requestId, r.resultUrl?.slice(0, 80), r.error || "ok");
    if (r.status !== "done") process.exitCode = 2;
  }

  if (doVideo) {
    console.log("[video] submitting (may take minutes)…");
    const r = await deapiGenerateVideo({
      prompt: "gentle camera pan over a quiet desk with a notebook and pencil, soft light",
      width: 512,
      height: 512,
      frames: 30,
    });
    console.log("[video]", r.status, r.model, r.requestId, r.resultUrl?.slice(0, 80), r.error || "ok");
    if (r.status !== "done") process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
