#!/usr/bin/env node
/**
 * One-time production data repair for inflated source attribution (P0-1).
 *
 * Before the idempotent merge fix (commit landing with this script), the
 * local ↔ server snapshot sync summed cumulative `sourceCounts` on every
 * merge, so a single homework turn inflated counts geometrically
 * (`homework: 735` on a skill with only `attempts: 58`).
 *
 * What this script does:
 *   1. Clamps each skill's `sourceCounts` so the total never exceeds its
 *      `attempts` (a turn can count a skill at most once), scaling down
 *      proportionally to preserve the relative source ranking.
 *   2. Dedups `gapHistory` by skillId (unions days, keeps the later expiry).
 *   3. Writes the repaired file back in place.
 *
 * Run:  node scripts/reset-attribution.mjs [path-to-learning-memory.json]
 * Safe: only touches the one file passed (default data/learning-memory.json).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const file = path.resolve(
  ROOT,
  process.argv[2] || "data/learning-memory.json",
);

const LEARNING_SOURCES = new Set([
  "opener", "challenge", "deepDive", "connection", "wrongbook", "variant",
  "explore", "homework", "proactive", "ted", "writing", "natgeo", "bbc",
  "rsa", "creation",
]);

function clampSourceCounts(skill) {
  const attempts = Math.max(0, Number(skill?.attempts) || 0);
  const raw = skill?.sourceCounts;
  if (!raw || typeof raw !== "object") return;
  const entries = Object.entries(raw).filter(
    ([k, v]) => LEARNING_SOURCES.has(k) && typeof v === "number" && v > 0,
  );
  if (!entries.length) {
    delete skill.sourceCounts;
    return;
  }
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let scaled;
  if (total <= attempts) {
    scaled = Object.fromEntries(entries);
  } else if (attempts <= 0) {
    scaled = {};
  } else {
    // Preserve relative ranking while bounding the total at `attempts`.
    const factor = attempts / total;
    scaled = Object.fromEntries(
      entries.map(([k, v]) => [k, Math.max(1, Math.floor(v * factor))]),
    );
  }
  const clean = Object.fromEntries(
    Object.entries(scaled).filter(([, v]) => v > 0),
  );
  if (Object.keys(clean).length) skill.sourceCounts = clean;
  else delete skill.sourceCounts;
}

function dedupGapHistory(gaps) {
  if (!Array.isArray(gaps)) return [];
  const map = new Map();
  for (const g of gaps) {
    if (!g || !g.skillId || !g.expiresAt) continue;
    const prev = map.get(g.skillId);
    map.set(
      g.skillId,
      prev
        ? {
            ...g,
            days: [...new Set([...(prev.days || []), ...(g.days || [])])].slice(-14),
            expiresAt: Math.max(prev.expiresAt, g.expiresAt),
          }
        : { ...g, days: [...new Set(g.days || [])] },
    );
  }
  return [...map.values()];
}

const raw = fs.readFileSync(file, "utf-8");
const mem = JSON.parse(raw);
let clamped = 0;
let deduped = 0;

for (const s of mem?.skills || []) {
  const before = JSON.stringify(s?.sourceCounts || null);
  clampSourceCounts(s);
  if (before !== JSON.stringify(s?.sourceCounts || null)) clamped += 1;
}

const beforeGap = (mem?.gapHistory || []).length;
mem.gapHistory = dedupGapHistory(mem.gapHistory);
deduped = beforeGap - (mem.gapHistory || []).length;

fs.writeFileSync(file, JSON.stringify(mem, null, 2) + "\n");
console.log(`Repaired ${clamped} skills' sourceCounts; removed ${deduped} duplicate gapHistory rows (${beforeGap} → ${(mem.gapHistory || []).length}).`);
