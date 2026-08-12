/**
 * Stage style presets for Writing Studio (song / image / video).
 * Structure suggests a default; the student may change it before Generate.
 */

export type StageStyleTarget = "music" | "image" | "video";

export const SONG_STYLES = [
  "Indie",
  "Hip-hop",
  "Ballad",
  "Orchestral",
  "Folk",
  "Electronic",
] as const;

export const IMAGE_STYLES = [
  "Photo",
  "Watercolor",
  "Comic",
  "Film still",
] as const;

export const VIDEO_STYLES = [
  "Playful",
  "Documentary",
  "Music video",
  "Quiet",
] as const;

export type SongStyle = (typeof SONG_STYLES)[number];
export type ImageStyle = (typeof IMAGE_STYLES)[number];
export type VideoStyle = (typeof VIDEO_STYLES)[number];
export type StageStyle = SongStyle | ImageStyle | VideoStyle;

const LEGACY_SONG: Record<string, SongStyle> = {
  "Hip-hop sketch": "Hip-hop",
  "hip-hop sketch": "Hip-hop",
  "hip hop": "Hip-hop",
  "hip-pop": "Hip-hop",
  "hip pop": "Hip-hop",
};

function pickCi<T extends string>(list: readonly T[], raw: string, fallback: T): T {
  const t = raw.trim();
  const hit = list.find((s) => s.toLowerCase() === t.toLowerCase());
  return hit || fallback;
}

export function normalizeSongStyle(raw: string | undefined | null): SongStyle {
  const t = String(raw || "").trim();
  if (!t) return "Indie";
  if (LEGACY_SONG[t]) return LEGACY_SONG[t];
  return pickCi(SONG_STYLES, t, "Indie");
}

export function normalizeImageStyle(raw: string | undefined | null): ImageStyle {
  return pickCi(IMAGE_STYLES, String(raw || ""), "Photo");
}

export function normalizeVideoStyle(raw: string | undefined | null): VideoStyle {
  return pickCi(VIDEO_STYLES, String(raw || ""), "Playful");
}

export function normalizeStageStyle(
  target: StageStyleTarget,
  raw: string | undefined | null,
): StageStyle {
  if (target === "image") return normalizeImageStyle(raw);
  if (target === "video") return normalizeVideoStyle(raw);
  return normalizeSongStyle(raw);
}

export function stylesForTarget(target: StageStyleTarget): readonly string[] {
  if (target === "image") return IMAGE_STYLES;
  if (target === "video") return VIDEO_STYLES;
  return SONG_STYLES;
}

function looksPunchy(text: string): boolean {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/^\[[^\]]+\]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length < 4) return false;
  const avg = lines.reduce((a, l) => a + l.length, 0) / lines.length;
  return avg < 28;
}

/** Infer a Stage style from structured lyrics / visual prompt. */
export function suggestStageStyle(
  target: StageStyleTarget,
  text: string,
): StageStyle {
  const raw = text || "";
  const t = raw.toLowerCase();
  if (target === "music") {
    if (/\b(hip-?hop|rap|rhyme|beat|flow|mic)\b/.test(t) || /说唱|饶舌/.test(raw)) {
      return "Hip-hop";
    }
    if (/\b(orchestra|cinematic|epic|symphony|strings)\b/.test(t) || /交响|管弦/.test(raw)) {
      return "Orchestral";
    }
    if (/\b(folk|acoustic|campfire)\b/.test(t) || /民谣/.test(raw)) return "Folk";
    if (/\b(electro|synth|edm|pulse)\b/.test(t) || /电子/.test(raw)) {
      return "Electronic";
    }
    if (
      /\b(ballad|tears|lullaby|tender|gentle)\b/.test(t) ||
      /温柔|摇篮/.test(raw)
    ) {
      return "Ballad";
    }
    if (looksPunchy(raw)) return "Hip-hop";
    return "Indie";
  }
  if (target === "image") {
    if (/\b(watercolor|wash)\b/.test(t) || /水彩/.test(raw)) return "Watercolor";
    if (/\b(comic|panel|superhero|inked)\b/.test(t) || /漫画/.test(raw)) {
      return "Comic";
    }
    if (/\b(cinematic|film still|dusk|dramatic)\b/.test(t) || /电影/.test(raw)) {
      return "Film still";
    }
    return "Photo";
  }
  if (/\b(\[verse\]|\[chorus\]|music video|rhythm|karaoke)\b/.test(t)) {
    return "Music video";
  }
  if (/\b(document|observ|interview)\b/.test(t) || /纪录/.test(raw)) {
    return "Documentary";
  }
  if (/\b(dusk|whisper|stillness|quiet)\b/.test(t) || /黄昏|安静/.test(raw)) {
    return "Quiet";
  }
  return "Playful";
}

const IMAGE_HINT: Record<ImageStyle, string> = {
  Photo: "naturalistic still, soft light",
  Watercolor: "kids-book wash, paper texture",
  Comic: "bold ink, flat color",
  "Film still": "cinematic grade, shallow depth",
};

const VIDEO_HINT: Record<VideoStyle, string> = {
  Playful: "light tracking, daylight",
  Documentary: "observational, slower",
  "Music video": "rhythmic cuts, one continuous clip",
  Quiet: "single push-in, dusk",
};

export function styleCaptionSeed(
  target: StageStyleTarget,
  style: string,
  vocal?: "female" | "male",
): string {
  if (target === "music") {
    const s = normalizeSongStyle(style);
    const v = vocal === "male" ? "male vocal" : "female vocal";
    return `${s} mood, ${v}, mid tempo, sincere storytelling, studio demo`;
  }
  if (target === "image") {
    const s = normalizeImageStyle(style);
    return `${s} visual mood · ${IMAGE_HINT[s]} · uncluttered composition`;
  }
  const s = normalizeVideoStyle(style);
  return `${s} cinematic mood · ${VIDEO_HINT[s]} · 24fps feel`;
}
