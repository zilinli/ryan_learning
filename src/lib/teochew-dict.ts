/**
 * Local Teochew (潮汕话 / 潮州话) dictionary dataset.
 *
 * Curated seed lexicon for learners, based on the common written form
 * used online (expert character + homophone hybrid) and Peng'im
 * romanization (1960 Chaoshan Pinyin scheme, tone numbers 1-8).
 *
 * Sources consulted:
 * - Hokkien Writing. "Teochew Lexicon — 潮州話詞庫" (github.com/hokkien-writing/teochew-character)
 * - p1an-lin-jung/teochew-g2p (pyPengIm) — Peng'im & oral conversion
 * - Wikivoyage Teochew phrasebook; Learning Teochew flashcard site
 *
 * Tone numbers follow Teochew's 8-tone system; where a token is commonly
 * heard with a changed tone in connected speech we keep the dictionary form.
 */

import type { DictEntry, DictResponse } from "./dict-types";

export type TeochewEntry = {
  /** Preferred written form (traditional-style characters common online) */
  traditional: string;
  /** Simplified Chinese characters */
  simplified: string;
  /** Peng'im romanization with tone number (e.g. "ho2") */
  pengim: string;
  /** Tone number (1-8) */
  tone: number;
  /** English gloss / definition */
  gloss: string;
  /** Mandarin pronunciation (pinyin) */
  mandarin?: string;
  /** Usage example in Teochew written form */
  example?: string;
  /** Frequency rank (1 = most common) */
  freq?: number;
};

