import { ensureMediaDevices, pickRecorderMimeType } from "./media";

/** Encode mono PCM float samples as a 16-bit WAV blob. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Downsample Float32 PCM to 16 kHz mono with anti-aliasing pre-filter.
 *
 *  Linear interpolation alone introduces high-frequency aliasing artifacts
 *  that confuse Whisper on non-English audio (especially Spanish consonants).
 *  A short moving-average pre-filter attenuates content above 8 kHz before
 *  the interpolation step, which is essential for clean 48k→16k conversion.
 */
export function downsampleTo16k(
  input: Float32Array,
  inputRate: number,
): Float32Array {
  if (inputRate === 16000) return input;
  if (inputRate <= 0 || input.length === 0) return input;

  // Anti-aliasing: 3-tap moving-average pre-filter (~30 dB attenuation at fs/4)
  // The filter kernel [0.25, 0.5, 0.25] has a -6 dB point at ~0.25×fs_in
  // which means for 48k→16k the transition band starts well above 8 kHz Nyquist.
  const filtered = new Float32Array(input.length);
  filtered[0] = input[0] ?? 0;
  for (let i = 1; i < input.length - 1; i += 1) {
    filtered[i] =
      (input[i - 1] ?? 0) * 0.25 +
      (input[i] ?? 0) * 0.5 +
      (input[i + 1] ?? 0) * 0.25;
  }
  filtered[input.length - 1] = input[input.length - 1] ?? 0;

  const ratio = inputRate / 16000;
  const outLen = Math.max(1, Math.floor(filtered.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, filtered.length - 1);
    const frac = pos - i0;
    out[i] = (filtered[i0] ?? 0) * (1 - frac) + (filtered[i1] ?? 0) * frac;
  }
  return out;
}

/** Peak-normalize quiet mic captures (common on phones).
 *
 *  Phone mics at 16-bit can produce peak values as low as 0.001–0.003
 *  for a normal speaking voice at arm's length. Without normalization
 *  the audio is below Whisper's effective dynamic range.
 *  Target 0.9 to leave a little headroom while boosting quiet speech.
 */
export function normalizePeak(
  samples: Float32Array,
  target = 0.9,
): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const a = Math.abs(samples[i] ?? 0);
    if (a > peak) peak = a;
  }
  // Boost quiet but non-silent clips (peak 0.0005+). Only skip if near-zero
  // (dead air) or already loud enough.
  if (peak < 0.0005 || peak >= target) return samples;
  const gain = Math.min(target / peak, 24.0); // cap gain at 24x
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = Math.max(-1, Math.min(1, (samples[i] ?? 0) * gain));
  }
  return out;
}

export function pcmRms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

export type MicRecorderHandles = {
  stop: () => Promise<Blob>;
  stream: MediaStream;
};

async function getMicStream(): Promise<MediaStream> {
  const devices = ensureMediaDevices();
  if (!devices?.getUserMedia) {
    throw new Error("Microphone is not available");
  }
  // Prefer clean mono capture; AGC + noise suppression help quiet phone mics.
  // Ideal 48 kHz is downsampled to 16 kHz for STT (native Whisper/SenseVoice rate).
  // voiceIsolation (Chrome) further reduces keyboard / room noise when available.
  const baseConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  };
  try {
    return await devices.getUserMedia({
      audio: {
        ...baseConstraints,
        ...({ voiceIsolation: true } as MediaTrackConstraints),
      },
      video: false,
    });
  } catch {
    try {
      return await devices.getUserMedia({
        audio: baseConstraints,
        video: false,
      });
    } catch {
      return devices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
    }
  }
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a")) {
    return "m4a";
  }
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/**
 * MediaRecorder path — more reliable on HarmonyOS / iOS WebViews than
 * ScriptProcessor. STT server normalizes any container via ffmpeg.
 */
