#!/usr/bin/env node
/**
 * TEO.0 — Teochew STT A/B harness: Bailian vs. iFlytek on real audio.
 *
 * Calls both engines DIRECTLY (bypasses the production chain that never lets
 * iFlytek run for teo — see §2.3 of teochew-stt-remediation.md).
 *
 * Prerequisites:
 *   - ALIYUN_DASHSCOPE_API_KEY / ALIYUN_WORKSPACE_ID / ALIYUN_DASHSCOPE_REGION in env
 *   - IFLYTEK_APP_ID / IFLYTEK_API_SECRET / IFLYTEK_API_KEY in env (讯飞方言)
 *   - 16kHz mono WAV files under eval/teochew-stt/samples/
 *
 * Usage:
 *   npx tsx scripts/eval-teochew-stt.mjs
 *   IFLYTEK_APP_ID=xxx ... npx tsx scripts/eval-teochew-stt.mjs
 *
 * Output:
 *   eval/teochew-stt/results-{date}.md — comparison table
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "eval/teochew-stt/manifest.json");
const samplesDir = path.join(root, "eval/teochew-stt/samples");
const resultsDir = path.join(root, "eval/teochew-stt");

const today = new Date().toISOString().slice(0, 10);
const resultsPath = path.join(resultsDir, `results-${today}.md`);

// ── Engine imports (dynamic, needs tsx for .ts resolution) ────────────

/** @type {Function} */
let transcribeWithBailian;
/** @type {Function} */
let loadIflytekConfig;
/** @type {Function} */
let transcribeWithIflytek;

async function loadEngines() {
  // tsx registers .ts handling
  try { await import("tsx/esm"); } catch { /* may already be registered */ }

  const bailian = await import(
    pathToFileURL(path.join(root, "src/lib/bailian-asr.ts")).href
  );
  transcribeWithBailian = bailian.transcribeWithBailian;

  const iflytek = await import(
    pathToFileURL(path.join(root, "src/lib/iflytek-asr.ts")).href
  );
  loadIflytekConfig = iflytek.loadIflytekConfig;
  transcribeWithIflytek = iflytek.transcribeWithIflytek;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("TEO.0 — Teochew STT A/B: Bailian vs. iFlytek\n");

  // ── 1. Load manifest ──
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const samples = manifest.samples || [];

  // Only samples with actual files
  const ready = samples.filter((s) => s.file != null);
  const pending = samples.filter((s) => s.file == null);

  if (ready.length === 0) {
    console.log(
      `No audio files found. Place 16kHz mono WAV files under eval/teochew-stt/samples/\n` +
        `and set the "file" field in manifest.json for each sample.\n\n` +
        `Pending samples: ${pending.length}\n`,
    );
    // Still print the template so the user knows what to expect
    printTemplate(pending);
    return;
  }

  // ── 2. Load engines ──
  await loadEngines();

  // ── 3. Check iFlytek config ──
  const iflytekConfig = loadIflytekConfig();
  if (!iflytekConfig) {
    console.warn(
      "iFlytek not configured (IFLYTEK_APP_ID / IFLYTEK_API_SECRET / IFLYTEK_API_KEY).\n" +
        "Only Bailian results will be available.",
    );
  }

  // ── 4. Run A/B ──
  /** @type {object[]} */
  const results = [];

  for (const sample of ready) {
    const wavPath = path.join(samplesDir, sample.file);
    if (!fs.existsSync(wavPath)) {
      console.warn(`[${sample.id}] file not found: ${wavPath} — skipping`);
      results.push({
        sample,
        bailianText: "",
        bailianModel: "",
        bailianMs: 0,
        iflytekText: "",
        iflytekMs: 0,
        bailianError: "file not found",
        iflytekError: "file not found",
      });
      continue;
    }

    const wavBuffer = new Uint8Array(fs.readFileSync(wavPath));
    if (wavBuffer.length < 100) {
      console.warn(`[${sample.id}] file too small — skipping`);
      continue;
    }

    process.stdout.write(`[${sample.id}] "${sample.gloss}" ... `);

    const result = {
      sample,
      bailianText: "",
      bailianModel: "",
      bailianMs: 0,
      iflytekText: "",
      iflytekMs: 0,
    };

    // Bailian
    const bailianStart = Date.now();
    try {
      const bl = await transcribeWithBailian(wavBuffer, {
        language: "zh",
        mimeHint: "audio/wav",
        timeoutMs: 45_000,
      });
      result.bailianText = (bl.text || "").trim();
      result.bailianModel = bl.model || "";
      result.bailianMs = Date.now() - bailianStart;
    } catch (err) {
      result.bailianError = err instanceof Error ? err.message : String(err);
      result.bailianMs = Date.now() - bailianStart;
    }

    // iFlytek (only if configured)
    if (iflytekConfig) {
      const iflytekStart = Date.now();
      try {
        const it = await transcribeWithIflytek(iflytekConfig, wavBuffer, { timeoutMs: 30_000 });
        result.iflytekText = (it.text || "").trim();
        result.iflytekMs = Date.now() - iflytekStart;
      } catch (err) {
        result.iflytekError = err instanceof Error ? err.message : String(err);
        result.iflytekMs = Date.now() - iflytekStart;
      }
    } else {
      result.iflytekError = "not configured";
    }

    results.push(result);
    console.log("done");
  }

  // ── 5. Print + write results ──
  printResults(results, !!iflytekConfig);
  writeResultsMd(results, !!iflytekConfig);
}