/** Curated subset of common Teochew words & particles for learners. */
export const TEOCHEW_DICT: TeochewEntry[] = [
  // ── Pronouns & function words ──
  { traditional: "我", simplified: "我", pengim: "ua2", tone: 2, gloss: "I / me", mandarin: "wǒ", freq: 1 },
  { traditional: "汝", simplified: "汝", pengim: "le2", tone: 2, gloss: "you (also written 你)", mandarin: "nǐ", example: "汝好 (hello)", freq: 2 },
  { traditional: "伊", simplified: "伊", pengim: "i1", tone: 1, gloss: "he / him / she / her / it", freq: 3 },
  { traditional: "侬", simplified: "侬", pengim: "nang5", tone: 5, gloss: "person / people (also written 人)", example: "家己侬 (family / own people)", freq: 4 },
  { traditional: "个", simplified: "个", pengim: "gai7", tone: 7, gloss: "possessive particle (的) / generic classifier", example: "我个书 (my book)", freq: 5 },
  { traditional: "唔", simplified: "唔", pengim: "m6", tone: 6, gloss: "not (negation)", example: "唔是 (is not)", freq: 6 },
  { traditional: "勿", simplified: "勿", pengim: "mai3", tone: 3, gloss: "don't / don't want", example: "勿惊 (don't be afraid)", freq: 7 },
  { traditional: "无", simplified: "无", pengim: "bho5", tone: 5, gloss: "don't have / there isn't / no", example: "无错 (no mistake)", freq: 8 },
  { traditional: "有", simplified: "有", pengim: "u6", tone: 6, gloss: "to have / there is", mandarin: "yǒu", freq: 9 },
  { traditional: "是", simplified: "是", pengim: "si6", tone: 6, gloss: "yes / to be (is/am/are)", mandarin: "shì", freq: 10 },
  { traditional: "唔是", simplified: "唔是", pengim: "m6 si6", tone: 6, gloss: "no / is not", freq: 11 },
  { traditional: "佮", simplified: "佮", pengim: "gah4", tone: 4, gloss: "and / with (conjunction)", example: "我佮汝 (you and I)", freq: 12 },
  { traditional: "甲", simplified: "甲", pengim: "gah4", tone: 4, gloss: "to tell / with (tell someone)", example: "甲我知 (tell me)", freq: 13 },
  { traditional: "了", simplified: "了", pengim: "liao2", tone: 2, gloss: "completed action marker (了)", mandarin: "le", freq: 14 },
  { traditional: "过", simplified: "过", pengim: "gue3", tone: 3, gloss: "past / ever / have done", example: "来过 (has been here)", freq: 15 },
  // ── Question words ──
  { traditional: "乜个", simplified: "乜个", pengim: "mih4 gai7", tone: 4, gloss: "what", example: "这是乜个？(What is this?)", freq: 16 },
  { traditional: "怎呢", simplified: "怎呢", pengim: "zo2 ni5", tone: 2, gloss: "how / why (also 做呢)", example: "怎呢做？(How to do it?)", freq: 17 },
  { traditional: "底块", simplified: "底块", pengim: "di7 go3", tone: 7, gloss: "where", example: "去底块？(Where to?)", freq: 18 },
  { traditional: "只", simplified: "只", pengim: "zi2", tone: 2, gloss: "this", example: "只道题 (this question)", freq: 19 },
  { traditional: "许", simplified: "许", pengim: "he2", tone: 2, gloss: "that (also written 彼)", example: "许本书 (that book)", freq: 20 },
  { traditional: "几多", simplified: "几多", pengim: "gui2 zoi7", tone: 2, gloss: "how many / how much", example: "几多钱？(How much?)", freq: 21 },
  { traditional: "做呢", simplified: "做呢", pengim: "zo3 ni5", tone: 3, gloss: "how / why", freq: 22 },
  // ── Common verbs ──
  { traditional: "食", simplified: "食", pengim: "ziah8", tone: 8, gloss: "to eat / to drink (one verb for both)", mandarin: "shí", example: "食饭 (eat a meal)", freq: 23 },
  { traditional: "睇", simplified: "睇", pengim: "toin2", tone: 2, gloss: "to see / to look / to watch / to read", example: "睇书 (read a book)", freq: 24 },
  { traditional: "听", simplified: "听", pengim: "tia1", tone: 1, gloss: "to listen / to hear", mandarin: "tīng", freq: 25 },
  { traditional: "讲", simplified: "讲", pengim: "gong2", tone: 2, gloss: "to speak / to say", mandarin: "jiǎng", example: "讲潮州话 (speak Teochew)", freq: 26 },
  { traditional: "问", simplified: "问", pengim: "mung7", tone: 7, gloss: "to ask", mandarin: "wèn", freq: 27 },
  { traditional: "答", simplified: "答", pengim: "dab4", tone: 4, gloss: "to answer / to reply", mandarin: "dá", freq: 28 },
  { traditional: "知", simplified: "知", pengim: "zai1", tone: 1, gloss: "to know", mandarin: "zhī", example: "唔知 (don't know)", freq: 29 },
  { traditional: "想", simplified: "想", pengim: "sion2", tone: 2, gloss: "to think / to want", mandarin: "xiǎng", freq: 30 },
  { traditional: "爱", simplified: "爱", pengim: "ain3", tone: 3, gloss: "to want / to love", mandarin: "ài", example: "我爱食茶 (I like drinking tea)", freq: 31 },
  { traditional: "惊", simplified: "惊", pengim: "gia1", tone: 1, gloss: "to be afraid", mandarin: "jīng", example: "勿惊 (don't be scared)", freq: 32 },
  { traditional: "去", simplified: "去", pengim: "ke3", tone: 3, gloss: "to go", mandarin: "qù", freq: 33 },
  { traditional: "来", simplified: "来", pengim: "lai5", tone: 5, gloss: "to come", mandarin: "lái", example: "来只块 (come here)", freq: 34 },
  { traditional: "坐", simplified: "坐", pengim: "zo6", tone: 6, gloss: "to sit", mandarin: "zuò", freq: 35 },
  { traditional: "行", simplified: "行", pengim: "gia5", tone: 5, gloss: "to walk / to go (on foot)", mandarin: "xíng", example: "行路 (walk)", freq: 36 },
  { traditional: "走", simplified: "走", pengim: "zao2", tone: 2, gloss: "to run / to leave", mandarin: "zǒu", freq: 37 },
  { traditional: "读", simplified: "读", pengim: "tag8", tone: 8, gloss: "to read / to study", mandarin: "dú", example: "读书 (study)", freq: 38 },
  { traditional: "写", simplified: "写", pengim: "sia2", tone: 2, gloss: "to write", mandarin: "xiě", freq: 39 },
  { traditional: "学", simplified: "学", pengim: "oh8", tone: 8, gloss: "to learn / to study", mandarin: "xué", freq: 40 },
  { traditional: "教", simplified: "教", pengim: "ga3", tone: 3, gloss: "to teach", mandarin: "jiāo", freq: 41 },
  { traditional: "买", simplified: "买", pengim: "boi2", tone: 2, gloss: "to buy", mandarin: "mǎi", freq: 42 },
  { traditional: "卖", simplified: "卖", pengim: "boi7", tone: 7, gloss: "to sell", mandarin: "mài", freq: 43 },
  { traditional: "开", simplified: "开", pengim: "kui1", tone: 1, gloss: "to open", mandarin: "kāi", freq: 44 },
  { traditional: "关", simplified: "关", pengim: "guêng1", tone: 1, gloss: "to close / to shut", mandarin: "guān", freq: 45 },
  { traditional: "会", simplified: "会", pengim: "oi6", tone: 6, gloss: "can / know how to / will", mandarin: "huì", example: "我会写字 (I can write)", freq: 46 },
  // ── Common nouns ──
  { traditional: "水", simplified: "水", pengim: "zui2", tone: 2, gloss: "water", mandarin: "shuǐ", freq: 47 },
  { traditional: "饭", simplified: "饭", pengim: "bung7", tone: 7, gloss: "cooked rice / meal", mandarin: "fàn", freq: 48 },
  { traditional: "茶", simplified: "茶", pengim: "dê5", tone: 5, gloss: "tea", mandarin: "chá", example: "食茶 (drink tea)", freq: 49 },
  { traditional: "书", simplified: "书", pengim: "ze1", tone: 1, gloss: "book", mandarin: "shū", freq: 50 },
  { traditional: "字", simplified: "字", pengim: "ri7", tone: 7, gloss: "character / word / letter", mandarin: "zì", freq: 51 },
  { traditional: "名", simplified: "名", pengim: "mia5", tone: 5, gloss: "name", mandarin: "míng", freq: 52 },
  { traditional: "衫", simplified: "衫", pengim: "sa1", tone: 1, gloss: "clothes / shirt", mandarin: "shān", freq: 53 },
  { traditional: "厝", simplified: "厝", pengim: "cu3", tone: 3, gloss: "house / home", example: "返厝 (go home)", freq: 54 },
  { traditional: "学校", simplified: "学校", pengim: "hag8 hao6", tone: 8, gloss: "school", mandarin: "xuéxiào", freq: 55 },
  { traditional: "老师", simplified: "老师", pengim: "lao6 se1", tone: 6, gloss: "teacher", mandarin: "lǎoshī", freq: 56 },
  { traditional: "学生", simplified: "学生", pengim: "hag8 sêng1", tone: 8, gloss: "student", mandarin: "xuésheng", freq: 57 },
  { traditional: "同学", simplified: "同学", pengim: "dang5 hag8", tone: 5, gloss: "classmate", mandarin: "tóngxué", freq: 58 },
  { traditional: "朋友", simplified: "朋友", pengim: "pêng5 iu2", tone: 5, gloss: "friend", mandarin: "péngyou", freq: 59 },
  { traditional: "家己人", simplified: "家己人", pengim: "ga1 gi7 nang5", tone: 1, gloss: "family / one's own people", freq: 60 },
  { traditional: "阿公", simplified: "阿公", pengim: "a1 gong1", tone: 1, gloss: "grandfather (paternal)", freq: 61 },
  { traditional: "阿妈", simplified: "阿妈", pengim: "a1 ma2", tone: 1, gloss: "grandmother (paternal)", freq: 62 },
  { traditional: "仔", simplified: "仔", pengim: "gian2", tone: 2, gloss: "child / son / diminutive suffix", example: "滴囝 (a little)", freq: 63 },
  { traditional: "时阵", simplified: "时阵", pengim: "si5 zung5", tone: 5, gloss: "time / moment", example: "有时阵 (sometimes)", freq: 64 },
  { traditional: "今日", simplified: "今日", pengim: "gin1 rig8", tone: 1, gloss: "today", mandarin: "jīnrì", freq: 65 },
  { traditional: "明日", simplified: "明日", pengim: "mê5 rig8", tone: 5, gloss: "tomorrow", mandarin: "míngrì", freq: 66 },
  { traditional: "昨日", simplified: "昨日", pengim: "zo3 rig8", tone: 3, gloss: "yesterday", mandarin: "zuórì", freq: 67 },
  { traditional: "钱", simplified: "钱", pengim: "zin5", tone: 5, gloss: "money", mandarin: "qián", example: "几多钱？(How much?)", freq: 68 },
  { traditional: "话", simplified: "话", pengim: "uê7", tone: 7, gloss: "speech / language", mandarin: "huà", example: "潮州话 (Teochew)", freq: 69 },
  // ── Adjectives ──
  { traditional: "好", simplified: "好", pengim: "ho2", tone: 2, gloss: "good / very (degree)", mandarin: "hǎo", example: "好好 (very good)", freq: 70 },
  { traditional: "孬", simplified: "孬", pengim: "mo2", tone: 2, gloss: "bad / not good", freq: 71 },
  { traditional: "大", simplified: "大", pengim: "dua7", tone: 7, gloss: "big / large", mandarin: "dà", freq: 72 },
  { traditional: "细", simplified: "细", pengim: "soi3", tone: 3, gloss: "small / little / young", mandarin: "xì", freq: 73 },
  { traditional: "长", simplified: "长", pengim: "deng5", tone: 5, gloss: "long", mandarin: "cháng", freq: 74 },
  { traditional: "短", simplified: "短", pengim: "do2", tone: 2, gloss: "short", mandarin: "duǎn", freq: 75 },
  { traditional: "高", simplified: "高", pengim: "gao1", tone: 1, gloss: "tall / high", mandarin: "gāo", freq: 76 },
  { traditional: "快", simplified: "快", pengim: "kue3", tone: 3, gloss: "fast / quick", mandarin: "kuài", freq: 77 },
  { traditional: "慢", simplified: "慢", pengim: "mang7", tone: 7, gloss: "slow", mandarin: "màn", freq: 78 },
  { traditional: "真", simplified: "真", pengim: "zing1", tone: 1, gloss: "really / truly", mandarin: "zhēn", freq: 79 },
  { traditional: "新", simplified: "新", pengim: "sing1", tone: 1, gloss: "new", mandarin: "xīn", freq: 80 },
  { traditional: "旧", simplified: "旧", pengim: "gu7", tone: 7, gloss: "old (not new)", mandarin: "jiù", freq: 81 },
  { traditional: "甜", simplified: "甜", pengim: "diam5", tone: 5, gloss: "sweet", mandarin: "tián", freq: 82 },
  { traditional: "咸", simplified: "咸", pengim: "giam5", tone: 5, gloss: "salty", mandarin: "xián", freq: 83 },
  // ── Numbers ──
  { traditional: "一", simplified: "一", pengim: "zêg8", tone: 8, gloss: "one", mandarin: "yī", freq: 84 },
  { traditional: "二", simplified: "二", pengim: "no6", tone: 6, gloss: "two", mandarin: "èr", freq: 85 },
  { traditional: "三", simplified: "三", pengim: "san1", tone: 1, gloss: "three", mandarin: "sān", freq: 86 },
  { traditional: "四", simplified: "四", pengim: "si3", tone: 3, gloss: "four", mandarin: "sì", freq: 87 },
  { traditional: "五", simplified: "五", pengim: "ngou6", tone: 6, gloss: "five", mandarin: "wǔ", freq: 88 },
  { traditional: "六", simplified: "六", pengim: "lak8", tone: 8, gloss: "six", mandarin: "liù", freq: 89 },
  { traditional: "七", simplified: "七", pengim: "cig4", tone: 4, gloss: "seven", mandarin: "qī", freq: 90 },
  { traditional: "八", simplified: "八", pengim: "boih4", tone: 4, gloss: "eight", mandarin: "bā", freq: 91 },
  { traditional: "九", simplified: "九", pengim: "gao2", tone: 2, gloss: "nine", mandarin: "jiǔ", freq: 92 },
  { traditional: "十", simplified: "十", pengim: "zab8", tone: 8, gloss: "ten", mandarin: "shí", freq: 93 },
  // ── Nature & animals ──
  { traditional: "雨", simplified: "雨", pengim: "hou6", tone: 6, gloss: "rain", mandarin: "yǔ", freq: 94 },
  { traditional: "风", simplified: "风", pengim: "huang1", tone: 1, gloss: "wind", mandarin: "fēng", freq: 95 },
  { traditional: "天", simplified: "天", pengim: "tin1", tone: 1, gloss: "sky / day", mandarin: "tiān", freq: 96 },
  { traditional: "日", simplified: "日", pengim: "rig8", tone: 8, gloss: "sun / day", mandarin: "rì", freq: 97 },
  { traditional: "月", simplified: "月", pengim: "gueh8", tone: 8, gloss: "moon / month", mandarin: "yuè", freq: 98 },
  { traditional: "猫", simplified: "猫", pengim: "ngiao1", tone: 1, gloss: "cat", mandarin: "māo", freq: 99 },
  { traditional: "狗", simplified: "狗", pengim: "kao2", tone: 2, gloss: "dog", mandarin: "gǒu", freq: 100 },
  { traditional: "鸡", simplified: "鸡", pengim: "goi1", tone: 1, gloss: "chicken", mandarin: "jī", freq: 101 },
  // ── Everyday phrases ──
  { traditional: "汝好", simplified: "汝好", pengim: "le2 ho2", tone: 2, gloss: "hello / hi", freq: 102 },
  { traditional: "㩼谢", simplified: "㩼谢", pengim: "zoi7 sia7", tone: 7, gloss: "thank you", example: "㩼谢汝 (thank you)", freq: 103 },
  { traditional: "对唔住", simplified: "对唔住", pengim: "dui3 m6 zu6", tone: 3, gloss: "sorry / excuse me", freq: 104 },
  { traditional: "无相干", simplified: "无相干", pengim: "bho5 siang1 guan1", tone: 5, gloss: "no problem / it's OK / doesn't matter", freq: 105 },
  { traditional: "唔知", simplified: "唔知", pengim: "m6 zai1", tone: 6, gloss: "don't know", freq: 106 },
  { traditional: "唔好", simplified: "唔好", pengim: "m6 ho2", tone: 6, gloss: "not good / don't", freq: 107 },
  { traditional: "好食", simplified: "好食", pengim: "ho2 ziah8", tone: 2, gloss: "delicious / tasty", freq: 108 },
  { traditional: "食饭", simplified: "食饭", pengim: "ziah8 bung7", tone: 8, gloss: "to eat a meal / have rice", freq: 109 },
  { traditional: "食茶", simplified: "食茶", pengim: "ziah8 dê5", tone: 8, gloss: "to drink tea", freq: 110 },
  { traditional: "潮州话", simplified: "潮州话", pengim: "dio5 ziu1 uê7", tone: 5, gloss: "the Teochew language", freq: 111 },
  { traditional: "普通话", simplified: "普通话", pengim: "pu2 tong1 uê7", tone: 2, gloss: "Mandarin Chinese", mandarin: "pǔtōnghuà", freq: 112 },
  { traditional: "英语", simplified: "英语", pengim: "êng1 ghi2", tone: 1, gloss: "English (language)", mandarin: "yīngyǔ", freq: 113 },
  { traditional: "做得", simplified: "做得", pengim: "zo3 dig4", tone: 3, gloss: "OK / that works / can do", freq: 114 },
];

