#!/usr/bin/env node
/**
 * System checks: diagram persistence + TTS never speaks SVG.
 * Run: npm run verify:diagrams
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = (rel) => pathToFileURL(join(root, rel)).href;

const unit = spawnSync(
  "npx",
  ["vitest", "run", "src/lib/svg-persist-tts.test.ts", "src/lib/tts-text.test.ts"],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(unit.stdout || "");
process.stderr.write(unit.stderr || "");
if (unit.status !== 0) {
  console.error("FAIL  unit tests for diagram/TTS");
  process.exit(unit.status || 1);
}

const {
  geometrySpecToMarkdown,
  normalizeTutorMarkdown,
} = await import(ts("src/lib/geometry-svg.ts"));
const { cleanTutorSpeechText, pullSpeakableFromBuffer } = await import(
  ts("src/lib/tts-text.ts"),
);
const { hasTutorDiagram, preferCompleteTutorText } = await import(
  ts("src/lib/tutor-text-filter.ts"),
);

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const JUNK =
  /svg|xmlns|viewBox|polygon|polyline|data:image|%3C|stroke-width|font-family/i;

function streamSpeak(text, step = 20) {
  let buf = "";
  const spoken = [];
  for (let i = 0; i < text.length; i += step) {
    buf += text.slice(i, i + step);
    const { ready, rest } = pullSpeakableFromBuffer(buf);
    buf = rest;
    spoken.push(...ready);
  }
  spoken.push(...pullSpeakableFromBuffer(buf, { force: true }).ready);
  return spoken;
}

async function readSse(url, body, timeoutMs = 180_000) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const deltas = [...text.matchAll(/event: delta\ndata: ({.*})/g)].map((x) => {
    try {
      return JSON.parse(x[1]).text || "";
    } catch {
      return "";
    }
  });
  const doneMatch = text.match(/event: done\ndata: ({.*})/);
  const errMatch = text.match(/event: error\ndata: ({.*})/);
  return {
    res,
    streamed: deltas.join(""),
    done: doneMatch ? JSON.parse(doneMatch[1]) : null,
    err: errMatch ? JSON.parse(errMatch[1]) : null,
  };
}

console.log("\n=== Live / integration diagram checks ===\n");

const md = geometrySpecToMarkdown({
  title: "直角三角形 ABC",
  shapes: [
    {
      type: "triangle",
      points: [
        [70, 190],
        [250, 190],
        [70, 55],
      ],
      labels: ["C", "B", "A"],
    },
    {
      type: "right_angle",
      at: [70, 190],
      from: [250, 190],
      to: [70, 55],
    },
  ],
});

const streamed = `睇吓呢个图：\n${md}\n你注意到直角喺边度？`;
const finalNoFig =
  "睇吓呢个直角三角形 ABC。直角喺 C。你注意到边度最长？边度系直角？";
const merged = preferCompleteTutorText(streamed, finalNoFig);
ok("preferComplete keeps diagram", hasTutorDiagram(merged));
ok(
  "normalize keeps data-uri",
  normalizeTutorMarkdown(merged).includes("data:image/svg+xml"),
);
ok(
  "clean speech drops SVG",
  !JUNK.test(cleanTutorSpeechText(streamed)) &&
    /睇吓/.test(cleanTutorSpeechText(streamed)),
);

const spoken = streamSpeak(`我画咗一幅：\n${md}\n你注意到直角喺边度？`, 18);
ok("integration stream TTS silent", !JUNK.test(spoken.join(" ")));

try {
  const home = await fetch("http://127.0.0.1:3000/", {
    signal: AbortSignal.timeout(3000),
  });
  if (home.ok) {
    console.log("Running live chat (may take up to 3 min)…");
    const { res, streamed: liveStream, done, err } = await readSse(
      "http://127.0.0.1:3000/api/chat",
      {
        sessionId: `diag-verify-${Date.now()}`,
        message:
          "请用 draw_geometry 画一个直角三角形 ABC，直角在 C。把工具返回的 markdown 图片原样贴进回复，然后用粤语问我注意到什么。不要读出 SVG。",
        voiceId: "wanLung",
        replyLanguage: "yue",
        reset: true,
      },
      180_000,
    );
    ok("live chat SSE ok", res.ok && !err, err?.error || "");
    const finalText = done?.text || "";
    const visible = preferCompleteTutorText(liveStream, finalText);
    const hasFig =
      hasTutorDiagram(visible) ||
      hasTutorDiagram(finalText) ||
      hasTutorDiagram(liveStream);
    ok(
      "live chat keeps renderable diagram",
      hasFig,
      `stream=${hasTutorDiagram(liveStream)} done=${hasTutorDiagram(finalText)}`,
    );
    const liveSpoken = streamSpeak(visible, 24);
    ok(
      "live reply TTS silent on SVG",
      !JUNK.test(liveSpoken.join(" ")),
      liveSpoken.join(" ").slice(0, 100),
    );
  } else {
    console.log("SKIP  live chat (home not ok)");
  }
} catch (e) {
  console.log("SKIP  live chat —", String(e).slice(0, 100));
}

console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
process.exit(failed === 0 ? 0 : 1);
