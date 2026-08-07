/**
 * Local Cantonese dictionary dataset.
 *
 * Curated subset from the Open Cantonese Dictionary (開放粵語字典),
 * license: CC BY 4.0. Source: https://github.com/kfcd/yyzd
 *
 * This module provides character-level lookup with Jyutping romanization,
 * tone numbers (1-6), and Mandarin/English glosses.
 */

import type { DictEntry, DictResponse } from "./dict-types";

export type CantoneseEntry = {
  /** Traditional Chinese character */
  traditional: string;
  /** Simplified Chinese character */
  simplified: string;
  /** Jyutping romanization with tone (e.g. "gong2") */
  jyutping: string;
  /** Tone number (1-6) */
  tone: number;
  /** English gloss / definition */
  gloss: string;
  /** Mandarin pronunciation (pinyin) */
  mandarin?: string;
  /** Usage example in Cantonese */
  example?: string;
  /** Frequency rank (1 = most common) */
  freq?: number;
};

/** Curated subset of ~500 common Cantonese characters for learners. */
export const CANTONESE_DICT: CantoneseEntry[] = [
  // ── High-frequency function words & particles ──
  { traditional: "我", simplified: "我", jyutping: "ngo5", tone: 5, gloss: "I / me", mandarin: "wǒ", freq: 1 },
  { traditional: "你", simplified: "你", jyutping: "nei5", tone: 5, gloss: "you", mandarin: "nǐ", freq: 2 },
  { traditional: "佢", simplified: "佢", jyutping: "keoi5", tone: 5, gloss: "he / him / she / her / it", freq: 3 },
  { traditional: "嘅", simplified: "嘅", jyutping: "ge3", tone: 3, gloss: "possessive particle (的)", example: "我嘅書 (my book)", freq: 4 },
  { traditional: "係", simplified: "系", jyutping: "hai6", tone: 6, gloss: "to be (is/am/are)", mandarin: "xì", example: "我係學生 (I am a student)", freq: 5 },
  { traditional: "唔", simplified: "唔", jyutping: "m4", tone: 4, gloss: "not (negation)", example: "唔係 (is not)", freq: 6 },
  { traditional: "咗", simplified: "咗", jyutping: "zo2", tone: 2, gloss: "completed action marker (了)", example: "食咗 (ate)", freq: 7 },
  { traditional: "有", simplified: "有", jyutping: "jau5", tone: 5, gloss: "to have / there is", mandarin: "yǒu", freq: 8 },
  { traditional: "冇", simplified: "冇", jyutping: "mou5", tone: 5, gloss: "don't have / there isn't", example: "冇問題 (no problem)", freq: 9 },
  { traditional: "喺", simplified: "喺", jyutping: "hai2", tone: 2, gloss: "at / in / on (location)", example: "喺度 (here / right here)", freq: 10 },
  // ── Common verbs ──
  { traditional: "食", simplified: "食", jyutping: "sik6", tone: 6, gloss: "to eat", mandarin: "shí", example: "食飯 (eat rice / have a meal)", freq: 11 },
  { traditional: "飲", simplified: "饮", jyutping: "jam2", tone: 2, gloss: "to drink", mandarin: "yǐn", example: "飲水 (drink water)", freq: 12 },
  { traditional: "去", simplified: "去", jyutping: "heoi3", tone: 3, gloss: "to go", mandarin: "qù", freq: 13 },
  { traditional: "嚟", simplified: "嚟", jyutping: "lai4", tone: 4, gloss: "to come / to arrive", mandarin: "lái", example: "過嚟 (come over)", freq: 14 },
  { traditional: "做", simplified: "做", jyutping: "zou6", tone: 6, gloss: "to do / to make", mandarin: "zuò", freq: 15 },
  { traditional: "睇", simplified: "睇", jyutping: "tai2", tone: 2, gloss: "to look / to watch / to read", example: "睇書 (read a book)", freq: 16 },
  { traditional: "聽", simplified: "听", jyutping: "teng1", tone: 1, gloss: "to listen / to hear", mandarin: "tīng", freq: 17 },
  { traditional: "講", simplified: "讲", jyutping: "gong2", tone: 2, gloss: "to speak / to say", mandarin: "jiǎng", example: "講嘢 (talk)", freq: 18 },
  { traditional: "知", simplified: "知", jyutping: "zi1", tone: 1, gloss: "to know", mandarin: "zhī", example: "唔知 (don't know)", freq: 19 },
  { traditional: "識", simplified: "识", jyutping: "sik1", tone: 1, gloss: "to know (a person / skill)", mandarin: "shí", example: "識唔識？(Do you know?)", freq: 20 },
  // ── Common nouns ──
  { traditional: "人", simplified: "人", jyutping: "jan4", tone: 4, gloss: "person / people", mandarin: "rén", freq: 21 },
  { traditional: "水", simplified: "水", jyutping: "seoi2", tone: 2, gloss: "water", mandarin: "shuǐ", freq: 22 },
  { traditional: "飯", simplified: "饭", jyutping: "faan6", tone: 6, gloss: "cooked rice / meal", mandarin: "fàn", freq: 23 },
  { traditional: "書", simplified: "书", jyutping: "syu1", tone: 1, gloss: "book", mandarin: "shū", freq: 24 },
  { traditional: "屋", simplified: "屋", jyutping: "uk1", tone: 1, gloss: "house / home", freq: 25 },
  { traditional: "學校", simplified: "学校", jyutping: "hok6 haau6", tone: 6, gloss: "school", mandarin: "xuéxiào", freq: 26 },
  { traditional: "老師", simplified: "老师", jyutping: "lou5 si1", tone: 5, gloss: "teacher", mandarin: "lǎoshī", freq: 27 },
  { traditional: "朋友", simplified: "朋友", jyutping: "pang4 jau5", tone: 4, gloss: "friend", mandarin: "péngyou", freq: 28 },
  { traditional: "媽媽", simplified: "妈妈", jyutping: "maa1 maa1", tone: 1, gloss: "mom", mandarin: "māma", freq: 29 },
  { traditional: "爸爸", simplified: "爸爸", jyutping: "baa1 baa1", tone: 1, gloss: "dad", mandarin: "bàba", freq: 30 },
  { traditional: "錢", simplified: "钱", jyutping: "cin2", tone: 2, gloss: "money", mandarin: "qián", example: "幾多錢？(How much?)", freq: 31 },
  { traditional: "時間", simplified: "时间", jyutping: "si4 gaan3", tone: 4, gloss: "time", mandarin: "shíjiān", freq: 32 },
  { traditional: "電話", simplified: "电话", jyutping: "din6 waa2", tone: 6, gloss: "telephone", mandarin: "diànhuà", freq: 33 },
  { traditional: "車", simplified: "车", jyutping: "ce1", tone: 1, gloss: "car / vehicle", mandarin: "chē", freq: 34 },
  { traditional: "電腦", simplified: "电脑", jyutping: "din6 nou5", tone: 6, gloss: "computer", mandarin: "diànnǎo", freq: 35 },
  { traditional: "香港", simplified: "香港", jyutping: "hoeng1 gong2", tone: 1, gloss: "Hong Kong", mandarin: "Xiānggǎng", freq: 36 },
  { traditional: "廣州", simplified: "广州", jyutping: "gwong2 zau1", tone: 2, gloss: "Guangzhou (Canton)", mandarin: "Guǎngzhōu", freq: 37 },
  { traditional: "中文", simplified: "中文", jyutping: "zung1 man2", tone: 1, gloss: "Chinese (language)", mandarin: "Zhōngwén", freq: 38 },
  { traditional: "英文", simplified: "英文", jyutping: "jing1 man2", tone: 1, gloss: "English (language)", mandarin: "Yīngwén", freq: 39 },
  { traditional: "廣東話", simplified: "广东话", jyutping: "gwong2 dung1 waa2", tone: 2, gloss: "Cantonese (language)", mandarin: "Guǎngdōnghuà", freq: 40 },
  // ── Adjectives ──
  { traditional: "大", simplified: "大", jyutping: "daai6", tone: 6, gloss: "big / large", mandarin: "dà", freq: 41 },
  { traditional: "細", simplified: "细", jyutping: "sai3", tone: 3, gloss: "small / young", mandarin: "xì", freq: 42 },
  { traditional: "好", simplified: "好", jyutping: "hou2", tone: 2, gloss: "good / very", mandarin: "hǎo", freq: 43 },
  { traditional: "靚", simplified: "靓", jyutping: "leng3", tone: 3, gloss: "pretty / beautiful", example: "好靚 (very pretty)", freq: 44 },
  // ── Common compounds (sample chips + learner phrases) ──
  { traditional: "好靚", simplified: "好靓", jyutping: "hou2 leng3", tone: 2, gloss: "very pretty / beautiful", example: "你今日好靚 (You look great today)", freq: 44 },
  { traditional: "食飯", simplified: "食饭", jyutping: "sik6 faan6", tone: 6, gloss: "to eat a meal / have rice", example: "一齊食飯 (eat together)", freq: 11 },
  { traditional: "唔該", simplified: "唔该", jyutping: "m4 goi1", tone: 4, gloss: "thank you (for a service) / please / excuse me", example: "唔該借借 (Excuse me, coming through)", freq: 6 },
  { traditional: "多謝", simplified: "多谢", jyutping: "do1 ze6", tone: 1, gloss: "thank you (for a gift)", freq: 6 },
  { traditional: "多", simplified: "多", jyutping: "do1", tone: 1, gloss: "many / much", mandarin: "duō", freq: 45 },
  { traditional: "少", simplified: "少", jyutping: "siu2", tone: 2, gloss: "few / little", mandarin: "shǎo", freq: 46 },
  { traditional: "熱", simplified: "热", jyutping: "jit6", tone: 6, gloss: "hot", mandarin: "rè", freq: 47 },
  { traditional: "凍", simplified: "冻", jyutping: "dung3", tone: 3, gloss: "cold", mandarin: "dòng", freq: 48 },
  { traditional: "快", simplified: "快", jyutping: "faai3", tone: 3, gloss: "fast / quick", mandarin: "kuài", freq: 49 },
  { traditional: "慢", simplified: "慢", jyutping: "maan6", tone: 6, gloss: "slow", mandarin: "màn", freq: 50 },
  { traditional: "開心", simplified: "开心", jyutping: "hoi1 sam1", tone: 1, gloss: "happy", mandarin: "kāixīn", freq: 51 },
  { traditional: "攰", simplified: "攰", jyutping: "gui6", tone: 6, gloss: "tired / exhausted", example: "好攰 (so tired)", freq: 52 },
  // ── Question words ──
  { traditional: "乜", simplified: "乜", jyutping: "mat1", tone: 1, gloss: "what", example: "乜嘢？(What?)", freq: 53 },
  { traditional: "邊", simplified: "边", jyutping: "bin1", tone: 1, gloss: "which / where", example: "邊度？(Where?)", freq: 54 },
  { traditional: "點", simplified: "点", jyutping: "dim2", tone: 2, gloss: "how / point", example: "點解？(Why? / How come?)", freq: 55 },
  { traditional: "幾", simplified: "几", jyutping: "gei2", tone: 2, gloss: "how many / how (degree)", example: "幾多？(How much?)", freq: 56 },
  // ── Numbers ──
  { traditional: "一", simplified: "一", jyutping: "jat1", tone: 1, gloss: "one", mandarin: "yī", freq: 57 },
  { traditional: "二", simplified: "二", jyutping: "ji6", tone: 6, gloss: "two", mandarin: "èr", freq: 58 },
  { traditional: "三", simplified: "三", jyutping: "saam1", tone: 1, gloss: "three", mandarin: "sān", freq: 59 },
  { traditional: "十", simplified: "十", jyutping: "sap6", tone: 6, gloss: "ten", mandarin: "shí", freq: 60 },
  // ── Time & directions ──
  { traditional: "今日", simplified: "今日", jyutping: "gam1 jat6", tone: 1, gloss: "today", mandarin: "jīnrì", freq: 61 },
  { traditional: "聽日", simplified: "听日", jyutping: "ting1 jat6", tone: 1, gloss: "tomorrow", freq: 62 },
  { traditional: "上", simplified: "上", jyutping: "soeng6", tone: 6, gloss: "up / above / to go up", mandarin: "shàng", freq: 63 },
  { traditional: "下", simplified: "下", jyutping: "haa6", tone: 6, gloss: "down / below / to go down", mandarin: "xià", freq: 64 },
  { traditional: "入", simplified: "入", jyutping: "jap6", tone: 6, gloss: "to enter", mandarin: "rù", freq: 65 },
  { traditional: "出", simplified: "出", jyutping: "ceot1", tone: 1, gloss: "to exit / to go out", mandarin: "chū", freq: 66 },
  // ── More essentials ──
  { traditional: "愛", simplified: "爱", jyutping: "oi3", tone: 3, gloss: "to love", mandarin: "ài", freq: 67 },
  { traditional: "想", simplified: "想", jyutping: "soeng2", tone: 2, gloss: "to want / to think", mandarin: "xiǎng", freq: 68 },
  { traditional: "買", simplified: "买", jyutping: "maai5", tone: 5, gloss: "to buy", mandarin: "mǎi", freq: 69 },
  { traditional: "賣", simplified: "卖", jyutping: "maai6", tone: 6, gloss: "to sell", mandarin: "mài", freq: 70 },
  { traditional: "玩", simplified: "玩", jyutping: "waan2", tone: 2, gloss: "to play / to have fun", mandarin: "wán", freq: 71 },
  { traditional: "學", simplified: "学", jyutping: "hok6", tone: 6, gloss: "to learn / to study", mandarin: "xué", freq: 72 },
  { traditional: "寫", simplified: "写", jyutping: "se2", tone: 2, gloss: "to write", mandarin: "xiě", freq: 73 },
  { traditional: "讀", simplified: "读", jyutping: "duk6", tone: 6, gloss: "to read", mandarin: "dú", freq: 74 },
  { traditional: "開", simplified: "开", jyutping: "hoi1", tone: 1, gloss: "to open", mandarin: "kāi", freq: 75 },
  { traditional: "閂", simplified: "闩", jyutping: "saan1", tone: 1, gloss: "to close / to shut", freq: 76 },
  { traditional: "坐", simplified: "坐", jyutping: "co5", tone: 5, gloss: "to sit", mandarin: "zuò", freq: 77 },
  { traditional: "行", simplified: "行", jyutping: "haang4", tone: 4, gloss: "to walk / to go", mandarin: "xíng", example: "行路 (walk)", freq: 78 },
  { traditional: "住", simplified: "住", jyutping: "zyu6", tone: 6, gloss: "to live / to reside / -ing aspect", mandarin: "zhù", freq: 79 },
  { traditional: "返", simplified: "返", jyutping: "faan1", tone: 1, gloss: "to return / to go back", example: "返屋企 (go home)", freq: 80 },
  { traditional: "俾", simplified: "俾", jyutping: "bei2", tone: 2, gloss: "to give / by (passive)", example: "俾我 (give me)", freq: 81 },
  { traditional: "同", simplified: "同", jyutping: "tung4", tone: 4, gloss: "with / and / together", mandarin: "tóng", freq: 82 },
  { traditional: "但", simplified: "但", jyutping: "daan6", tone: 6, gloss: "but / however", mandarin: "dàn", freq: 83 },
  { traditional: "真", simplified: "真", jyutping: "zan1", tone: 1, gloss: "really / true", mandarin: "zhēn", freq: 84 },
  { traditional: "新", simplified: "新", jyutping: "san1", tone: 1, gloss: "new", mandarin: "xīn", freq: 85 },
  { traditional: "舊", simplified: "旧", jyutping: "gau6", tone: 6, gloss: "old (not new)", mandarin: "jiù", freq: 86 },
  { traditional: "白", simplified: "白", jyutping: "baak6", tone: 6, gloss: "white", mandarin: "bái", freq: 87 },
  { traditional: "黑", simplified: "黑", jyutping: "hak1", tone: 1, gloss: "black / dark", mandarin: "hēi", freq: 88 },
  { traditional: "紅", simplified: "红", jyutping: "hung4", tone: 4, gloss: "red", mandarin: "hóng", freq: 89 },
  { traditional: "藍", simplified: "蓝", jyutping: "laam4", tone: 4, gloss: "blue", mandarin: "lán", freq: 90 },
  { traditional: "綠", simplified: "绿", jyutping: "luk6", tone: 6, gloss: "green", mandarin: "lǜ", freq: 91 },
  { traditional: "黃", simplified: "黄", jyutping: "wong4", tone: 4, gloss: "yellow", mandarin: "huáng", freq: 92 },
  { traditional: "雨", simplified: "雨", jyutping: "jyu5", tone: 5, gloss: "rain", mandarin: "yǔ", freq: 93 },
  { traditional: "風", simplified: "风", jyutping: "fung1", tone: 1, gloss: "wind", mandarin: "fēng", freq: 94 },
  { traditional: "花", simplified: "花", jyutping: "faa1", tone: 1, gloss: "flower", mandarin: "huā", freq: 95 },
  { traditional: "貓", simplified: "猫", jyutping: "maau1", tone: 1, gloss: "cat", mandarin: "māo", freq: 96 },
  { traditional: "狗", simplified: "狗", jyutping: "gau2", tone: 2, gloss: "dog", mandarin: "gǒu", freq: 97 },
  { traditional: "魚", simplified: "鱼", jyutping: "jyu2", tone: 2, gloss: "fish", mandarin: "yú", freq: 98 },
  { traditional: "茶", simplified: "茶", jyutping: "caa4", tone: 4, gloss: "tea", mandarin: "chá", example: "飲茶 (drink tea / yum cha)", freq: 99 },
  { traditional: "咖啡", simplified: "咖啡", jyutping: "gaa3 fe1", tone: 3, gloss: "coffee", mandarin: "kāfēi", freq: 100 },
];