function printTemplate(samples) {
  console.log("┌────────────────────────────────────────────────────────────┐");
  console.log("│  Template: populate manifest files + samples, then re-run   │");
  console.log("└────────────────────────────────────────────────────────────┘");
  console.log("| id       | domain    | gloss                 | status |");
  console.log("|----------|-----------|----------------------|--------|");
  for (const s of samples) {
    console.log(`| ${s.id.padEnd(8)} | ${s.domain.padEnd(9)} | ${s.gloss.padEnd(20)} | pending |`);
  }
}

function printResults(results, hasIflytek) {
  console.log("\n┌──────────────────────────────────────────────────────────┐");
  console.log("│  Results — human-scoring columns                          │");
  console.log("│  usable: usable-as-is (Y/N)                               │");
  console.log("│  closer: closer to Chaoshan (B=I.Flytek/I=Both/N=neither) │");
  console.log("└──────────────────────────────────────────────────────────┘\n");

  const iflytekCol = hasIflytek ? "| iFlytek (ms)           " : "";
  console.log(`| id       | gloss            | Bailian (ms)           ${iflytekCol}| usable | closer |`);
  const iflytekSep = hasIflytek ? "|------------------------" : "";
  console.log(`|----------|-----------------|------------------------${iflytekSep}|--------|--------|`);

  for (const r of results) {
    const blCol = r.bailianError
      ? `ERR: ${r.bailianError.slice(0, 20)}`
      : `"${r.bailianText.slice(0, 25)}" (${r.bailianMs}ms ${r.bailianModel})`;

    let row = `| ${r.sample.id.padEnd(8)} | ${r.sample.gloss.padEnd(15)} | ${blCol.padEnd(22)} `;

    if (hasIflytek) {
      const itCol = r.iflytekError
        ? `ERR: ${r.iflytekError.slice(0, 20)}`
        : `"${r.iflytekText.slice(0, 25)}" (${r.iflytekMs}ms)`;
      row += `| ${itCol.padEnd(22)} `;
    }

    row += "|        |        |";
    console.log(row);
  }

  console.log('\nFill in "usable" and "closer" columns manually (native speaker judgment).');
  console.log(`Results saved to: ${resultsPath}`);
}

function writeResultsMd(results, hasIflytek) {
  const lines = [];
  lines.push(`# TEO.0 Teochew STT A/B Results — ${today}`);
  lines.push("");
  lines.push(`- Bailian primary model: Fun-ASR-Flash → Qwen3-ASR-Flash fallback`);
  lines.push(`- iFlytek: ${hasIflytek ? "configured" : "NOT configured (IFLYTEK_* env vars)"}`);
  lines.push(`- Scoring: human — usable-as-is (Y/N), closer-to-Chaoshan (B=I.Flytek/I=Both/N=neither)`);
  lines.push(`- Design: [teochew-stt-remediation.md](../docs/subsystems/teochew-stt-remediation.md) §4`);
  lines.push("");
  lines.push("## Results");
  lines.push("");

  const iflytekHeader = hasIflytek ? " | iFlytek text | iFlytek ms" : "";
  lines.push(`| id | gloss | domain | Bailian text | Bailian model | Bailian ms${iflytekHeader} | usable | closer |`);
  const iflytekSep = hasIflytek ? "|---|--" : "";
  lines.push(`|---|---|---|---|---|---${iflytekSep}|---|---|`);

  for (const r of results) {
    const blText = r.bailianError ? `ERR: ${r.bailianError}` : r.bailianText;
    let row = `| ${r.sample.id} | ${r.sample.gloss} | ${r.sample.domain} | ${blText} | ${r.bailianModel} | ${r.bailianMs}ms`;

    if (hasIflytek) {
      const itText = r.iflytekError ? `ERR: ${r.iflytekError}` : r.iflytekText;
      row += ` | ${itText} | ${r.iflytekMs}ms`;
    }

    row += " |  |  |";
    lines.push(row);
  }

  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push("- [ ] Proceed to TEO.1–3 (iFlytek-first routing for teo) — iFlytek clearly closer to Chaoshan");
  lines.push("- [ ] Do NOT swap engines — Bailian comparable or better; lean on correction loop (§6) instead");
  lines.push("");

  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(resultsPath, lines.join("\n") + "\n", "utf8");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
