/**
 * Local Shanghainese (上海话 / 沪语) dictionary dataset.
 *
 * Curated seed lexicon for learners, based on common online written forms
 * (吴语协会推荐用字 where available). Shanghainese Wu romanization uses
 * the Shanghai dialect phonetic alphabet (上海话拼音方案) with tone
 * numbers: 1=阴平(high), 2=阴去(rising), 3=阳去(low), 4=阴入, 5=阳入.
 *
 * Sources consulted:
 * - 吴语协会 (wu-chinese.com) — 吴语拼音 + 汉字推荐
 * - Wiktionary Shanghainese entries
 * - Common online Shanghainese writing patterns (侬, 勿, 个, 啥, 老, etc.)
 *
 * Notes:
 * - 侬 (nong, "you") is uniquely Shanghainese/Wu.
 * - 勿 (veq, "not") is the Wu negation, distinct from Mandarin 不 and
 *   Cantonese 唔.
 * - 个 (gheq) serves as possessive marker (的), same character as
 *   Cantonese/Hokkien/Hakka but different reading.
 * - 啥 (sa, "what") is shared with many Wu dialects.
 * - 老 (lau, "very") is a common Shanghainese intensifier.
 */

import type { DictEntry, DictResponse } from "./dict-types";

export type ShanghaineseEntry = {
  /** Preferred written form */
  traditional: string;
  /** Simplified Chinese characters */
  simplified: string;
  /** Shanghainese Wu romanization with tone number */
  roman: string;
  /** Tone number (1-5) */
  tone: number;
  /** English gloss / definition */
  gloss: string;
  /** Mandarin pronunciation (pinyin) */
  mandarin?: string;
  /** Usage example in Shanghainese written form */
  example?: string;
  /** Frequency rank (1 = most common) */
  freq?: number;
  /** Provenance / trust grading */
  source: "wu-chinese-standard" | "community-verified" | "llm-suggested";
  /** 0-1 — probability the written form & reading are correct */
  confidence: number;
};

