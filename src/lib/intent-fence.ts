/**
 * Collab intents — hidden fence the tutor may emit to surface an inline
 * collaboration (writing workspace / media generation / mini-game / lab
 * recommendation) inside the main chat. Mirrors the worksheet-plan /
 * experiment fence pattern: agent emits, client parses + strips.
 */

export type ChatIntentKind = "writing" | "media" | "game" | "lab";

export type ChatIntent = {
  kind: ChatIntentKind;
  /** Payload text: draft to coach (writing), creation idea (media), topic hint (game/lab). */
  text?: string;
  /** Optional explicit game id (see /entertain?game= whitelist). */
  gameId?: string;
  /** Optional explicit lab id (ted-lab | bbc-lab | natgeo-lab | rsa-lab | writing-studio). */
  labId?: string;
};

const KINDS = new Set<string>([
  "writing",
  "media",
  "game",
  "lab",
]);

/**
 * Matches both forms the agent may use:
 * - block: ~~~intent\n{json}\n~~~
 * - inline (like the experiment fence): ~~~intent {json} ~~~
 */
const FENCE_RE =
  /~~~intent\s*(?:\{([\s\S]*?)\}\s*~~~|\n([\s\S]*?)\n~~~)/gi;

function parseIntentBody(json: string): ChatIntent | null {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const kind = String(o.kind || "");
    if (!KINDS.has(kind)) return null;
    const intent: ChatIntent = { kind: kind as ChatIntentKind };
    if (typeof o.text === "string" && o.text.trim()) {
      intent.text = o.text.trim().slice(0, 2000);
    }
    if (typeof o.gameId === "string" && o.gameId.trim()) {
      intent.gameId = o.gameId.trim().slice(0, 64);
    }
    if (typeof o.labId === "string" && o.labId.trim()) {
      intent.labId = o.labId.trim().slice(0, 64);
    }
    return intent;
  } catch {
    return null;
  }
}

/** Last valid intent fence in text wins. */
export function parseIntentFence(text: string): ChatIntent | null {
  if (!text) return null;
  let last: ChatIntent | null = null;
  const re = new RegExp(FENCE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const inline = m[1]?.trim();
    const block = m[2]?.trim();
    const body = inline ? `{${inline}}` : block;
    if (!body) continue;
    const parsed = parseIntentBody(body);
    if (parsed) last = parsed;
  }
  return last;
}

/** Remove all intent fences for display / TTS. */
export function stripIntentFence(text: string): string {
  if (!text) return text;
  return text
    .replace(FENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/**
 * Frontend fallback — keyword intent detection when no fence arrived.
 * Cheap heuristics only; never blocks a normal reply.
 */
const INTENT_KEYWORDS: Array<[ChatIntentKind, RegExp]> = [
  [
    "game",
    /\b(code|coding|program|programming|scratch|blockly|algorithm|loop|debug)\b|编程|写代码|写程序|打代码|积木编程|程序设计|学编程/,
  ],
  [
    "writing",
    /\b(essay|paragraph|draft|rewrite|polish|composition|poem|writing)\b|作文|作文题|帮我写|帮我改|写一段|写一篇|写个|润色|写作|改作文|日记|写作文/,
  ],
  [
    "media",
    /\b(song|music|image|picture|photo|video|animation|generate)\b|歌曲|做首歌|写首歌|生成|图片|做张图|画一幅|画一张|做个视频|做视频|生成视频/,
  ],
  [
    "lab",
    /\b(watch|read|documentary|ted talk|article|recommend)\b|科普|纪录片|想看|看视频|看个视频|看看|阅读|看篇文章|看个文章/,
  ],
  [
    "game",
    /\b(bored|game|play|relax|fun)\b|无聊|想玩|玩会|玩游戏|玩个|放松|休闲/,
  ],
];

export function detectIntentFromText(text: string): ChatIntent | null {
  if (!text || !text.trim()) return null;
  const trimmed = text.trim().slice(0, 600);
  for (const [kind, re] of INTENT_KEYWORDS) {
    if (re.test(trimmed)) return { kind };
  }
  return null;
}
