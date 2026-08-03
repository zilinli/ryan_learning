import { describe, expect, it } from "vitest";
import {
  downsampleTo16k,
  encodeWav,
  filenameForAudioBlob,
  normalizePeak,
  pcmRms,
} from "./wav-recorder";

describe("wav-recorder helpers", () => {
  it("downsamples to 16 kHz", () => {
    const input = new Float32Array(48000);
    for (let i = 0; i < input.length; i += 1) input[i] = Math.sin(i / 20);
    const out = downsampleTo16k(input, 48000);
    expect(out.length).toBe(16000);
  });

  it("normalizes quiet peaks", () => {
    const quiet = new Float32Array(1000);
    for (let i = 0; i < quiet.length; i += 1) quiet[i] = 0.02 * Math.sin(i / 5);
    const out = normalizePeak(quiet, 0.85);
    expect(pcmRms(out)).toBeGreaterThan(pcmRms(quiet));
    let peak = 0;
    for (let i = 0; i < out.length; i += 1) peak = Math.max(peak, Math.abs(out[i]!));
    expect(peak).toBeGreaterThan(0.7);
  });

  it("encodes a valid-ish WAV header", async () => {
    const samples = new Float32Array(1600);
    samples[10] = 0.5;
    const blob = encodeWav(samples, 16000);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 1600 * 2);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...buf.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...buf.slice(8, 12))).toBe("WAVE");
  });

  it("picks filenames from mime types", () => {
    expect(filenameForAudioBlob(new Blob([], { type: "audio/wav" }))).toBe(
      "speech.wav",
    );
    expect(filenameForAudioBlob(new Blob([], { type: "audio/webm" }))).toBe(
      "speech.webm",
    );
    expect(filenameForAudioBlob(new Blob([], { type: "audio/mp4" }))).toBe(
      "speech.m4a",
    );
  });
});
