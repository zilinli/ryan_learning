/**
 * Modality-aware draft → Stage structure for Writing Studio.
 * Music → adapted [Verse]/[Chorus] lyrics + style caption (not a verbatim paste).
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

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

/** Pull short content words for local adaptation (not full-sentence paste). */
export function extractDraftMotifs(draft: string): string[] {
  const lines = cleanLines(draft);
  const bag: string[] = [];
  for (const line of lines) {
    if (hasCjk(line)) {
      const chunks = line
        .replace(/[，。！？、；：""''（）\s]+/g, " ")
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);
      bag.push(...chunks.slice(0, 4));
    } else {
      const words = line
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 2 &&
            !["the", "and", "for", "that", "with", "this", "from", "have", "was", "are", "were", "but"].includes(
              w,
            ),
        );
      bag.push(...words.slice(0, 5));
    }
  }
  return [...new Set(bag)].slice(0, 12);
}

function lyricLineFromMotifs(
  motifs: string[],
  fallback: string,
  cjk: boolean,
  kind: "verse" | "chorus",
): string {
  const a = motifs[0] || (cjk ? "今天" : "today");
  const b = motifs[1] || (cjk ? "光" : "light");
  const c = motifs[2] || (cjk ? "心" : "heart");
  const d = motifs[3] || (cjk ? "路" : "road");
  if (cjk) {
    if (kind === "chorus") {
      return `${b}还在，${c}还在\n我把${a}唱成歌`;
    }
    return `${a}轻轻落下\n${b}里藏着${c}\n${d}向前，不回头`;
  }
  if (kind === "chorus") {
    return `Hold the ${b}, hold the ${c}\nSing ${a} one more time`;
  }
  return `In the ${b} of ${a}\nI trace a quieter ${d}\n${c} learns a softer name`;
  // fallback unused when motifs exist; keep for empty drafts
  void fallback;
}

/** Local music structure — adapt ideas into singable lines (not paste). */
export function structureMusicLocal(
  draft: string,
  genre: string,
): StudioStructureResult {
  const raw = draft.trim();
  const motifs = extractDraftMotifs(raw);
  const cjk = hasCjk(raw);
  const v1 = lyricLineFromMotifs(motifs, "a quiet morning", cjk, "verse");
  const chorus = lyricLineFromMotifs(
    motifs.slice(1),
    "hold the feeling",
    cjk,
    "chorus",
  );
  const v2Motifs = motifs.length > 3 ? motifs.slice(2) : motifs;
  const v2 = lyricLineFromMotifs(v2Motifs, "the day turns", cjk, "verse");
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
 * Never emit [Verse]/[Chorus]. Adapt — don't paste essay prose.
 */
export function structureImageLocal(
  draft: string,
  genre: string,
): StudioStructureResult {
  const lines = cleanLines(draft);
  const motifs = extractDraftMotifs(draft);
  const cjk = hasCjk(draft);
  const subject = cjk
    ? `一个沉静的场景，围绕「${motifs[0] || "书桌"}」与「${motifs[1] || "光"}」`
    : `a contemplative scene built around ${motifs[0] || "a sunlit desk"} and ${motifs[1] || "soft light"}`;
  const detail = cjk
    ? `氛围来自写作意象：${motifs.slice(0, 5).join("、") || "安静、专注"}；不要出现大段原文`
    : `mood drawn from motifs: ${motifs.slice(0, 6).join(", ") || "quiet focus"}; no pasted essay text`;
  const moodMap: Record<string, string> = {
    Indie: "intimate indie still, warm muted palette",
    Orchestral: "cinematic grandeur, rich contrast, film-still mood",
    "Hip-hop": "urban editorial energy, bold shapes, graphic light",
    "Hip-hop sketch": "urban editorial energy, bold shapes, graphic light",
    Ballad: "tender emotional portrait, gentle bokeh, soft dusk light",
    Folk: "handmade paper, natural light, rural still",
    Electronic: "neon edge light, graphic night city",
    Photo: "naturalistic still, soft light",
    Watercolor: "kids-book wash, paper texture",
    Comic: "bold ink, flat color",
    "Film still": "cinematic grade, shallow depth",
  };
  const style =
    moodMap[genre] || "clean editorial illustration, soft depth of field";
  // Prefer adapted subject over raw first line paste
  void lines;
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
 * Never emit lyric section tags. Adapt — don't paste essay prose.
 */
export function structureVideoLocal(
  draft: string,
  genre: string,
): StudioStructureResult {
  const motifs = extractDraftMotifs(draft);
  const cjk = hasCjk(draft);
  const subject = cjk
    ? `镜头里，「${motifs[0] || "窗边"}」与「${motifs[1] || "笔记本"}」缓缓入画`
    : `on screen, ${motifs[0] || "a quiet desk by a window"} and ${motifs[1] || "an open notebook"} ease into frame`;
  const action = cjk
    ? `动作来自意象 ${motifs.slice(2, 5).join("、") || "微风、尘埃"}：轻轻移动，连续不跳切`
    : `action from motifs ${motifs.slice(2, 6).join(", ") || "pages stir, dust motes"}: continuous motion, no jump cuts`;
  const camMap: Record<string, string> = {
    Indie: "slow handheld push-in, intimate framing",
    Orchestral: "smooth crane rise revealing the room",
    "Hip-hop": "dynamic lateral tracking shot, rhythmic cuts implied",
    "Hip-hop sketch": "dynamic lateral tracking shot, rhythmic cuts implied",
    Ballad: "gentle static wide then soft rack focus to the desk",
    Folk: "steady observational wide, natural light",
    Electronic: "rhythmic tracking, night neon",
    Playful: "light tracking, daylight",
    Documentary: "observational, slower handheld",
    "Music video": "rhythmic implied cuts, one continuous move",
    Quiet: "single push-in, dusk",
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

/** True if structured body looks like a near-verbatim dump of the draft. */
export function isNearVerbatimStructure(draft: string, body: string): boolean {
  const d = draft.replace(LYRIC_TAG_GLOBAL_RE, "").replace(/\s+/g, " ").trim().toLowerCase();
  const b = body.replace(LYRIC_TAG_GLOBAL_RE, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (d.length < 20 || b.length < 20) return false;
  if (b.includes(d) || d.includes(b)) return true;
  // High overlap of consecutive 8-char windows from draft appearing in body
  let hits = 0;
  let total = 0;
  for (let i = 0; i + 8 <= d.length; i += 8) {
    total += 1;
    if (b.includes(d.slice(i, i + 8))) hits += 1;
  }
  return total > 0 && hits / total >= 0.7;
}