async function startMediaRecorderSession(
  stream: MediaStream,
): Promise<MicRecorderHandles | null> {
  const mimeType = pickRecorderMimeType();
  if (!mimeType || typeof MediaRecorder === "undefined") return null;

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch {
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      return null;
    }
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  // timeslice keeps data flowing on flaky mobile implementations
  recorder.start(250);

  return {
    stream,
    stop: async () => {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error("Recording stop timed out"));
        }, 8000);
        recorder.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error("Recording failed"));
        };
        recorder.onstop = () => {
          window.clearTimeout(timer);
          const type = recorder.mimeType || mimeType || "audio/webm";
          resolve(new Blob(chunks, { type }));
        };
        try {
          if (recorder.state === "recording" || recorder.state === "paused") {
            recorder.requestData?.();
            recorder.stop();
          } else {
            window.clearTimeout(timer);
            const type = recorder.mimeType || mimeType || "audio/webm";
            resolve(new Blob(chunks, { type }));
          }
        } catch (err) {
          window.clearTimeout(timer);
          reject(err instanceof Error ? err : new Error("Recording failed"));
        }
      });
      stream.getTracks().forEach((t) => t.stop());
      return blob;
    },
  };
}

/**
 * ScriptProcessor → 16 kHz WAV. Fallback when MediaRecorder is unavailable.
 */
async function startScriptProcessorSession(
  stream: MediaStream,
): Promise<MicRecorderHandles> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(8192, 1, 1);
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  return {
    stream,
    stop: async () => {
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
        source.disconnect();
        mute.disconnect();
      } catch {
        // ignore
      }
      stream.getTracks().forEach((t) => t.stop());
      const sampleRate = ctx.sampleRate;
      await ctx.close().catch(() => undefined);

      let total = 0;
      for (const c of chunks) total += c.length;
      const merged = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      const normalized = normalizePeak(merged);
      const pcm16k = downsampleTo16k(normalized, sampleRate);
      return encodeWav(pcm16k, 16000);
    },
  };
}

export type StartWavRecorderOptions = {
  /**
   * Prefer MediaRecorder containers (webm/mp4). Avoid when possible — short
   * WebM from Chrome often fails ffmpeg EBML parse; 16 kHz WAV is more
   * reliable for STT. Kept for rare WebViews where ScriptProcessor is broken.
   */
  preferContainer?: boolean;
};

/**
 * Record mic audio for STT.
 * Default: 16 kHz peak-normalized WAV via ScriptProcessor (best for STT).
 * MediaRecorder is fallback (or first if preferContainer).
 */
export async function startWavRecorder(
  options?: StartWavRecorderOptions,
): Promise<MicRecorderHandles> {
  const stream = await getMicStream();
  const preferContainer = Boolean(options?.preferContainer);
  try {
    if (preferContainer) {
      const media = await startMediaRecorderSession(stream);
      if (media) return media;
      return await startScriptProcessorSession(stream);
    }
    try {
      return await startScriptProcessorSession(stream);
    } catch {
      const media = await startMediaRecorderSession(stream);
      if (media) return media;
      throw new Error("Recording failed");
    }
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw err;
  }
}

export function filenameForAudioBlob(blob: Blob): string {
  const type = (blob.type || "").toLowerCase();
  return `speech.${extensionForMime(type || "audio/wav")}`;
}

/** True when PCM looks loud enough for STT (WAV path only).
 *
 *  Aligned with stt_server.py silence gate (RMS 0.0015).
 *  After normalizePeak the effective RMS of quiet speech is 0.005–0.02.
 */
export async function blobLooksSilent(blob: Blob): Promise<boolean> {
  if (!blob.type.includes("wav") || blob.size < 100) return blob.size < 1500;
  try {
    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 44) return true;
    // Skip 44-byte header; 16-bit PCM
    let sum = 0;
    let n = 0;
    let peak = 0;
    for (let i = 44; i + 1 < view.byteLength; i += 2) {
      const s = Math.abs(view.getInt16(i, true)) / 32768;
      sum += s * s;
      if (s > peak) peak = s;
      n += 1;
    }
    if (!n) return true;
    const rms = Math.sqrt(sum / n);
    // Gate must be looser than the server's (0.0015) to avoid false negatives.
    // Only reject clips that are clearly dead air.
    return rms < 0.0010 && peak < 0.01;
  } catch {
    return false;
  }
}
