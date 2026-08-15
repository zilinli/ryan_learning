import { describe, expect, it } from "vitest";
import { sniffTtsAudioMime } from "./tts-audio-mime";

describe("sniffTtsAudioMime", () => {
  it("detects RIFF/WAVE as audio/wav", () => {
    const buf = new Uint8Array(44);
    buf.set([0x52, 0x49, 0x46, 0x46], 0);
    buf.set([0x57, 0x41, 0x56, 0x45], 8);
    expect(sniffTtsAudioMime(buf)).toBe("audio/wav");
  });

  it("detects ID3 MP3 as audio/mpeg", () => {
    const buf = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);
    expect(sniffTtsAudioMime(buf)).toBe("audio/mpeg");
  });

  it("detects MPEG frame sync as audio/mpeg", () => {
    const buf = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    expect(sniffTtsAudioMime(buf)).toBe("audio/mpeg");
  });
});
