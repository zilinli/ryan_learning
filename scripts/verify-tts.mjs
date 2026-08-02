#!/usr/bin/env node
/**
 * Comprehensive TTS verification for Spark (server + helpers).
 * Run: node scripts/verify-tts.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function isMp3(buf) {
  if (buf.length < 4) return false;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

function ffmpegDecode(buf, label = "tts") {
  const p = join(tmpdir(), `spark-${label}-${Date.now()}-${Math.random()}.mp3`);
  writeFileSync(p, buf);
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", p, "-f", "null", "-"],
    { encoding: "utf8" },
  );
  try {
    unlinkSync(p);
  } catch {
    // ignore
  }
  return r.status === 0;
}

async function tts(url, text, voice) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf, type: res.headers.get("content-type") || "" };
}

async function main() {
  console.log("=== Comprehensive TTS verification ===\n");

  // 1) STT/TTS backend health
  {
    const res = await fetch("http://127.0.0.1:8765/health");
    const j = await res.json();
    ok("edge-tts backend health", res.ok && j.ok, JSON.stringify(j));
  }

  const voices = [
    ["en-US-AvaNeural", "Hi, I'm Spark. I'll read replies in this voice."],
    ["en-GB-RyanNeural", "Hi, I'm Spark. I'll read replies in this British voice."],
  ];

  // 2) Direct STT server TTS
  for (const [voice, text] of voices) {
    const { res, buf } = await tts("http://127.0.0.1:8765/tts", text, voice);
    ok(
      `direct TTS ${voice}`,
      res.ok && isMp3(buf) && ffmpegDecode(buf, voice),
      `bytes=${buf.length}`,
    );
  }

  // 3) Next.js /api/tts
  for (const [voice, text] of voices) {
    const { res, buf, type } = await tts(
      "http://127.0.0.1:3000/api/tts",
      text,
      voice,
    );
    ok(
      `next /api/tts ${voice}`,
      res.ok && type.includes("mpeg") && isMp3(buf) && ffmpegDecode(buf, `n-${voice}`),
      `bytes=${buf.length} type=${type}`,
    );
  }

  // 4) HTTPS nginx path (what phones use)
  for (const [voice, text] of voices) {
    const out = join(tmpdir(), `https-${voice}.mp3`);
    const curl = spawnSync(
      "curl",
      [
        "-sk",
        "-X",
        "POST",
        "https://127.0.0.1/api/tts",
        "-H",
        "Content-Type: application/json",
        "-d",
        JSON.stringify({ text, voice }),
        "-o",
        out,
        "-w",
        "%{http_code}",
      ],
      { encoding: "utf8" },
    );
    const code = curl.stdout.trim();
    const body = readFileSync(out);
    ok(
      `HTTPS /api/tts ${voice}`,
      code === "200" && isMp3(body) && ffmpegDecode(body, `h-${voice}`),
      `http=${code} bytes=${body.length}`,
    );
    try {
      unlinkSync(out);
    } catch {
      // ignore
    }
  }

  // 5) Streaming-style sequential sentence TTS (simulate reply speak)
  const sentences = [
    "Let's look at this carefully.",
    "First, what is the question asking?",
    "Try writing the known values.",
  ];
  let seqOk = true;
  for (let i = 0; i < sentences.length; i += 1) {
    const { res, buf } = await tts(
      "http://127.0.0.1:3000/api/tts",
      sentences[i],
      "en-US-AvaNeural",
    );
    const good = res.ok && isMp3(buf) && ffmpegDecode(buf, `seq${i}`);
    if (!good) seqOk = false;
    ok(`stream sentence ${i + 1}`, good, `bytes=${buf.length}`);
  }
  ok("sequential stream sentences all playable", seqOk);

  // 6) Helpers: clean + pullSpeakable + chunk (dynamic import)
  const {
    cleanTutorSpeechText,
    chunkForNeuralTts,
    pullSpeakableFromBuffer,
  } = await import("../src/lib/tts-text.ts");

  const md = [
    "> From Photo 1, paragraph 2: \"The river froze overnight.\"",
    "",
    "**Find this** in the passage.",
    "",
    "Try $\\frac{1}{2}$ next.",
  ].join("\n");
  const cleaned = cleanTutorSpeechText(md);
  ok(
    "clean strips md/latex for speech",
    /river froze/i.test(cleaned) && /over/i.test(cleaned),
    cleaned.slice(0, 120),
  );

  let buf = "";
  const spoken = [];
  for (const part of [
    "Let's look at this carefully. ",
    "What is the question asking? ",
    "Try the next step with $\\frac{a}{b}$.",
  ]) {
    buf += part;
    const { ready, rest } = pullSpeakableFromBuffer(buf);
    spoken.push(...ready);
    buf = rest;
  }
  spoken.push(...pullSpeakableFromBuffer(buf, { force: true }).ready);
  ok("pullSpeakable yields early sentences", spoken.length >= 2, `n=${spoken.length}`);

  const chunks = chunkForNeuralTts(
    "Check your work. ".repeat(40) + "Does the answer make sense?",
  );
  ok("chunker splits long reply", chunks.length >= 2, `chunks=${chunks.length}`);

  // 7) Empty / short / unicode
  {
    const { res } = await tts("http://127.0.0.1:3000/api/tts", "", "en-US-AvaNeural");
    ok("empty text rejected", res.status === 400);
  }
  {
    const { res, buf } = await tts(
      "http://127.0.0.1:3000/api/tts",
      "OK — let's try again!",
      "en-US-AvaNeural",
    );
    ok(
      "unicode/punctuation TTS",
      res.ok && isMp3(buf) && ffmpegDecode(buf, "uni"),
      `bytes=${buf.length}`,
    );
  }

  // 8) Finish-reply fallback path (full text speakable)
  const full = spoken.join(" ");
  const fallbackChunks = chunkForNeuralTts(full);
  ok("finishReply fallback has chunks", fallbackChunks.length >= 1, `n=${fallbackChunks.length}`);
  {
    const { res, buf } = await tts(
      "https://127.0.0.1/api/tts".replace("https", "http").replace("127.0.0.1/api", "127.0.0.1:3000/api"),
      fallbackChunks[0],
      "en-US-AvaNeural",
    );
    // use localhost next
    const r2 = await tts(
      "http://127.0.0.1:3000/api/tts",
      fallbackChunks[0],
      "en-US-AvaNeural",
    );
    ok(
      "fallback chunk synthesizes",
      r2.res.ok && isMp3(r2.buf),
      `bytes=${r2.buf.length}`,
    );
    void res;
    void buf;
  }

  // 9) Rapid-fire 5 TTS (concurrency / backend stability)
  const rapid = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      tts(
        "http://127.0.0.1:3000/api/tts",
        `Rapid test number ${i + 1}.`,
        i % 2 ? "en-GB-RyanNeural" : "en-US-AvaNeural",
      ),
    ),
  );
  ok(
    "rapid parallel TTS",
    rapid.every((r) => r.res.ok && isMp3(r.buf)),
    rapid.map((r) => r.buf.length).join(","),
  );

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