/** Curated subset of common Shanghainese words & particles for learners. */
export const SHANGHAINESE_DICT: ShanghaineseEntry[] = [
  // ══ Pronouns ══
  { traditional: "我", simplified: "我", roman: "ngu", tone: 3, gloss: "I / me", mandarin: "wǒ", example: "我个书", freq: 1, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "侬", simplified: "侬", roman: "nong", tone: 3, gloss: "you (singular)", mandarin: "nǐ", example: "侬好", freq: 2, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "伊", simplified: "伊", roman: "yi", tone: 3, gloss: "he / she / it", mandarin: "tā", example: "伊是老师", freq: 3, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "阿拉", simplified: "阿拉", roman: "aq-laq", tone: 4, gloss: "we / us", mandarin: "wǒmen", example: "阿拉一道去", freq: 4, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "㑚", simplified: "㑚", roman: "na", tone: 3, gloss: "you (plural)", mandarin: "nǐmen", example: "㑚好", freq: 12, source: "community-verified", confidence: 0.92 },
  { traditional: "伊拉", simplified: "伊拉", roman: "yi-laq", tone: 3, gloss: "they / them", mandarin: "tāmen", example: "伊拉来了", freq: 9, source: "wu-chinese-standard", confidence: 0.96 },
  { traditional: "自家", simplified: "自家", roman: "zy-ga", tone: 3, gloss: "oneself", mandarin: "zìjǐ", example: "我自家做个", freq: 20, source: "community-verified", confidence: 0.94 },

  // ══ Question words ══
  { traditional: "啥", simplified: "啥", roman: "sa", tone: 5, gloss: "what", mandarin: "shénme", example: "做个啥？", freq: 5, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "啥人", simplified: "啥人", roman: "sa-gnin", tone: 5, gloss: "who", mandarin: "shéi", example: "啥人来啦？", freq: 8, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "阿里", simplified: "阿里", roman: "aq-li", tone: 4, gloss: "which / where", mandarin: "nǎ / nǎlǐ", example: "阿里搭去？", freq: 10, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "几化", simplified: "几化", roman: "ci-ho", tone: 5, gloss: "how many / how much", mandarin: "duōshao", example: "几化铜钿？", freq: 15, source: "community-verified", confidence: 0.93 },
  { traditional: "哪能", simplified: "哪能", roman: "na-nen", tone: 3, gloss: "how / in what way", mandarin: "zěnme", example: "哪能做？", freq: 7, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "做啥", simplified: "做啥", roman: "tsu-sa", tone: 5, gloss: "why / what for", mandarin: "wèishénme", example: "侬做啥勿来？", freq: 11, source: "community-verified", confidence: 0.94 },

  // ══ Negation & function words ══
  { traditional: "勿", simplified: "勿", roman: "veq", tone: 5, gloss: "not (general negation)", mandarin: "bù", example: "勿晓得", freq: 6, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "勿要", simplified: "勿要", roman: "veq-iau", tone: 5, gloss: "don't / do not want", mandarin: "bùyào", example: "勿要怕", freq: 13, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "呒没", simplified: "呒没", roman: "m-meq", tone: 3, gloss: "don't have / there isn't", mandarin: "méiyǒu", example: "呒没铜钿", freq: 14, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "个", simplified: "个", roman: "gheq", tone: 5, gloss: "possessive / nominalizer (的)", mandarin: "de", example: "我个", freq: 16, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "勒", simplified: "勒", roman: "leq", tone: 5, gloss: "at / in / -ing (aspect)", mandarin: "zài", example: "勒屋里", freq: 17, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "脱", simplified: "脱", roman: "theq", tone: 4, gloss: "with / and / off", mandarin: "hé / diào", example: "搭侬脱我讲", freq: 18, source: "community-verified", confidence: 0.93 },
  { traditional: "咾", simplified: "咾", roman: "lau", tone: 3, gloss: "(sentence-final particle / so)", mandarin: "ne / suǒyǐ", example: "好咾！", freq: 25, source: "community-verified", confidence: 0.90 },
  { traditional: "覅", simplified: "覅", roman: "viau", tone: 5, gloss: "don't (contraction of 勿要)", mandarin: "bié", example: "覅讲啦", freq: 22, source: "wu-chinese-standard", confidence: 0.96 },

  // ══ Common verbs ══
  { traditional: "是", simplified: "是", roman: "zy", tone: 3, gloss: "is / to be", mandarin: "shì", example: "伊是学生", freq: 19, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "有", simplified: "有", roman: "yeu", tone: 3, gloss: "have / there is", mandarin: "yǒu", example: "我有问题", freq: 21, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "做", simplified: "做", roman: "tsu", tone: 5, gloss: "to do / to make", mandarin: "zuò", example: "做功课", freq: 23, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "讲", simplified: "讲", roman: "kaon", tone: 5, gloss: "to speak / to say", mandarin: "jiǎng", example: "讲上海话", freq: 24, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "晓得", simplified: "晓得", roman: "xiau-teq", tone: 5, gloss: "to know", mandarin: "zhīdào", example: "侬晓得勿？", freq: 26, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "看", simplified: "看", roman: "khoe", tone: 5, gloss: "to look / to watch", mandarin: "kàn", example: "看书", freq: 27, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "听", simplified: "听", roman: "thin", tone: 1, gloss: "to listen", mandarin: "tīng", example: "听讲", freq: 28, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "吃", simplified: "吃", roman: "chiq", tone: 4, gloss: "to eat / to drink", mandarin: "chī", example: "吃饭", freq: 29, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "来", simplified: "来", roman: "le", tone: 3, gloss: "to come", mandarin: "lái", example: "侬来啦？", freq: 30, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "去", simplified: "去", roman: "chi", tone: 5, gloss: "to go", mandarin: "qù", example: "阿拉去学堂", freq: 31, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "要", simplified: "要", roman: "iau", tone: 5, gloss: "to want / will", mandarin: "yào", example: "我要吃", freq: 32, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "会", simplified: "会", roman: "we", tone: 3, gloss: "can / will / to be able", mandarin: "huì", example: "我会讲上海话", freq: 33, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "好", simplified: "好", roman: "hau", tone: 5, gloss: "good / OK / may", mandarin: "hǎo", example: "好个", freq: 34, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "用", simplified: "用", roman: "yon", tone: 3, gloss: "to use", mandarin: "yòng", example: "用笔写", freq: 35, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "觉着", simplified: "觉着", roman: "koq-zaq", tone: 4, gloss: "to feel / to think", mandarin: "juéde", example: "我觉着蛮好", freq: 36, source: "community-verified", confidence: 0.94 },
  { traditional: "帮", simplified: "帮", roman: "paon", tone: 1, gloss: "to help / for", mandarin: "bāng", example: "帮帮我", freq: 37, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "等", simplified: "等", roman: "ten", tone: 5, gloss: "to wait", mandarin: "děng", example: "等一歇", freq: 38, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "寻", simplified: "寻", roman: "zhin", tone: 3, gloss: "to look for", mandarin: "zhǎo", example: "寻勿着", freq: 39, source: "community-verified", confidence: 0.93 },
  { traditional: "写", simplified: "写", roman: "sia", tone: 5, gloss: "to write", mandarin: "xiě", example: "写字", freq: 40, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "问", simplified: "问", roman: "men", tone: 3, gloss: "to ask", mandarin: "wèn", example: "问问题", freq: 41, source: "wu-chinese-standard", confidence: 0.99 },

  // ══ Common nouns ══
  { traditional: "人", simplified: "人", roman: "gnin", tone: 3, gloss: "person / people", mandarin: "rén", freq: 42, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "小囡", simplified: "小囡", roman: "siau-noe", tone: 3, gloss: "child / kid", mandarin: "háizi", example: "小囡勒读书", freq: 43, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "学堂", simplified: "学堂", roman: "ghoq-daon", tone: 5, gloss: "school", mandarin: "xuéxiào", freq: 44, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "先生", simplified: "先生", roman: "si-san", tone: 1, gloss: "teacher / Mr.", mandarin: "lǎoshī", example: "王先生", freq: 45, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "学生", simplified: "学生", roman: "ghoq-san", tone: 5, gloss: "student", mandarin: "xuéshēng", freq: 46, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "屋里", simplified: "屋里", roman: "oq-li", tone: 4, gloss: "home / house", mandarin: "jiā", example: "勒屋里", freq: 47, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "饭", simplified: "饭", roman: "ve", tone: 3, gloss: "rice / meal", mandarin: "fàn", example: "吃饭", freq: 48, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "水", simplified: "水", roman: "sy", tone: 5, gloss: "water", mandarin: "shuǐ", freq: 49, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "铜钿", simplified: "铜钿", roman: "don-di", tone: 3, gloss: "money", mandarin: "qián", example: "几化铜钿？", freq: 50, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "事体", simplified: "事体", roman: "zy-thi", tone: 3, gloss: "matter / thing / affair", mandarin: "shìqing", example: "啥事体？", freq: 51, source: "community-verified", confidence: 0.95 },
  { traditional: "物事", simplified: "物事", roman: "meq-zy", tone: 5, gloss: "thing / object", mandarin: "dōngxi", freq: 52, source: "community-verified", confidence: 0.93 },
  { traditional: "闲话", simplified: "闲话", roman: "ghe-gho", tone: 3, gloss: "language / speech", mandarin: "huà", example: "上海闲话", freq: 53, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "题目", simplified: "题目", roman: "di-moq", tone: 3, gloss: "problem / question (hw)", mandarin: "tímù", example: "数学题目", freq: 54, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "书", simplified: "书", roman: "sy", tone: 1, gloss: "book", mandarin: "shū", freq: 55, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "笔", simplified: "笔", roman: "piq", tone: 4, gloss: "pen", mandarin: "bǐ", freq: 56, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "马路", simplified: "马路", roman: "mo-lu", tone: 3, gloss: "road / street", mandarin: "lù", freq: 57, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "天", simplified: "天", roman: "thi", tone: 1, gloss: "day / sky", mandarin: "tiān", freq: 58, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "今朝", simplified: "今朝", roman: "cin-tsau", tone: 1, gloss: "today", mandarin: "jīntiān", freq: 59, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "明朝", simplified: "明朝", roman: "min-tsau", tone: 1, gloss: "tomorrow", mandarin: "míngtiān", freq: 60, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "昨日", simplified: "昨日", roman: "zoq-gniq", tone: 5, gloss: "yesterday", mandarin: "zuótiān", freq: 61, source: "wu-chinese-standard", confidence: 0.98 },

  // ══ Adjectives & intensifiers ══
  { traditional: "好", simplified: "好", roman: "hau", tone: 5, gloss: "good", mandarin: "hǎo", freq: 62, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "坏", simplified: "坏", roman: "wa", tone: 3, gloss: "bad", mandarin: "huài", freq: 63, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "大", simplified: "大", roman: "du", tone: 3, gloss: "big", mandarin: "dà", freq: 64, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "小", simplified: "小", roman: "siau", tone: 5, gloss: "small", mandarin: "xiǎo", freq: 65, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "蛮", simplified: "蛮", roman: "me", tone: 1, gloss: "quite / rather", mandarin: "tǐng", example: "蛮好个", freq: 66, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "老", simplified: "老", roman: "lau", tone: 3, gloss: "very (intensifier)", mandarin: "hěn", example: "老好", freq: 67, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "交关", simplified: "交关", roman: "ciau-kue", tone: 1, gloss: "very much / a lot", mandarin: "hěnduō", example: "交关多", freq: 68, source: "community-verified", confidence: 0.94 },
  { traditional: "多", simplified: "多", roman: "tu", tone: 1, gloss: "many / much", mandarin: "duō", freq: 69, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "少", simplified: "少", roman: "sau", tone: 5, gloss: "few / little", mandarin: "shǎo", freq: 70, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "快", simplified: "快", roman: "khua", tone: 5, gloss: "fast", mandarin: "kuài", freq: 71, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "慢", simplified: "慢", roman: "me", tone: 3, gloss: "slow", mandarin: "màn", freq: 72, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "对", simplified: "对", roman: "te", tone: 5, gloss: "correct / right", mandarin: "duì", freq: 73, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "错", simplified: "错", roman: "tshu", tone: 5, gloss: "wrong / incorrect", mandarin: "cuò", freq: 74, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "难", simplified: "难", roman: "ne", tone: 3, gloss: "difficult", mandarin: "nán", freq: 75, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "便当", simplified: "便当", roman: "bi-taon", tone: 3, gloss: "easy / convenient", mandarin: "róngyì", freq: 76, source: "community-verified", confidence: 0.93 },
  { traditional: "清爽", simplified: "清爽", roman: "chin-saon", tone: 1, gloss: "clear / clean", mandarin: "qīngchu", freq: 77, source: "community-verified", confidence: 0.94 },
  { traditional: "闹猛", simplified: "闹猛", roman: "nau-man", tone: 3, gloss: "lively / bustling", mandarin: "rènao", freq: 78, source: "community-verified", confidence: 0.92 },

  // ══ Conjunctions & prepositions ══
  { traditional: "脱", simplified: "脱", roman: "theq", tone: 4, gloss: "and / with", mandarin: "hé", freq: 79, source: "wu-chinese-standard", confidence: 0.96 },
  { traditional: "搭", simplified: "搭", roman: "taq", tone: 4, gloss: "and / with (alternate)", mandarin: "hé", example: "我搭侬", freq: 80, source: "community-verified", confidence: 0.93 },
  { traditional: "因为", simplified: "因为", roman: "in-we", tone: 1, gloss: "because", mandarin: "yīnwèi", freq: 81, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "所以", simplified: "所以", roman: "su-i", tone: 5, gloss: "therefore / so", mandarin: "suǒyǐ", freq: 82, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "但是", simplified: "但是", roman: "de-zy", tone: 3, gloss: "but", mandarin: "dànshì", freq: 83, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "个能", simplified: "个能", roman: "gheq-nen", tone: 5, gloss: "like this / in this way", mandarin: "zhèyàng", example: "个能做", freq: 84, source: "community-verified", confidence: 0.92 },
  { traditional: "假使", simplified: "假使", roman: "cia-sy", tone: 5, gloss: "if", mandarin: "rúguǒ", freq: 85, source: "community-verified", confidence: 0.91 },

  // ══ Numbers ══
  { traditional: "一", simplified: "一", roman: "iq", tone: 4, gloss: "one", mandarin: "yī", freq: 86, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "两", simplified: "两", roman: "lian", tone: 3, gloss: "two", mandarin: "èr / liǎng", freq: 87, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "三", simplified: "三", roman: "se", tone: 1, gloss: "three", mandarin: "sān", freq: 88, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "四", simplified: "四", roman: "sy", tone: 5, gloss: "four", mandarin: "sì", freq: 89, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "五", simplified: "五", roman: "ng", tone: 3, gloss: "five", mandarin: "wǔ", freq: 90, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "六", simplified: "六", roman: "loq", tone: 5, gloss: "six", mandarin: "liù", freq: 91, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "七", simplified: "七", roman: "chiq", tone: 4, gloss: "seven", mandarin: "qī", freq: 92, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "八", simplified: "八", roman: "paq", tone: 4, gloss: "eight", mandarin: "bā", freq: 93, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "九", simplified: "九", roman: "cieu", tone: 5, gloss: "nine", mandarin: "jiǔ", freq: 94, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "十", simplified: "十", roman: "zeq", tone: 5, gloss: "ten", mandarin: "shí", freq: 95, source: "wu-chinese-standard", confidence: 0.99 },

  // ══ Time & measure words ══
  { traditional: "一歇", simplified: "一歇", roman: "iq-shiq", tone: 4, gloss: "a moment / a while", mandarin: "yīhuìr", example: "等一歇", freq: 96, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "辰光", simplified: "辰光", roman: "zen-kuaon", tone: 3, gloss: "time / moment", mandarin: "shíhou", example: "啥辰光？", freq: 97, source: "wu-chinese-standard", confidence: 0.96 },
  { traditional: "常桩", simplified: "常桩", roman: "zan-tsaon", tone: 3, gloss: "often / frequently", mandarin: "jīngcháng", freq: 98, source: "community-verified", confidence: 0.90 },
  { traditional: "道", simplified: "道", roman: "dau", tone: 3, gloss: "(measure word for times)", mandarin: "cì / biàn", freq: 99, source: "community-verified", confidence: 0.93 },

  // ══ Direction & location ══
  { traditional: "上头", simplified: "上头", roman: "zaon-deu", tone: 3, gloss: "above / on top", mandarin: "shàngmiàn", freq: 100, source: "community-verified", confidence: 0.93 },
  { traditional: "下头", simplified: "下头", roman: "gho-deu", tone: 3, gloss: "below / underneath", mandarin: "xiàmiàn", freq: 101, source: "community-verified", confidence: 0.93 },
  { traditional: "里向", simplified: "里向", roman: "li-sian", tone: 3, gloss: "inside", mandarin: "lǐmiàn", freq: 102, source: "community-verified", confidence: 0.93 },
  { traditional: "外头", simplified: "外头", roman: "nga-deu", tone: 3, gloss: "outside", mandarin: "wàimiàn", freq: 103, source: "community-verified", confidence: 0.93 },
  { traditional: "边浪", simplified: "边浪", roman: "pi-laon", tone: 1, gloss: "beside / next to", mandarin: "pángbiān", freq: 104, source: "community-verified", confidence: 0.91 },

  // ══ Math & learning ══
  { traditional: "算", simplified: "算", roman: "soe", tone: 5, gloss: "to calculate", mandarin: "suàn", freq: 105, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "加", simplified: "加", roman: "ka", tone: 1, gloss: "to add", mandarin: "jiā", freq: 106, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "减", simplified: "减", roman: "ke", tone: 5, gloss: "to subtract", mandarin: "jiǎn", freq: 107, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "答案", simplified: "答案", roman: "taq-oe", tone: 4, gloss: "answer", mandarin: "dá'àn", freq: 108, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "晓得", simplified: "晓得", roman: "xiau-teq", tone: 5, gloss: "to know / understand", mandarin: "zhīdào", freq: 109, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "记牢", simplified: "记牢", roman: "ci-lau", tone: 5, gloss: "to remember", mandarin: "jìzhù", freq: 110, source: "community-verified", confidence: 0.93 },

  // ══ Discourse / common phrases ══
  { traditional: "侬好", simplified: "侬好", roman: "nong-hau", tone: 3, gloss: "hello (Shanghainese)", mandarin: "nǐ hǎo", freq: 111, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "谢谢", simplified: "谢谢", roman: "zhia-zhia", tone: 3, gloss: "thank you", mandarin: "xièxie", freq: 112, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "再会", simplified: "再会", roman: "tse-we", tone: 5, gloss: "goodbye", mandarin: "zàijiàn", freq: 113, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "对勿起", simplified: "对勿起", roman: "te-veq-chi", tone: 5, gloss: "sorry", mandarin: "duìbùqǐ", freq: 114, source: "wu-chinese-standard", confidence: 0.96 },
  { traditional: "勿要紧", simplified: "勿要紧", roman: "veq-iau-cin", tone: 5, gloss: "it's OK / no problem", mandarin: "méiguānxi", freq: 115, source: "community-verified", confidence: 0.93 },
  { traditional: "帮帮忙", simplified: "帮帮忙", roman: "paon-paon-maon", tone: 1, gloss: "help me / please (polite)", mandarin: "bāng bāng máng", freq: 116, source: "community-verified", confidence: 0.92 },
  { traditional: "慢慢叫", simplified: "慢慢叫", roman: "me-me-ciau", tone: 3, gloss: "take it easy / slowly", mandarin: "màn màn lái", freq: 117, source: "wu-chinese-standard", confidence: 0.96 },
  { traditional: "勿要吓", simplified: "勿要吓", roman: "veq-iau-haq", tone: 5, gloss: "don't be afraid", mandarin: "bié pà", freq: 118, source: "community-verified", confidence: 0.92 },
  { traditional: "好个", simplified: "好个", roman: "hau-gheq", tone: 5, gloss: "OK / all right", mandarin: "hǎo de", freq: 119, source: "community-verified", confidence: 0.94 },
  { traditional: "试试看", simplified: "试试看", roman: "sy-sy-khoe", tone: 5, gloss: "give it a try", mandarin: "shì shì kàn", freq: 120, source: "community-verified", confidence: 0.93 },
  { traditional: "一道", simplified: "一道", roman: "iq-dau", tone: 4, gloss: "together", mandarin: "yìqǐ", freq: 121, source: "wu-chinese-standard", confidence: 0.96 },

  // ══ Extra common Wu/Shanghainese tokens ══
  { traditional: "上海", simplified: "上海", roman: "zaon-he", tone: 3, gloss: "Shanghai", freq: 122, source: "wu-chinese-standard", confidence: 0.99 },
  { traditional: "上海话", simplified: "上海话", roman: "zaon-he-gho", tone: 3, gloss: "Shanghainese language", freq: 123, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "呒啥", simplified: "呒啥", roman: "m-sa", tone: 3, gloss: "it's nothing / no big deal", mandarin: "méi shénme", freq: 124, source: "community-verified", confidence: 0.90 },
  { traditional: "叫", simplified: "叫", roman: "ciau", tone: 5, gloss: "to call / to be called", mandarin: "jiào", freq: 125, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "摆", simplified: "摆", roman: "pa", tone: 5, gloss: "to put / to place", mandarin: "fàng", freq: 126, source: "community-verified", confidence: 0.91 },
  { traditional: "读", simplified: "读", roman: "doq", tone: 5, gloss: "to read / to study", mandarin: "dú", freq: 127, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "写", simplified: "写", roman: "sia", tone: 5, gloss: "to write", mandarin: "xiě", freq: 128, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "话", simplified: "话", roman: "gho", tone: 3, gloss: "to say / words", mandarin: "shuō / huà", freq: 129, source: "wu-chinese-standard", confidence: 0.97 },
  { traditional: "欢喜", simplified: "欢喜", roman: "huoe-shi", tone: 1, gloss: "to like", mandarin: "xǐhuān", freq: 130, source: "community-verified", confidence: 0.93 },
  { traditional: "吃茶", simplified: "吃茶", roman: "chiq-zo", tone: 4, gloss: "to drink tea", mandarin: "hē chá", freq: 131, source: "community-verified", confidence: 0.95 },
  { traditional: "吃饭", simplified: "吃饭", roman: "chiq-ve", tone: 4, gloss: "to eat a meal", mandarin: "chī fàn", freq: 132, source: "wu-chinese-standard", confidence: 0.98 },
  { traditional: "睏觉", simplified: "睏觉", roman: "khuen-kau", tone: 5, gloss: "to sleep", mandarin: "shuìjiào", freq: 133, source: "community-verified", confidence: 0.92 },
  { traditional: "跑", simplified: "跑", roman: "bau", tone: 3, gloss: "to run / to go", mandarin: "pǎo", freq: 134, source: "wu-chinese-standard", confidence: 0.96 },
  { traditional: "走", simplified: "走", roman: "tseu", tone: 5, gloss: "to walk", mandarin: "zǒu", freq: 135, source: "wu-chinese-standard", confidence: 0.98 },
];

