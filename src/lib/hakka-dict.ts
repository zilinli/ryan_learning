/**
 * Local Hakka (客家话 / 客语) dictionary dataset.
 *
 * Curated seed lexicon for learners, based on the Taiwan Ministry of
 * Education "臺灣客家語書寫推薦用字" standard where available, plus the
 * common mainland online written forms (涯, 冇, 唔, 麼个) that appear in
 * actual Hakka writing. Romanization uses the Taiwan Hakka Pinyin (四县腔)
 * with tone marks, which is the most widely documented scheme.
 *
 * Sources consulted:
 * - 教育部臺灣客家語常用詞辭典 (hakkadict.moe.edu.tw)
 * - 臺灣客家語書寫推薦用字 (Ministry of Education, Taiwan)
 * - Hakka 800-word vocabulary list (客家委員會)
 *
 * Notes:
 * - 涯 (ngaiˇ, "I") is the common online form; the formal standard is 𠊎.
 * - 佢 (giˇ, "he/she") matches the Cantonese character.
 * - 个 (ge) is the possessive marker, same character as Cantonese/Teochew.
 */

import type { DictEntry, DictResponse } from "./dict-types";

export type HakkaEntry = {
  /** Preferred written form */
  traditional: string;
  /** Simplified Chinese characters */
  simplified: string;
  /** Hakka romanization with tone (四县腔, e.g. "ngaiˇ") */
  roman: string;
  /** English gloss / definition */
  gloss: string;
  /** Mandarin pronunciation (pinyin) */
  mandarin?: string;
  /** Usage example in Hakka written form */
  example?: string;
  /** Frequency rank (1 = most common) */
  freq?: number;
};

