/** Sniff TTS payload MIME — Qwen Shanghai often returns WAV while CosyVoice/edge return MP3. */
export type TtsAudioMime = "audio/mpeg" | "audio/wav";

export function sniffTtsAudioMime(
  bytes: ArrayBuffer | Uint8Array | Buffer,
): TtsAudioMime {
  const u8 =
    bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : bytes instanceof Uint8Array
        ? bytes
        : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u8.byteLength >= 12) {
    const riff =
      u8[0] === 0x52 &&
      u8[1] === 0x49 &&
      u8[2] === 0x46 &&
      u8[3] === 0x46;
    const wave =
      u8[8] === 0x57 &&
      u8[9] === 0x41 &&
      u8[10] === 0x56 &&
      u8[11] === 0x45;
    if (riff && wave) return "audio/wav";
  }
  // ID3 or MPEG frame sync
  if (
    u8.byteLength >= 3 &&
    u8[0] === 0x49 &&
    u8[1] === 0x44 &&
    u8[2] === 0x33
  ) {
    return "audio/mpeg";
  }
  if (u8.byteLength >= 2 && u8[0] === 0xff && (u8[1]! & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  return "audio/mpeg";
}
