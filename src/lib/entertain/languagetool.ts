/**
 * LanguageTool-compatible grammar check for Writing Studio.
 * Remote URL via LANGUAGETOOL_API_URL; always has a local ESL heuristic fallback.
 */

export type GrammarCategory =
  | "grammar"
  | "spelling"
  | "style"
  | "punctuation"
  | "typos";

export type GrammarMatch = {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
  ruleId: string;
  category: GrammarCategory;
};

export type GrammarCheckSource = "languagetool" | "local";

export type GrammarCheckResult = {
  matches: GrammarMatch[];
  source: GrammarCheckSource;
};

const MAX_TEXT = 20_000;
const MAX_MATCHES = 40;

function mapCategory(raw: string): GrammarCategory {
  const c = raw.toLowerCase();
  if (c.includes("spell") || c === "typos") return "spelling";
  if (c.includes("punct")) return "punctuation";
  if (c.includes("style") || c.includes("redundanc") || c.includes("clarity"))
    return "style";
  if (c.includes("typo")) return "typos";
  return "grammar";
}

/** Parse LanguageTool /v2/check JSON into GrammarMatch[]. */
export function parseLanguageToolResponse(raw: unknown): GrammarMatch[] {
  if (!raw || typeof raw !== "object") return [];
  const matchesIn = (raw as { matches?: unknown }).matches;
  if (!Array.isArray(matchesIn)) return [];
  const out: GrammarMatch[] = [];
  for (const item of matchesIn) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const offset = Number(m.offset);
    const length = Number(m.length);
    if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0)
      continue;
    const message = String(
      (m.message as string) ||
        (m.shortMessage as string) ||
        "Suggested change",
    ).trim();
    const replacements = Array.isArray(m.replacements)
      ? (m.replacements as unknown[])
          .map((r) =>
            r && typeof r === "object"
              ? String((r as { value?: string }).value || "").trim()
              : String(r || "").trim(),
          )
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const rule =
      m.rule && typeof m.rule === "object"
        ? (m.rule as Record<string, unknown>)
        : {};
    const ruleId = String(rule.id || "LT_UNKNOWN").slice(0, 80);
    const catObj =
      rule.category && typeof rule.category === "object"
        ? (rule.category as Record<string, unknown>)
        : {};
    const category = mapCategory(
      String(catObj.id || catObj.name || rule.issueType || "grammar"),
    );
    out.push({
      offset: Math.max(0, Math.floor(offset)),
      length: Math.max(1, Math.floor(length)),
      message: message.slice(0, 280),
      replacements,
      ruleId,
      category,
    });
    if (out.length >= MAX_MATCHES) break;
  }
  return out;
}

function pushMatch(
  out: GrammarMatch[],
  draft: string,
  start: number,
  end: number,
  message: string,
  replacements: string[],
  ruleId: string,
  category: GrammarCategory,
) {
  if (start < 0 || end <= start || end > draft.length) return;
  if (out.length >= MAX_MATCHES) return;
  // skip overlapping
  if (out.some((m) => !(end <= m.offset || start >= m.offset + m.length)))
    return;
  out.push({
    offset: start,
    length: end - start,
    message,
    replacements: replacements.slice(0, 5),
    ruleId,
    category,
  });
}

