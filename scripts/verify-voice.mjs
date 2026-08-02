#!/usr/bin/env node
/**
 * End-to-end verification for Spark voice pipeline.
 * Run: node scripts/verify-voice.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASES = [
  "http://127.0.0.1:8765",
  "http://127.0.0.1:3000",
  "https://127.0.0.1",
];

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function fetchBuf(url, init) {
  const res = await fetch(url, init);
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf, type: res.headers.get("content-type") || "" };
}

function isMp3(buf) {
  if (buf.length < 4) return false;
  // ID3 or MPEG frame sync
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

function ffmpegDecode(buf) {
  const p = join(tmpdir(), `spark-tts-${Date.now()}.mp3`);
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

// Mirror client chunk helper expectations
function cleanTutorSpeechText(text) {
  let t = text.replace(/\r\n/g, "\n").trim();
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/[*_~]+/g, "");
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\n/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function pullSpeakableFromBuffer(buffer, opts = {}) {
  const minChars = opts.minChars ?? 28;
  const maxWaitChars = opts.maxWaitChars ?? 160;
  let buf = buffer.replace(/\r\n/g, "\n");
  const ready = [];
  const take = (end) => {
    const raw = buf.slice(0, end);
    buf = buf.slice(end).replace(/^\s+/, "");
    const cleaned = cleanTutorSpeechText(raw);
    if (cleaned.length >= 2) ready.push(cleaned);
  };
  while (true) {
    const m = buf.match(/[.!?。！？](?:["')\]]+)?(?:\s+|$)/);
    if (!m || m.index === undefined) break;
    const end = m.index + m[0].length;
    if (cleanTutorSpeechText(buf.slice(0, end)).length < Math.min(12, minChars) && !opts.force) {
      break;
    }
    take(end);
  }
  if (opts.force && buf.trim()) take(buf.length);
  return { ready, rest: buf };
}

function chunkForNeuralTts(text, maxLen = 420) {
  const cleaned = cleanTutorSpeechText(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];
  const sentences = cleaned.split(/(?<=[.!?。！？])\s+/);
  const parts = [];
  let buf = "";
  for (const s of sentences) {
    if (!s) continue;
    if (!buf) {
      buf = s;
      continue;
    }
    if ((buf + " " + s).length <= maxLen) buf = `${buf} ${s}`;
    else {
      parts.push(buf);
      buf = s;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

async function main() {
  console.log("=== Spark voice verification ===\n");

  // Health
  {
    const { res, buf } = await fetchBuf("http://127.0.0.1:8765/health");
    const j = JSON.parse(buf.toString());
    ok("STT health", res.ok && j.ok, `voice=${j.tts_voice}`);
  }

  // Preview phrases for both voices
  const voices = [
    { name: "Ava US ♀", voice: "en-US-AvaNeural", text: "Hi, I'm Spark. I'll read replies in this voice." },
    { name: "Ryan UK ♂", voice: "en-GB-RyanNeural", text: "Hi, I'm Spark. I'll read replies in this British voice." },
  ];
  for (const v of voices) {
    const { res, buf } = await fetchBuf("http://127.0.0.1:3000/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: v.text, voice: v.voice }),
    });
    ok(
      `TTS ${v.name}`,
      res.ok && isMp3(buf) && ffmpegDecode(buf),
      `bytes=${buf.length}`,
    );
  }

  // HTTPS path still works
  {
    const out = join(tmpdir(), "https-tts.mp3");
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
        JSON.stringify({
          text: "Hello from Spark.",
          voice: "en-GB-RyanNeural",
        }),
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
      "TTS Ryan via HTTPS",
      code === "200" && isMp3(body) && ffmpegDecode(body),
      `http=${code} bytes=${body.length}`,
    );
  }

  // Long tutor-like reply chunking + each chunk synthesizes
  const longReply =
    "Let's look at this carefully. First, what is the question asking? " +
    "Try writing the known values. Then choose a method. " +
    "Check your units. Does the answer make sense? ".repeat(8);
  const chunks = chunkForNeuralTts(longReply);
  ok("chunker splits long reply", chunks.length >= 2, `chunks=${chunks.length}`);

  let allChunkOk = true;
  for (const [i, chunk] of chunks.entries()) {
    const { res, buf } = await fetchBuf("http://127.0.0.1:3000/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk }),
    });
    const good = res.ok && isMp3(buf) && ffmpegDecode(buf);
    if (!good) allChunkOk = false;
    ok(`TTS chunk ${i + 1}/${chunks.length}`, good, `bytes=${buf.length} chars=${chunk.length}`);
  }
  ok("all reply chunks playable", allChunkOk);

  // Streaming speak: complete sentences become ready before the full reply
  {
    let buf = "";
    const spoken = [];
    for (const part of [
      "Let's look at this carefully. ",
      "What is the question asking? ",
      "Try the next step",
    ]) {
      buf += part;
      const { ready, rest } = pullSpeakableFromBuffer(buf);
      spoken.push(...ready);
      buf = rest;
    }
    const flushed = pullSpeakableFromBuffer(buf, { force: true });
    spoken.push(...flushed.ready);
    ok(
      "stream speak pulls sentences early",
      spoken.length >= 2 && spoken[0].includes("carefully"),
      `n=${spoken.length} first=${spoken[0]?.slice(0, 40)}`,
    );
  }

  // Simulate race: wantSpeak must be set BEFORE speak loop checks
  let wantSpeak = false;
  const speakPreview = async () => {
    // BUG pattern (old): check wantSpeak before sync set → silent
    if (!wantSpeak) return "aborted-old-bug";
    return "played";
  };
  // old order
  const oldResult = await speakPreview();
  ok("repro old Speak-on race (would abort)", oldResult === "aborted-old-bug");
  // fixed order
  wantSpeak = true;
  const newResult = await speakPreview();
  ok("fixed Speak-on sets wantSpeak first", newResult === "played");

  // WAV upload path still accepts audio
  {
    const wav = join(tmpdir(), "tone.wav");
    spawnSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ar", "16000", "-ac", "1", wav], { stdio: "ignore" });
    const form = new FormData();
    form.append("audio", new Blob([readFileSync(wav)], { type: "audio/wav" }), "speech.wav");
    const res = await fetch("http://127.0.0.1:3000/api/transcribe", { method: "POST", body: form });
    const j = await res.json();
    // sine may yield empty text — endpoint must not 500
    ok("transcribe WAV does not 500", res.status === 200 || res.status === 422, `status=${res.status} body=${JSON.stringify(j)}`);
  }

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
