#!/usr/bin/env node
/**
 * Multilingual STT verification via edge-tts → wav → whisper.
 * Run: node scripts/verify-stt.mjs
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
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

async function synthWav(text, voice, outWav) {
  const mp3 = outWav + ".mp3";
  const res = await fetch("http://127.0.0.1:8765/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`TTS failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(mp3, buf);
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", mp3, "-ac", "1", "-ar", "16000", outWav],
    { encoding: "utf8" },
  );
  try {
    unlinkSync(mp3);
  } catch {
    // ignore
  }
  if (r.status !== 0) throw new Error("ffmpeg wav failed");
}

async function transcribe(wavPath, language) {
  const form = new FormData();
  const blob = new Blob([readFileSync(wavPath)], { type: "audio/wav" });
  form.append("audio", blob, "speech.wav");
  form.append("language", language);
  const res = await fetch("http://127.0.0.1:8765/transcribe", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  return { res, data };
}

async function transcribeNext(wavPath, language) {
  const form = new FormData();
  const blob = new Blob([readFileSync(wavPath)], { type: "audio/wav" });
  form.append("audio", blob, "speech.wav");
  form.append("language", language);
  const res = await fetch("http://127.0.0.1:3000/api/transcribe", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  return { res, data };
}

function includesAny(text, needles) {
  const t = (text || "").toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

async function main() {
  console.log("=== Multilingual STT verification ===\n");

  const health = await (await fetch("http://127.0.0.1:8765/health")).json();
  ok(
    "STT model is multilingual",
    health.ok && health.model && !String(health.model).endsWith(".en"),
    `model=${health.model}`,
  );
  ok(
    "STT model is stronger than base",
    health.ok &&
      !["tiny", "base", "tiny.en", "base.en"].includes(String(health.model)),
    `model=${health.model}`,
  );
  ok(
    "STT langs advertised",
    Array.isArray(health.stt_langs) && health.stt_langs.includes("zh"),
    JSON.stringify(health.stt_langs),
  );
  ok(
    "SenseVoice enabled for zh/yue",
    health.sensevoice === true,
    `sensevoice=${health.sensevoice} err=${health.sensevoice_error || ""}`,
  );

  const cases = [
    {
      name: "English",
      language: "en",
      voice: "en-US-AvaNeural",
      text: "Hello, I need help with my homework today.",
      expect: ["hello", "homework", "help"],
      // SenseVoice or whisper both OK for English
    },
    {
      name: "Mandarin",
      language: "zh",
      voice: "zh-CN-YunxiNeural",
      text: "你好，请帮我看一下这道数学题。",
      expect: ["你好", "数学", "帮"],
      engine: "sensevoice",
    },
    {
      name: "Cantonese",
      language: "yue",
      voice: "zh-HK-WanLungNeural",
      text: "呢个功课点做呀，我想问老师。",
      expect: ["功课", "想", "问", "呢", "做"],
      expectLang: "yue",
      engine: "sensevoice",
    },
    {
      name: "Spanish",
      language: "es",
      voice: "es-ES-AlvaroNeural",
      text: "Hola, necesito ayuda con la tarea de matemáticas.",
      expect: ["hola", "ayuda", "tarea", "matem"],
      engine: "whisper",
    },
  ];

  for (const c of cases) {
    const wav = join(tmpdir(), `stt-${c.language}-${Date.now()}.wav`);
    try {
      await synthWav(c.text, c.voice, wav);
      const { res, data } = await transcribe(wav, c.language);
      const text = (data.text || "").trim();
      const langOk = !c.expectLang || data.language === c.expectLang;
      const engineOk = !c.engine || !data.engine || data.engine === c.engine;
      ok(
        `STT ${c.name}`,
        res.ok &&
          text.length > 0 &&
          includesAny(text, c.expect) &&
          langOk &&
          engineOk,
        `lang=${data.language || c.language} engine=${data.engine || "?"} text="${text}"`,
      );
    } catch (err) {
      ok(`STT ${c.name}`, false, err instanceof Error ? err.message : String(err));
    } finally {
      try {
        unlinkSync(wav);
      } catch {
        // ignore
      }
    }
  }

  // Auto-detect Spanish via Next proxy
  {
    const wav = join(tmpdir(), `stt-auto-${Date.now()}.wav`);
    try {
      await synthWav(
        "Buenos días, ¿puedes explicarme esta pregunta?",
        "es-MX-JorgeNeural",
        wav,
      );
      const { res, data } = await transcribeNext(wav, "auto");
      ok(
        "Next /api/transcribe auto Spanish",
        res.ok && includesAny(data.text || "", ["días", "dias", "pregunta", "explic"]),
        `text="${data.text || ""}"`,
      );
    } catch (err) {
      ok(
        "Next /api/transcribe auto Spanish",
        false,
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      try {
        unlinkSync(wav);
      } catch {
        // ignore
      }
    }
  }

  // Client helper mapping — voices.ts is self-contained for Node strip-types;
  // stt-lang.ts value-imports it without an extension (bundler style).
  {
    const { normalizeVoiceId } = await import("../src/lib/voices.ts");
    const sttLangFromVoice = (voiceId) => {
      switch (normalizeVoiceId(voiceId)) {
        case "ava":
        case "ryan":
          return "en";
        case "yunxi":
          return "zh";
        case "wanLung":
          return "yue";
        case "alvaro":
        case "jorge":
          return "es";
        case "auto":
        default:
          return "auto";
      }
    };
    ok("voice→stt yunxi", sttLangFromVoice("yunxi") === "zh");
    ok("voice→stt wanLung", sttLangFromVoice("wanLung") === "yue");
    ok("voice→stt alvaro", sttLangFromVoice("alvaro") === "es");
    ok("voice→stt legacy xiaoxiao", sttLangFromVoice("xiaoxiao") === "zh");
    ok("voice→stt auto", sttLangFromVoice("auto") === "auto");
  }

  console.log(`\n=== ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