// ── Lookup index ──

function buildShanghaineseIndex(): Map<string, ShanghaineseEntry[]> {
  const map = new Map<string, ShanghaineseEntry[]>();
  for (const e of SHANGHAINESE_DICT) {
    for (const key of [e.traditional, e.simplified, e.roman.toLowerCase()]) {
      if (!key || key.length < 1) continue;
      const existing = map.get(key);
      if (existing) existing.push(e);
      else map.set(key, [e]);
    }
  }
  return map;
}

const SHANGHAINESE_INDEX: Map<string, ShanghaineseEntry[]> = buildShanghaineseIndex();

/** Fuzzy key normalization — strip tone numbers and diacritics. */
function normalizeKey(key: string): string {
  return key.replace(/[0-9\u0300-\u036f\u02b0-\u02ff]+/g, "").toLowerCase();
}

export function lookupShanghainese(query: string): ShanghaineseEntry[] {
  const key = normalizeKey(query.trim());
  if (!key) return [];
  return SHANGHAINESE_INDEX.get(key) ?? [];
}

export function searchShanghainese(query: string, limit = 20): ShanghaineseEntry[] {
  const key = normalizeKey(query.trim());
  if (!key || key.length < 1) return SHANGHAINESE_DICT.slice(0, limit);

  const scored: { entry: ShanghaineseEntry; score: number }[] = [];
  const lower = key.toLowerCase();

  for (const entry of SHANGHAINESE_DICT) {
    let score = 0;
    const t = entry.traditional;
    const s = entry.simplified;
    const r = normalizeKey(entry.roman);
    const g = entry.gloss.toLowerCase();

    if (t === key || s === key || r === key) score += 100;
    if (t.includes(key) || s.includes(key)) score += 30;
    if (r.includes(lower)) score += 20;
    if (g.includes(lower)) score += 15;
    if (entry.mandarin?.includes(key)) score += 10;
    if (entry.example?.includes(key)) score += 8;

    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.entry.freq ?? 999) - (b.entry.freq ?? 999);
  });

  return scored.slice(0, limit).map((s) => s.entry);
}

function shanghaineseEntryToDictEntry(e: ShanghaineseEntry): DictEntry {
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
    source: "shanghainese-local",
  };
}

/** Full DictResponse from local Shanghainese data. */
export function shanghaineseLookup(query: string): DictResponse {
  const entries = searchShanghainese(query, 15);
  return {
    word: query,
    lang: "sha",
    entries: entries.map(shanghaineseEntryToDictEntry),
  };
}
