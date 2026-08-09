#!/usr/bin/env node
/**
 * A1.h — Worksheet cut-accuracy harness.
 *
 * Offline (default): score fixture_fence strings in manifest via parseWorksheetPlanFence.
 * Live (--live): POST sample images to /api/chat (requires CURSOR_API_KEY + sample files).
 *
 * Usage:
 *   node scripts/eval-worksheet-cut.mjs
 *   node scripts/eval-worksheet-cut.mjs --live --base http://127.0.0.1:3000
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "eval/worksheet-cut/manifest.json");

const args = process.argv.slice(2);
const live = args.includes("--live");
const baseIdx = args.indexOf("--base");
const base =
  baseIdx >= 0 && args[baseIdx + 1]
    ? args[baseIdx + 1]
    : "http://127.0.0.1:3000";

async function loadParser() {
  // Prefer compiled-less: dynamic import TS via vitest-like path won't work in plain node.
  // Inline minimal parse by importing from built dist is unavailable — use a tiny duplicate
  // of the fence regex matching worksheet-planner's contract for offline scoring,
  // and for accuracy rely on spawning node's --import tsx if available.
  try {
    const mod = await import(
      pathToFileURL(path.join(root, "src/lib/worksheet-planner.ts")).href
    );
    return mod.parseWorksheetPlanFence;
  } catch {
    // fallback: register tsx
  }
  try {
    await import("tsx/esm");
    const mod = await import(
      pathToFileURL(path.join(root, "src/lib/worksheet-planner.ts")).href
    );
    return mod.parseWorksheetPlanFence;
  } catch {
    console.error(
      "Need tsx to import worksheet-planner.ts. Run: npx tsx scripts/eval-worksheet-cut.mjs",
    );
    process.exit(1);
  }
}

function scoreSample(parse, sample, assistantText) {
  const plan = parse(assistantText || "");
  const fired = !!plan;
  let totalMatch = false;
  let labelMatch = false;
  let falseFire = false;
  let missFire = false;

  if (!sample.planner_should_fire) {
    if (fired) falseFire = true;
    else totalMatch = true; // negative control pass
  } else {
    if (!fired) {
      missFire = true;
    } else {
      totalMatch = plan.total === sample.expected_total;
      const got = new Set(plan.items.map((i) => i.label));
      const exp = new Set(sample.expected_labels || []);
      labelMatch =
        got.size === exp.size && [...exp].every((l) => got.has(l));
    }
  }

  return {
    id: sample.id,
    bucket: sample.bucket,
    fired,
    totalMatch,
    labelMatch,
    falseFire,
    missFire,
    parsedTotal: plan?.total ?? null,
  };
}

async function main() {
  const parse = await loadParser();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const results = [];

  for (const sample of manifest.samples) {
    let text = sample.fixture_fence || "";
    if (live && sample.file) {
      const abs = path.join(root, sample.file);
      if (!fs.existsSync(abs)) {
        results.push({
          id: sample.id,
          error: `missing file ${sample.file}`,
        });
        continue;
      }
      // Live path stub — encode image when wiring full chat client later
      console.warn(
        `[live] ${sample.id}: image POST not fully wired in this scaffold; using fixture_fence`,
      );
    }
    results.push(scoreSample(parse, sample, text));
  }

  const multi = results.filter(
    (r) => !r.error && manifest.samples.find((s) => s.id === r.id)?.planner_should_fire,
  );
  const negatives = results.filter((r) => {
    const s = manifest.samples.find((x) => x.id === r.id);
    return s && !s.planner_should_fire && !r.error;
  });
  const totalHits = multi.filter((r) => r.totalMatch).length;
  const totalRate = multi.length ? totalHits / multi.length : 0;
  const falseFires = negatives.filter((r) => r.falseFire).length;

  const scorecard = {
    date: new Date().toISOString(),
    mode: live ? "live-scaffold" : "offline-fixture",
    totalCountMatchRate: totalRate,
    falseFires,
    multiN: multi.length,
    negativeN: negatives.length,
    pass:
      totalRate >= (manifest.passBar?.totalCountMatchMin ?? 0.9) &&
      falseFires <= (manifest.passBar?.falseFireMax ?? 0),
    results,
  };

  const outDir = path.join(root, "eval/worksheet-cut");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `results-${new Date().toISOString().slice(0, 10)}.json`,
  );
  fs.writeFileSync(outFile, JSON.stringify(scorecard, null, 2));
  console.log(JSON.stringify(scorecard, null, 2));
  console.log(`\nWrote ${outFile}`);
  process.exit(scorecard.pass ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