/** Offline ESL / mechanics heuristics when LanguageTool is unavailable. */
export function localHeuristicGrammarCheck(draft: string): GrammarMatch[] {
  const text = draft.slice(0, MAX_TEXT);
  if (!text.trim()) return [];
  const out: GrammarMatch[] = [];

  // repeated consecutive words: "the the"
  const repeated = /\b([A-Za-z']{2,})\s+\1\b/gi;
  let m: RegExpExecArray | null;
  while ((m = repeated.exec(text))) {
    const word = m[1]!;
    pushMatch(
      out,
      text,
      m.index,
      m.index + m[0].length,
      `Repeated word “${word}”. Keep one.`,
      [word],
      "LOCAL_REPEATED_WORD",
      "style",
    );
  }

  // a/an before vowel/consonant sound (simple orthographic)
  const aan = /\b(a|an)\s+([A-Za-z']+)/gi;
  while ((m = aan.exec(text))) {
    const art = m[1]!.toLowerCase();
    const noun = m[2]!;
    const startsVowel = /^[aeiou]/i.test(noun);
    if (art === "a" && startsVowel) {
      pushMatch(
        out,
        text,
        m.index,
        m.index + m[1]!.length,
        `Use “an” before a vowel sound (“an ${noun}”).`,
        ["an"],
        "LOCAL_A_AN",
        "grammar",
      );
    } else if (art === "an" && !startsVowel) {
      pushMatch(
        out,
        text,
        m.index,
        m.index + m[1]!.length,
        `Use “a” before a consonant sound (“a ${noun}”).`,
        ["a"],
        "LOCAL_A_AN",
        "grammar",
      );
    }
  }

  // their/there/they're common mix (very light)
  const thereAre = /\btheir\s+are\b/gi;
  while ((m = thereAre.exec(text))) {
    pushMatch(
      out,
      text,
      m.index,
      m.index + 5,
      "Did you mean “there are”?",
      ["there"],
      "LOCAL_THEIR_THERE",
      "grammar",
    );
  }

  // lowercase start after .!? + space
  const afterEnd = /([.!?])\s+([a-z])/g;
  while ((m = afterEnd.exec(text))) {
    const letterIdx = m.index + m[0].length - 1;
    const upper = m[2]!.toUpperCase();
    pushMatch(
      out,
      text,
      letterIdx,
      letterIdx + 1,
      "Capitalize the first letter of a new sentence.",
      [upper],
      "LOCAL_SENTENCE_CAP",
      "punctuation",
    );
  }

  // double spaces
  const spaces = / {2,}/g;
  while ((m = spaces.exec(text))) {
    pushMatch(
      out,
      text,
      m.index,
      m.index + m[0].length,
      "Extra spaces — use a single space.",
      [" "],
      "LOCAL_DOUBLE_SPACE",
      "punctuation",
    );
  }

  // i as pronoun (standalone)
  const loneI = /(^|[.!?\n]\s+)i\b/g;
  while ((m = loneI.exec(text))) {
    const idx = m.index + m[1]!.length;
    pushMatch(
      out,
      text,
      idx,
      idx + 1,
      "Capitalize “I” when it means yourself.",
      ["I"],
      "LOCAL_CAP_I",
      "grammar",
    );
  }
  // also mid-sentence " i "
  const midI = /\s i\s/g;
  while ((m = midI.exec(text))) {
    const idx = m.index + 1;
    pushMatch(
      out,
      text,
      idx,
      idx + 1,
      "Capitalize “I” when it means yourself.",
      ["I"],
      "LOCAL_CAP_I",
      "grammar",
    );
  }

  return out;
}

export function languageToolEndpoint(): string | null {
  const url = process.env.LANGUAGETOOL_API_URL?.trim();
  return url || null;
}

/** Call remote LanguageTool-compatible /v2/check (form body). */
export async function checkGrammarRemote(
  text: string,
  opts?: { language?: string; signal?: AbortSignal },
): Promise<GrammarMatch[] | null> {
  const endpoint = languageToolEndpoint();
  if (!endpoint) return null;
  const body = new URLSearchParams();
  body.set("text", text.slice(0, MAX_TEXT));
  body.set("language", opts?.language || "en-US");
  const key = process.env.LANGUAGETOOL_API_KEY?.trim();
  if (key) body.set("apiKey", key);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: opts?.signal,
  });
  if (!res.ok) {
    throw new Error(`LanguageTool HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return parseLanguageToolResponse(json);
}

/** Prefer remote LT; always fall back to local heuristics. */
export async function checkGrammar(
  text: string,
  opts?: { language?: string; signal?: AbortSignal },
): Promise<GrammarCheckResult> {
  const trimmed = text.slice(0, MAX_TEXT);
  if (!trimmed.trim()) return { matches: [], source: "local" };

  if (languageToolEndpoint()) {
    try {
      const remote = await checkGrammarRemote(trimmed, opts);
      if (remote) return { matches: remote, source: "languagetool" };
    } catch {
      /* fall through */
    }
  }
  return { matches: localHeuristicGrammarCheck(trimmed), source: "local" };
}

/** Apply first replacement at match offset/length. */
export function applyGrammarReplacement(
  draft: string,
  match: Pick<GrammarMatch, "offset" | "length">,
  replacement: string,
): string {
  const start = Math.max(0, match.offset);
  const end = Math.min(draft.length, start + Math.max(0, match.length));
  if (start > draft.length || end < start) return draft;
  return draft.slice(0, start) + replacement + draft.slice(end);
}
