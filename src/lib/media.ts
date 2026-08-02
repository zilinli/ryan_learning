/** Shared mobile / browser media helpers */

export function isSecureMediaContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  success: (stream: MediaStream) => void,
  error: (err: Error) => void,
) => void;

export function ensureMediaDevices(): MediaDevices | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    mediaDevices?: MediaDevices;
    webkitGetUserMedia?: LegacyGetUserMedia;
    mozGetUserMedia?: LegacyGetUserMedia;
    getUserMedia?: LegacyGetUserMedia;
  };

  if (!nav.mediaDevices) {
    (nav as { mediaDevices?: MediaDevices }).mediaDevices = {} as MediaDevices;
  }

  if (!nav.mediaDevices.getUserMedia) {
    const legacy =
      nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia;
    if (!legacy) return null;
    nav.mediaDevices.getUserMedia = (constraints: MediaStreamConstraints) =>
      new Promise<MediaStream>((resolve, reject) => {
        legacy.call(nav, constraints, resolve, reject);
      });
  }

  return nav.mediaDevices;
}

const FEMALE_NAME =
  /samantha|karen|moira|serena|victoria|tessa|fiona|veena|zuzana|kathy|zira|aria|jenny|sara|susan|linda|heather|allison|ava|emma|joanna|ivy|kendra|kimberly|salli|nicole|olivia|female|woman|girl|google uk english female|google us english|microsoft aria|microsoft jenny|microsoft zira|samsung korean.*female|ting-ting|mei-jia|sin-ji/i;

const MALE_NAME =
  /daniel|david|male|\bman\b|fred|alex|tom|ravi|bruce|albert|jorge|diego|juan|reed|eddy|gordon|aaron|arthur|nathan|google uk english male|microsoft david|microsoft mark|microsoft guy|bad news|bahh|boing|bubbles|cellos|good news|junior|pipe organ|ralph|trinoids|whisper|zarvox/i;

/** Prefer a natural English female voice for tutoring. */
export function preferEnglishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const scored = voices.map((v) => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    const name = v.name;
    let score = 0;

    if (lang.startsWith("en")) score += 20;
    else score -= 50;

    if (lang === "en-us") score += 6;
    else if (lang === "en-gb") score += 4;
    else if (lang === "en-au") score += 3;

    if (FEMALE_NAME.test(name)) score += 30;
    if (MALE_NAME.test(name)) score -= 40;

    // Enhanced / neural / premium voices sound less robotic
    if (/neural|natural|premium|enhanced|online/i.test(name)) score += 8;
    if (v.localService) score += 2;

    // Strong known good tutor voices
    if (/samantha|karen|moira|aria|jenny|zira|serena|tessa/i.test(name)) {
      score += 10;
    }

    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.v ?? null;
}

/** Slightly warmer delivery for female tutoring voice. */
export function tutorSpeechStyle(utter: SpeechSynthesisUtterance) {
  utter.rate = 0.96;
  utter.pitch = 1.12;
  utter.volume = 1;
}

/** iOS / some Android engines choke on long utterances. */
export function chunkSpeechText(text: string, maxLen = 160): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const parts: string[] = [];
  const sentences = cleaned.split(/(?<=[.!?。！？])\s+/);
  let buf = "";
  for (const s of sentences) {
    if (!s) continue;
    if ((buf + " " + s).trim().length <= maxLen) {
      buf = (buf + " " + s).trim();
      continue;
    }
    if (buf) parts.push(buf);
    if (s.length <= maxLen) {
      buf = s;
      continue;
    }
    for (let i = 0; i < s.length; i += maxLen) {
      parts.push(s.slice(i, i + maxLen));
    }
    buf = "";
  }
  if (buf) parts.push(buf);
  return parts;
}

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function canRecordAudio(): boolean {
  if (typeof window === "undefined") return false;
  if (!isSecureMediaContext()) return false;
  if (!ensureMediaDevices()?.getUserMedia) return false;
  const hasAudioCtx = Boolean(
    window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext,
  );
  return hasAudioCtx || typeof MediaRecorder !== "undefined";
}