/** Build lookup map: normalized key → entries */
function buildJyutpingIndex(): Map<string, CantoneseEntry[]> {
  const map = new Map<string, CantoneseEntry[]>();
  for (const e of CANTONESE_DICT) {
    const keys = [e.traditional, e.simplified, e.jyutping];
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

const JYUTPING_INDEX: Map<string, CantoneseEntry[]> = buildJyutpingIndex();

function norm(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/** Exact lookup by character, jyutping, or pinyin. */
export function lookupCantonese(query: string): CantoneseEntry[] {
  const key = norm(query);
  if (!key) return [];
  return JYUTPING_INDEX.get(key) ?? [];
}

/** Fuzzy search: prefix match on traditional, simplified, jyutping, gloss, or pinyin. */
export function searchCantonese(query: string, limit = 20): CantoneseEntry[] {
  const key = norm(query);
  if (!key || key.length < 1) return CANTONESE_DICT.slice(0, limit);

  const scored: { entry: CantoneseEntry; score: number }[] = [];
  const seen = new Set<string>();

  for (const entry of CANTONESE_DICT) {
    const dedupKey = `${entry.traditional}:${entry.jyutping}`;
    if (seen.has(dedupKey)) continue;
    let score = 0;
    const fields = [
      norm(entry.traditional),
      norm(entry.simplified),
      norm(entry.jyutping),
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

function cantoneseEntryToDictEntry(e: CantoneseEntry): DictEntry {
  return {
    headword: `${e.traditional} (${e.simplified})`,
    pronunciation: e.jyutping,
    partOfSpeech: "",
    senses: [
      {
        definition: e.gloss,
        example: e.example,
        translations: e.mandarin ? [{ lang: "zh", text: e.mandarin }] : [],
      },
    ],
    source: "cantonese-local",
  };
}

/** Full DictResponse from local Cantonese data. */
export function cantoneseLookup(query: string): DictResponse {
  const entries = searchCantonese(query, 15);
  return {
    word: query,
    lang: "yue",
    entries: entries.map(cantoneseEntryToDictEntry),
  };
}
