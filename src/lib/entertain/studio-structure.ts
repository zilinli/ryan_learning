/**
 * Modality-aware draft → Stage structure for Writing Studio.
 * Music → [Verse]/[Chorus] lyrics + style caption.
 * Image / video → visual / cinematic prompts (never lyric section tags).
 */

export type StudioStructureTarget = "music" | "image" | "video";

export type StudioStructureResult = {
  target: StudioStructureTarget;
  /** Main Stage body: lyrics (music) or scene prompt (image/video) */
  body: string;
  /** Style / technical notes for caption field */
  caption: string;
  /** Ready-to-send generation prompt (image/video); music uses body as lyrics */
  prompt: string;
  /** Alias for music body — kept for API compat */
  lyrics: string;
};

const LYRIC_TAG_RE = /\[(Verse|Chorus|Bridge|Intro|Outro)\]/i;
const LYRIC_TAG_GLOBAL_RE = /\[(Verse|Chorus|Bridge|Intro|Outro)\]/gi;

export function looksLikeLyricStructure(text: string): boolean {
  return LYRIC_TAG_RE.test(text);
}

function cleanLines(draft: string): string[] {
  return draft
    .split(/\n+/)
    .map((l) => l.replace(LYRIC_TAG_GLOBAL_RE, "").trim())
    .filter(Boolean);
}

function joinSentences(parts: string[], max = 600): string {
  const s = parts.join(" ").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}

/** Local music structure (same spirit as coach route fallback). */
export function structureMusicLocal(
  draft: string,
  genre: string,
): StudioStructureResult {
  const lines = cleanLines(draft);
  const half = Math.max(2, Math.ceil(lines.length / 2));
  const v1 = lines.slice(0, half).join("\n") || "Something I noticed today…";
  const chorus =
    lines.slice(half, half + 2).join("\n") || "Hold the feeling — say it twice.";
  const v2 =
    lines.slice(half + 2).join("\n") || "Then the world shifted slightly…";
  const body = `[Verse]\n${v1}\n\n[Chorus]\n${chorus}\n\n[Verse]\n${v2}\n\n[Chorus]\n${chorus}`;
  const caption = `${genre} mood, clear vocal, mid tempo, sincere storytelling, studio demo`;
  return {
    target: "music",
    body,
    lyrics: body,
    caption,
    prompt: caption,
  };
}

/**
 * Image prompt: subject + setting + mood + medium/lighting.
 * Never emit [Verse]/[Chorus].
 */
export function structureImageLocal(
  draft: string,
  genre: string,
): StudioStructureResult {
  const lines = cleanLines(draft);
  const subject =
    lines[0] || "a thoughtful student at a sunlit desk with an open notebook";
  const detail =
    lines.slice(1, 4).join("; ") ||
    "quiet focus, soft natural light, lived-in study space";
  const moodMap: Record<string, string> = {
    Indie: "intimate indie still, warm muted palette",
    Orchestral: "cinematic grandeur, rich contrast, film-still mood",
    "Hip-hop sketch": "urban editorial energy, bold shapes, graphic light",
    Ballad: "tender emotional portrait, gentle bokeh, soft dusk light",
  };
  const style =
    moodMap[genre] || "clean editorial illustration, soft depth of field";
  const body = joinSentences([
    subject.replace(/\.$/, ""),
    detail,
    style,
    "single cohesive frame, no text overlays, no watermarks, no lyric sheet",
  ]);
  const caption = `${genre} visual mood · natural lighting · detailed but uncluttered composition`;
  const prompt = joinSentences([body, caption], 1200);
  return {
    target: "image",
    body,
    lyrics: body,
    caption,
    prompt,
  };
}

/**
 * Video prompt: subject + action + camera move + lighting.
 * Never emit lyric section tags.
 */
export function structureVideoLocal(
  draft: string,
  genre: string,
): StudioStructureResult {
  const lines = cleanLines(draft);
  const subject =
    lines[0] || "a quiet desk by a window with a notebook and pencil";
  const action =
    lines.slice(1, 3).join("; ") ||
    "pages stir gently; dust motes drift in the light";
  const camMap: Record<string, string> = {
    Indie: "slow handheld push-in, intimate framing",
    Orchestral: "smooth crane rise revealing the room",
    "Hip-hop sketch": "dynamic lateral tracking shot, rhythmic cuts implied",
    Ballad: "gentle static wide then soft rack focus to the desk",
  };
  const camera = camMap[genre] || "slow cinematic pan, steady frame";
  const body = joinSentences([
    subject.replace(/\.$/, ""),
    action,
    camera,
    "continuous motion, soft natural light, no on-screen text, no lyric karaoke",
  ]);
  const caption = `${genre} cinematic mood · 24fps feel · subtle motion · clean audio-ready scene`;
  const prompt = joinSentences([body, caption], 1200);
  return {
    target: "video",
    body,
    lyrics: body,
    caption,
    prompt,
  };
}

export function structureDraftLocal(
  draft: string,
  genre: string,
  target: StudioStructureTarget = "music",
): StudioStructureResult {
  const t = draft.trim();
  if (target === "image") return structureImageLocal(t, genre);
  if (target === "video") return structureVideoLocal(t, genre);
  return structureMusicLocal(t, genre);
}

/** Build final text2image / text2video prompt from Stage fields. */
export function buildVisualPrompt(body: string, caption: string): string {
  const b = body.replace(LYRIC_TAG_GLOBAL_RE, "").trim();
  const c = caption.trim();
  if (looksLikeLyricStructure(body) && !c) {
    // Strip tags and flatten — last-resort cleanup
    return joinSentences(cleanLines(body), 1200);
  }
  return joinSentences([b, c].filter(Boolean), 1200);
}

export function assertVisualPromptOk(prompt: string): string | null {
  const p = prompt.trim();
  if (p.length < 8) return "Visual prompt too short";
  if (looksLikeLyricStructure(p)) {
    return "Prompt still looks like song lyrics — restructure for Image/Video first";
  }
  return null;
}