/** Curated subset of common Hakka words & particles for learners. */
export const HAKKA_DICT: HakkaEntry[] = [
  // ── Pronouns & function words ──
  { traditional: "涯", simplified: "涯", roman: "ngaiˇ", gloss: "I / me (common online form; formal: 𠊎)", example: "涯个书 (my book)", freq: 1 },
  { traditional: "𠊎", simplified: "𠊎", roman: "ngaiˇ", gloss: "I / me (formal recommended character)", freq: 2 },
  { traditional: "你", simplified: "你", roman: "nˇ", gloss: "you", mandarin: "nǐ", freq: 3 },
  { traditional: "佢", simplified: "佢", roman: "giˇ", gloss: "he / him / she / her / it", example: "佢係老师 (he is a teacher)", freq: 4 },
  { traditional: "个", simplified: "个", roman: "ge", gloss: "possessive particle (的)", example: "涯个名 (my name)", freq: 5 },
  { traditional: "毋", simplified: "毋", roman: "mˇ", gloss: "not (negation)", example: "毋係 (is not)", freq: 6 },
  { traditional: "唔", simplified: "唔", roman: "mˇ", gloss: "not (negation, common variant of 毋)", example: "唔知 (don't know)", freq: 7 },
  { traditional: "冇", simplified: "冇", roman: "moˇ", gloss: "don't have / there isn't", example: "冇错 (no mistake)", freq: 8 },
  { traditional: "有", simplified: "有", roman: "iuˊ", gloss: "to have / there is", mandarin: "yǒu", freq: 9 },
  { traditional: "係", simplified: "系", roman: "he", gloss: "to be (is/am/are)", example: "係呀 (yes it is)", freq: 10 },
  { traditional: "毋係", simplified: "毋系", roman: "mˇ he", gloss: "no / is not", freq: 11 },
  { traditional: "莫", simplified: "莫", roman: "mog", gloss: "don't (prohibition)", example: "莫惊 (don't be scared)", freq: 12 },
  { traditional: "摎", simplified: "摎", roman: "lauˊ", gloss: "and / with (conjunction)", example: "涯摎你 (you and I)", freq: 13 },
  { traditional: "恁", simplified: "恁", roman: "anˋ", gloss: "so / this (degree)", example: "恁好 (so good)", freq: 14 },
  { traditional: "當", simplified: "当", roman: "dongˊ", gloss: "very (degree)", example: "當好 (very good)", freq: 15 },
  // ── Question words ──
  { traditional: "麼个", simplified: "么个", roman: "maˋ ge", gloss: "what", example: "麼个东西？(What thing?)", freq: 16 },
  { traditional: "仰般", simplified: "仰般", roman: "ngiongˋ banˊ", gloss: "how (also 样般)", example: "仰般做？(How to do it?)", freq: 17 },
  { traditional: "哪位", simplified: "哪位", roman: "nai vi", gloss: "where", example: "去哪位？(Where to?)", freq: 18 },
  { traditional: "這", simplified: "这", roman: "iaˋ", gloss: "this", example: "這只题 (this question)", freq: 19 },
  { traditional: "該", simplified: "该", roman: "ge", gloss: "that", example: "該本书 (that book)", freq: 20 },
  { traditional: "幾多", simplified: "几多", roman: "giˋ doˊ", gloss: "how many / how much", example: "幾多錢？(How much?)", freq: 21 },
  { traditional: "做麼个", simplified: "做么个", roman: "zo maˋ ge", gloss: "why / what for", freq: 22 },
  // ── Common verbs ──
  { traditional: "食", simplified: "食", roman: "siid", gloss: "to eat / to drink (one verb for both)", mandarin: "shí", example: "食饭 (eat a meal)", freq: 23 },
  { traditional: "看", simplified: "看", roman: "kon", gloss: "to see / to look / to watch", mandarin: "kàn", freq: 24 },
  { traditional: "䀴", simplified: "䀴", roman: "ngiangˋ", gloss: "to look / to stare (Hakka-specific)", freq: 25 },
  { traditional: "聽", simplified: "听", roman: "tangˊ", gloss: "to listen / to hear", mandarin: "tīng", freq: 26 },
  { traditional: "講", simplified: "讲", roman: "gongˋ", gloss: "to speak / to say", mandarin: "jiǎng", example: "講客家话 (speak Hakka)", freq: 27 },
  { traditional: "問", simplified: "问", roman: "mun", gloss: "to ask", mandarin: "wèn", freq: 28 },
  { traditional: "知", simplified: "知", roman: "diˊ", gloss: "to know", mandarin: "zhī", example: "毋知 (don't know)", freq: 29 },
  { traditional: "想", simplified: "想", roman: "xiongˋ", gloss: "to think / to want", mandarin: "xiǎng", freq: 30 },
  { traditional: "愛", simplified: "爱", roman: "oi", gloss: "to want / to love", mandarin: "ài", example: "涯愛食茶 (I like drinking tea)", freq: 31 },
  { traditional: "驚", simplified: "惊", roman: "giangˊ", gloss: "to be afraid", example: "莫惊 (don't be scared)", freq: 32 },
  { traditional: "去", simplified: "去", roman: "hi", gloss: "to go", mandarin: "qù", freq: 33 },
  { traditional: "來", simplified: "来", roman: "loiˇ", gloss: "to come", mandarin: "lái", example: "來這 (come here)", freq: 34 },
  { traditional: "坐", simplified: "坐", roman: "coˊ", gloss: "to sit", mandarin: "zuò", freq: 35 },
  { traditional: "行", simplified: "行", roman: "hangˇ", gloss: "to walk / to go (on foot)", mandarin: "xíng", freq: 36 },
  { traditional: "走", simplified: "走", roman: "zeuˋ", gloss: "to run", mandarin: "zǒu", freq: 37 },
  { traditional: "讀", simplified: "读", roman: "tug", gloss: "to read / to study", mandarin: "dú", example: "讀書 (study)", freq: 38 },
  { traditional: "寫", simplified: "写", roman: "siaˋ", gloss: "to write", mandarin: "xiě", freq: 39 },
  { traditional: "學", simplified: "学", roman: "hog", gloss: "to learn / to study", mandarin: "xué", freq: 40 },
  { traditional: "教", simplified: "教", roman: "gau", gloss: "to teach", mandarin: "jiāo", freq: 41 },
  { traditional: "買", simplified: "买", roman: "maiˊ", gloss: "to buy", mandarin: "mǎi", freq: 42 },
  { traditional: "賣", simplified: "卖", roman: "mai", gloss: "to sell", mandarin: "mài", freq: 43 },
  { traditional: "開", simplified: "开", roman: "koiˊ", gloss: "to open", mandarin: "kāi", freq: 44 },
  { traditional: "關", simplified: "关", roman: "guanˊ", gloss: "to close / to shut", mandarin: "guān", freq: 45 },
  { traditional: "會", simplified: "会", roman: "voi", gloss: "can / know how to / will", mandarin: "huì", example: "涯會写字 (I can write)", freq: 46 },
  // ── Common nouns ──
  { traditional: "水", simplified: "水", roman: "suiˋ", gloss: "water", mandarin: "shuǐ", freq: 47 },
  { traditional: "飯", simplified: "饭", roman: "fan", gloss: "cooked rice / meal", mandarin: "fàn", freq: 48 },
  { traditional: "茶", simplified: "茶", roman: "caˇ", gloss: "tea", mandarin: "chá", example: "食茶 (drink tea)", freq: 49 },
  { traditional: "書", simplified: "书", roman: "suˊ", gloss: "book", mandarin: "shū", freq: 50 },
  { traditional: "字", simplified: "字", roman: "sii", gloss: "character / word / letter", mandarin: "zì", freq: 51 },
  { traditional: "名", simplified: "名", roman: "miangˇ", gloss: "name", mandarin: "míng", freq: 52 },
  { traditional: "衫", simplified: "衫", roman: "samˊ", gloss: "clothes / shirt", mandarin: "shān", freq: 53 },
  { traditional: "屋", simplified: "屋", roman: "vugˋ", gloss: "house", mandarin: "wū", freq: 54 },
  { traditional: "屋下", simplified: "屋下", roman: "vugˋ haˊ", gloss: "home (at home)", freq: 55 },
  { traditional: "學校", simplified: "学校", roman: "hog gau", gloss: "school", mandarin: "xuéxiào", freq: 56 },
  { traditional: "先生", simplified: "先生", roman: "xinˊ sangˊ", gloss: "teacher (Hakka usage) / Mr.", mandarin: "xiānsheng", freq: 57 },
  { traditional: "學生", simplified: "学生", roman: "hog sangˊ", gloss: "student", mandarin: "xuésheng", freq: 58 },
  { traditional: "朋友", simplified: "朋友", roman: "penˇ iuˊ", gloss: "friend", mandarin: "péngyou", freq: 59 },
  { traditional: "阿公", simplified: "阿公", roman: "aˊ gungˊ", gloss: "grandfather (paternal)", freq: 60 },
  { traditional: "阿婆", simplified: "阿婆", roman: "aˊ poˇ", gloss: "grandmother (paternal)", freq: 61 },
  { traditional: "細人仔", simplified: "细人仔", roman: "se nginˇ eˋ", gloss: "child / kids", freq: 62 },
  { traditional: "時節", simplified: "时节", roman: "siiˇ jiedˋ", gloss: "time / moment / season", example: "有時節 (sometimes)", freq: 63 },
  { traditional: "今晡日", simplified: "今晡日", roman: "gimˊ buˊ ngidˋ", gloss: "today", freq: 64 },
  { traditional: "天光日", simplified: "天光日", roman: "tienˊ gongˊ ngidˋ", gloss: "tomorrow", freq: 65 },
  { traditional: "昨日", simplified: "昨日", roman: "cog ngidˋ", gloss: "yesterday", mandarin: "zuórì", freq: 66 },
  { traditional: "錢", simplified: "钱", roman: "qienˇ", gloss: "money", mandarin: "qián", example: "幾多錢？(How much?)", freq: 67 },
  { traditional: "話", simplified: "话", roman: "fa", gloss: "speech / language", mandarin: "huà", example: "客家话 (Hakka)", freq: 68 },
  // ── Adjectives ──
  { traditional: "好", simplified: "好", roman: "hoˋ", gloss: "good / well", mandarin: "hǎo", example: "當好 (very good)", freq: 69 },
  { traditional: "壞", simplified: "坏", roman: "fai", gloss: "bad", mandarin: "huài", freq: 70 },
  { traditional: "大", simplified: "大", roman: "tai", gloss: "big / large", mandarin: "dà", freq: 71 },
  { traditional: "細", simplified: "细", roman: "se", gloss: "small / little / young", mandarin: "xì", freq: 72 },
  { traditional: "長", simplified: "长", roman: "congˇ", gloss: "long", mandarin: "cháng", freq: 73 },
  { traditional: "短", simplified: "短", roman: "donˋ", gloss: "short", mandarin: "duǎn", freq: 74 },
  { traditional: "高", simplified: "高", roman: "goˊ", gloss: "tall / high", mandarin: "gāo", freq: 75 },
  { traditional: "矮", simplified: "矮", roman: "aiˋ", gloss: "short (height)", mandarin: "ǎi", freq: 76 },
  { traditional: "遽", simplified: "遽", roman: "giagˋ", gloss: "fast / quick", freq: 77 },
  { traditional: "慢", simplified: "慢", roman: "man", gloss: "slow", mandarin: "màn", freq: 78 },
  { traditional: "真", simplified: "真", roman: "ziinˊ", gloss: "really / truly", mandarin: "zhēn", freq: 79 },
  { traditional: "新", simplified: "新", roman: "xinˊ", gloss: "new", mandarin: "xīn", freq: 80 },
  { traditional: "舊", simplified: "旧", roman: "kiu", gloss: "old (not new)", mandarin: "jiù", freq: 81 },
  { traditional: "甜", simplified: "甜", roman: "tiamˇ", gloss: "sweet", mandarin: "tián", freq: 82 },
  { traditional: "鹹", simplified: "咸", roman: "hamˇ", gloss: "salty", mandarin: "xián", freq: 83 },
  // ── Numbers ──
  { traditional: "一", simplified: "一", roman: "idˋ", gloss: "one", mandarin: "yī", freq: 84 },
  { traditional: "二", simplified: "二", roman: "ngi", gloss: "two", mandarin: "èr", freq: 85 },
  { traditional: "三", simplified: "三", roman: "samˊ", gloss: "three", mandarin: "sān", freq: 86 },
  { traditional: "四", simplified: "四", roman: "xi", gloss: "four", mandarin: "sì", freq: 87 },
  { traditional: "五", simplified: "五", roman: "ngˋ", gloss: "five", mandarin: "wǔ", freq: 88 },
  { traditional: "六", simplified: "六", roman: "liugˋ", gloss: "six", mandarin: "liù", freq: 89 },
  { traditional: "七", simplified: "七", roman: "qidˋ", gloss: "seven", mandarin: "qī", freq: 90 },
  { traditional: "八", simplified: "八", roman: "badˋ", gloss: "eight", mandarin: "bā", freq: 91 },
  { traditional: "九", simplified: "九", roman: "giuˋ", gloss: "nine", mandarin: "jiǔ", freq: 92 },
  { traditional: "十", simplified: "十", roman: "siib", gloss: "ten", mandarin: "shí", freq: 93 },
  // ── Nature & animals ──
  { traditional: "雨", simplified: "雨", roman: "iˋ", gloss: "rain", mandarin: "yǔ", freq: 94 },
  { traditional: "風", simplified: "风", roman: "fungˊ", gloss: "wind", mandarin: "fēng", freq: 95 },
  { traditional: "天", simplified: "天", roman: "tienˊ", gloss: "sky / day", mandarin: "tiān", freq: 96 },
  { traditional: "日", simplified: "日", roman: "ngidˋ", gloss: "sun / day", mandarin: "rì", freq: 97 },
  { traditional: "月", simplified: "月", roman: "ngiedˋ", gloss: "moon / month", mandarin: "yuè", freq: 98 },
  { traditional: "貓", simplified: "猫", roman: "meudˋ", gloss: "cat", mandarin: "māo", freq: 99 },
  { traditional: "狗", simplified: "狗", roman: "gieuˋ", gloss: "dog", mandarin: "gǒu", freq: 100 },
  { traditional: "雞", simplified: "鸡", roman: "gieˊ", gloss: "chicken", mandarin: "jī", freq: 101 },
  // ── Everyday phrases ──
  { traditional: "你好", simplified: "你好", roman: "nˇ hoˋ", gloss: "hello / hi", freq: 102 },
  { traditional: "多謝", simplified: "多谢", roman: "doˊ qia", gloss: "thank you", freq: 103 },
  { traditional: "承蒙你", simplified: "承蒙你", roman: "siinˇ mung nˇ", gloss: "thank you (formal)", freq: 104 },
  { traditional: "對毋住", simplified: "对毋住", roman: "dui mˇ cu", gloss: "sorry / excuse me", freq: 105 },
  { traditional: "無相干", simplified: "无相干", roman: "moˇ xiongˊ gonˊ", gloss: "no problem / it's OK", freq: 106 },
  { traditional: "毋知", simplified: "毋知", roman: "mˇ diˊ", gloss: "don't know", freq: 107 },
  { traditional: "毋好", simplified: "毋好", roman: "mˇ hoˋ", gloss: "not good / don't", freq: 108 },
  { traditional: "好食", simplified: "好食", roman: "hoˋ siid", gloss: "delicious / tasty", freq: 109 },
  { traditional: "食飯", simplified: "食饭", roman: "siid fan", gloss: "to eat a meal", freq: 110 },
  { traditional: "食茶", simplified: "食茶", roman: "siid caˇ", gloss: "to drink tea", freq: 111 },
  { traditional: "客家話", simplified: "客家话", roman: "hagˋ gaˊ fa", gloss: "the Hakka language", freq: 112 },
  { traditional: "做得", simplified: "做得", roman: "zo dedˋ", gloss: "OK / that works / can do", freq: 113 },
];