/** Build lookup map: normalized key → entries */
function buildTeochewIndex(): Map<string, TeochewEntry[]> {
  const map = new Map<string, TeochewEntry[]>();
  for (const e of TEOCHEW_DICT) {
    const keys = [e.traditional, e.simplified, e.pengim];
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

const TEOCHEW_INDEX: Map<string, TeochewEntry[]> = buildTeochewIndex();

function norm(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/** Exact lookup by character, Peng'im, or pinyin. */
export function lookupTeochew(query: string): TeochewEntry[] {
  const key = norm(query);
  if (!key) return [];
  return TEOCHEW_INDEX.get(key) ?? [];
}

/** Fuzzy search: prefix match on traditional, simplified, Peng'im, gloss, or pinyin. */
export function searchTeochew(query: string, limit = 20): TeochewEntry[] {
  const key = norm(query);
  if (!key || key.length < 1) return TEOCHEW_DICT.slice(0, limit);

  const scored: { entry: TeochewEntry; score: number }[] = [];
  const seen = new Set<string>();

  for (const entry of TEOCHEW_DICT) {
    const dedupKey = `${entry.traditional}:${entry.pengim}`;
    if (seen.has(dedupKey)) continue;
    let score = 0;
    const fields = [
      norm(entry.traditional),
      norm(entry.simplified),
      norm(entry.pengim),
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

function teochewEntryToDictEntry(e: TeochewEntry): DictEntry {
  return {
    headword: `${e.traditional} (${e.simplified})`,
    pronunciation: e.pengim,
    partOfSpeech: "",
    senses: [
      {
        definition: e.gloss,
        example: e.example,
        translations: e.mandarin ? [{ lang: "zh", text: e.mandarin }] : [],
      },
    ],
    source: "teochew-local",
  };
}

/** Full DictResponse from local Teochew data. */
export function teochewLookup(query: string): DictResponse {
  const entries = searchTeochew(query, 15);
  return {
    word: query,
    lang: "teo",
    entries: entries.map(teochewEntryToDictEntry),
  };
}