/** Build lookup map: normalized key → entries */
function buildHakkaIndex(): Map<string, HakkaEntry[]> {
  const map = new Map<string, HakkaEntry[]>();
  for (const e of HAKKA_DICT) {
    const keys = [e.traditional, e.simplified, e.roman];
    if (e.mandarin) keys.push(e.mandarin);
    for (const key of keys) {
      const k = norm(key);
      if (!k) continue;
      const arr = map.get(k) || [];
      arr.push(e);
      map.set(k, arr);
    }
  }
  return map;
}

const HAKKA_INDEX: Map<string, HakkaEntry[]> = buildHakkaIndex();

function norm(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    // Hakka romanization tone marks are modifier letters (ˊ ˋ ˇ ¯),
    // not combining marks — strip them for accent-insensitive matching.
    .replace(/[\u02C7\u02CA\u02CB\u02C9]/g, "")
    .replace(/\s+/g, "");
}

/** Exact lookup by character, romanization, or pinyin. */
export function lookupHakka(query: string): HakkaEntry[] {
  const key = norm(query);
  if (!key) return [];
  return HAKKA_INDEX.get(key) ?? [];
}

/** Fuzzy search: prefix match on traditional, simplified, roman, gloss, or pinyin. */
export function searchHakka(query: string, limit = 20): HakkaEntry[] {
  const key = norm(query);
  if (!key || key.length < 1) return HAKKA_DICT.slice(0, limit);

  const scored: { entry: HakkaEntry; score: number }[] = [];
  const seen = new Set<string>();

  for (const entry of HAKKA_DICT) {
    const dedupKey = `${entry.traditional}:${entry.roman}`;
    if (seen.has(dedupKey)) continue;
    let score = 0;
    const fields = [
      norm(entry.traditional),
      norm(entry.simplified),
      norm(entry.roman),
      norm(entry.gloss),
      ...(entry.mandarin ? [norm(entry.mandarin)] : []),
    ];
    for (const f of fields) {
      if (f === key) { score = 3; break; }
      if (f.startsWith(key)) { score = Math.max(score, 2); }
      else if (f.includes(key)) { score = Math.max(score, 1); }
    }
    if (score > 0) {
      seen.add(dedupKey);
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.entry.freq ?? 999) - (b.entry.freq ?? 999);
  });
  return scored.slice(0, limit).map((s) => s.entry);
}

function hakkaEntryToDictEntry(e: HakkaEntry): DictEntry {
  return {
    headword: `${e.traditional} (${e.simplified})`,
    pronunciation: e.roman,
    partOfSpeech: "",
    senses: [
      {
        definition: e.gloss,
        example: e.example,
        translations: e.mandarin ? [{ lang: "zh", text: e.mandarin }] : [],
      },
    ],
    source: "hakka-local",
  };
}

/** Full DictResponse from local Hakka data. */
export function hakkaLookup(query: string): DictResponse {
  const entries = searchHakka(query, 15);
  return {
    word: query,
    lang: "hak",
    entries: entries.map(hakkaEntryToDictEntry),
  };
}
