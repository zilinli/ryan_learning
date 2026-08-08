/**
 * Local Teochew (潮汕话 / 潮州话) dictionary dataset.
 *
 * Curated seed lexicon for learners, based on the common written form
 * used online (expert character + homophone hybrid) and Peng'im
 * romanization (1960 Chaoshan Pinyin scheme, tone numbers 1-8).
 *
 * Each entry is graded with a `source` tag and a 0-1 `confidence` so the
 * frontend can sort by trust and native speakers can review low-confidence
 * rows first (see docs/subsystems/dialect-eval-set.md).
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
  /** Provenance / trust grading */
  source: "community-verified" | "llm-suggested";
  /** 0-1 — probability the written form & reading are correct */
  confidence: number;
};

/** Curated subset of common Teochew words & particles for learners. */
export const TEOCHEW_DICT: TeochewEntry[] = [
  // ══ Pronouns & function words ══
  { traditional: "我", simplified: "我", pengim: "ua2", tone: 2, gloss: "I / me", mandarin: "wǒ", freq: 1, source: "community-verified", confidence: 0.98 },
  { traditional: "汝", simplified: "汝", pengim: "le2", tone: 2, gloss: "you (also written 你)", mandarin: "nǐ", example: "汝好 (hello)", freq: 2, source: "community-verified", confidence: 0.98 },
  { traditional: "你", simplified: "你", pengim: "le2", tone: 2, gloss: "you (common written form of 汝)", mandarin: "nǐ", example: "你好 (hello)", freq: 2, source: "community-verified", confidence: 0.95 },
  { traditional: "伊", simplified: "伊", pengim: "i1", tone: 1, gloss: "he / him / she / her / it", freq: 3, source: "community-verified", confidence: 0.97 },
  { traditional: "侬", simplified: "侬", pengim: "nang5", tone: 5, gloss: "person / people (also written 人)", example: "家己侬 (family / own people)", freq: 4, source: "community-verified", confidence: 0.95 },
  { traditional: "人", simplified: "人", pengim: "nang5", tone: 5, gloss: "person / people (standard character)", mandarin: "rén", freq: 4, source: "community-verified", confidence: 0.97 },
  { traditional: "个", simplified: "个", pengim: "gai7", tone: 7, gloss: "possessive particle (的) / generic classifier", example: "我个书 (my book)", freq: 5, source: "community-verified", confidence: 0.98 },
  { traditional: "唔", simplified: "唔", pengim: "m6", tone: 6, gloss: "not (negation)", example: "唔是 (is not)", freq: 6, source: "community-verified", confidence: 0.98 },
  { traditional: "勿", simplified: "勿", pengim: "mai3", tone: 3, gloss: "don't / don't want", example: "勿惊 (don't be afraid)", freq: 7, source: "community-verified", confidence: 0.96 },
  { traditional: "无", simplified: "无", pengim: "bho5", tone: 5, gloss: "don't have / there isn't / no", example: "无错 (no mistake)", freq: 8, source: "community-verified", confidence: 0.97 },
  { traditional: "有", simplified: "有", pengim: "u6", tone: 6, gloss: "to have / there is", mandarin: "yǒu", freq: 9, source: "community-verified", confidence: 0.97 },
  { traditional: "是", simplified: "是", pengim: "si6", tone: 6, gloss: "yes / to be (is/am/are)", mandarin: "shì", freq: 10, source: "community-verified", confidence: 0.97 },
  { traditional: "唔是", simplified: "唔是", pengim: "m6 si6", tone: 6, gloss: "no / is not", freq: 11, source: "community-verified", confidence: 0.96 },
  { traditional: "佮", simplified: "佮", pengim: "gah4", tone: 4, gloss: "and / with (conjunction)", example: "我佮汝 (you and I)", freq: 12, source: "community-verified", confidence: 0.95 },
  { traditional: "甲", simplified: "甲", pengim: "gah4", tone: 4, gloss: "to tell / with (tell someone)", example: "甲我知 (tell me)", freq: 13, source: "community-verified", confidence: 0.93 },
  { traditional: "了", simplified: "了", pengim: "liao2", tone: 2, gloss: "completed action marker (了)", mandarin: "le", freq: 14, source: "community-verified", confidence: 0.95 },
  { traditional: "过", simplified: "过", pengim: "gue3", tone: 3, gloss: "past / ever / have done", example: "来过 (has been here)", freq: 15, source: "community-verified", confidence: 0.95 },
  { traditional: "家己", simplified: "家己", pengim: "ga1 gi7", tone: 1, gloss: "oneself / by oneself", example: "家己做 (do it yourself)", freq: 16, source: "community-verified", confidence: 0.94 },
  { traditional: "大家", simplified: "大家", pengim: "dai6 gê1", tone: 6, gloss: "everyone / all of us", mandarin: "dàjiā", freq: 17, source: "community-verified", confidence: 0.92 },
  { traditional: "别人", simplified: "别人", pengim: "bag4 nang5", tone: 4, gloss: "others / other people", mandarin: "biérén", freq: 18, source: "community-verified", confidence: 0.9 },
  { traditional: "底人", simplified: "底人", pengim: "di7 nang5", tone: 7, gloss: "who (also 谁)", example: "底人来？(Who came?)", freq: 19, source: "community-verified", confidence: 0.9 },
  { traditional: "谁", simplified: "谁", pengim: "sui5", tone: 5, gloss: "who (standard character)", mandarin: "shéi", freq: 19, source: "community-verified", confidence: 0.9 },
  // ── Question words ──
  { traditional: "乜个", simplified: "乜个", pengim: "mih4 gai7", tone: 4, gloss: "what", example: "这是乜个？(What is this?)", freq: 20, source: "community-verified", confidence: 0.96 },
  { traditional: "怎呢", simplified: "怎呢", pengim: "zo2 ni5", tone: 2, gloss: "how / why (also 做呢)", example: "怎呢做？(How to do it?)", freq: 21, source: "community-verified", confidence: 0.95 },
  { traditional: "做呢", simplified: "做呢", pengim: "zo3 ni5", tone: 3, gloss: "how / why", freq: 22, source: "community-verified", confidence: 0.93 },
  { traditional: "底块", simplified: "底块", pengim: "di7 go3", tone: 7, gloss: "where", example: "去底块？(Where to?)", freq: 23, source: "community-verified", confidence: 0.92 },
  { traditional: "底个", simplified: "底个", pengim: "di7 gai5", tone: 7, gloss: "which / which one", freq: 24, source: "community-verified", confidence: 0.9 },
  { traditional: "只", simplified: "只", pengim: "zi2", tone: 2, gloss: "this", example: "只道题 (this question)", freq: 25, source: "community-verified", confidence: 0.95 },
  { traditional: "许", simplified: "许", pengim: "he2", tone: 2, gloss: "that (also written 彼)", example: "许本书 (that book)", freq: 26, source: "community-verified", confidence: 0.94 },
  { traditional: "几多", simplified: "几多", pengim: "gui2 zoi7", tone: 2, gloss: "how many / how much", example: "几多钱？(How much?)", freq: 27, source: "community-verified", confidence: 0.95 },
  { traditional: "为乜", simplified: "为乜", pengim: "ui5 mih4", tone: 5, gloss: "why", example: "为乜无来？(Why didn't you come?)", freq: 28, source: "community-verified", confidence: 0.9 },
  { traditional: "乜时阵", simplified: "乜时阵", pengim: "mih4 si5 zung5", tone: 4, gloss: "when / what time", example: "乜时阵来？(When to come?)", freq: 29, source: "community-verified", confidence: 0.9 },
  // ── Common verbs ──
  { traditional: "食", simplified: "食", pengim: "ziah8", tone: 8, gloss: "to eat / to drink (one verb for both)", mandarin: "shí", example: "食饭 (eat a meal)", freq: 30, source: "community-verified", confidence: 0.98 },
  { traditional: "睇", simplified: "睇", pengim: "toin2", tone: 2, gloss: "to see / to look / to watch / to read", example: "睇书 (read a book)", freq: 31, source: "community-verified", confidence: 0.97 },
  { traditional: "听", simplified: "听", pengim: "tia1", tone: 1, gloss: "to listen / to hear", mandarin: "tīng", freq: 32, source: "community-verified", confidence: 0.95 },
  { traditional: "讲", simplified: "讲", pengim: "gong2", tone: 2, gloss: "to speak / to say", mandarin: "jiǎng", example: "讲潮州话 (speak Teochew)", freq: 33, source: "community-verified", confidence: 0.96 },
  { traditional: "问", simplified: "问", pengim: "mung7", tone: 7, gloss: "to ask", mandarin: "wèn", freq: 34, source: "community-verified", confidence: 0.95 },
  { traditional: "答", simplified: "答", pengim: "dab4", tone: 4, gloss: "to answer / to reply", mandarin: "dá", freq: 35, source: "community-verified", confidence: 0.95 },
  { traditional: "知", simplified: "知", pengim: "zai1", tone: 1, gloss: "to know", mandarin: "zhī", example: "唔知 (don't know)", freq: 36, source: "community-verified", confidence: 0.96 },
  { traditional: "想", simplified: "想", pengim: "sion2", tone: 2, gloss: "to think / to want", mandarin: "xiǎng", freq: 37, source: "community-verified", confidence: 0.95 },
  { traditional: "爱", simplified: "爱", pengim: "ain3", tone: 3, gloss: "to want / to love", mandarin: "ài", example: "我爱食茶 (I like drinking tea)", freq: 38, source: "community-verified", confidence: 0.95 },
  { traditional: "惊", simplified: "惊", pengim: "gia1", tone: 1, gloss: "to be afraid", mandarin: "jīng", example: "勿惊 (don't be scared)", freq: 39, source: "community-verified", confidence: 0.95 },
  { traditional: "去", simplified: "去", pengim: "ke3", tone: 3, gloss: "to go", mandarin: "qù", freq: 40, source: "community-verified", confidence: 0.96 },
  { traditional: "来", simplified: "来", pengim: "lai5", tone: 5, gloss: "to come", mandarin: "lái", example: "来只块 (come here)", freq: 41, source: "community-verified", confidence: 0.96 },
  { traditional: "到", simplified: "到", pengim: "gao3", tone: 3, gloss: "to arrive / to reach", mandarin: "dào", example: "到学校 (arrive at school)", freq: 42, source: "community-verified", confidence: 0.92 },
  { traditional: "坐", simplified: "坐", pengim: "zo6", tone: 6, gloss: "to sit", mandarin: "zuò", freq: 43, source: "community-verified", confidence: 0.95 },
  { traditional: "行", simplified: "行", pengim: "gia5", tone: 5, gloss: "to walk / to go (on foot)", mandarin: "xíng", example: "行路 (walk)", freq: 44, source: "community-verified", confidence: 0.95 },
  { traditional: "走", simplified: "走", pengim: "zao2", tone: 2, gloss: "to run / to leave", mandarin: "zǒu", freq: 45, source: "community-verified", confidence: 0.93 },
  { traditional: "读", simplified: "读", pengim: "tag8", tone: 8, gloss: "to read / to study", mandarin: "dú", example: "读书 (study)", freq: 46, source: "community-verified", confidence: 0.96 },
  { traditional: "写", simplified: "写", pengim: "sia2", tone: 2, gloss: "to write", mandarin: "xiě", freq: 47, source: "community-verified", confidence: 0.95 },
  { traditional: "学", simplified: "学", pengim: "oh8", tone: 8, gloss: "to learn / to study", mandarin: "xué", freq: 48, source: "community-verified", confidence: 0.95 },
  { traditional: "教", simplified: "教", pengim: "ga3", tone: 3, gloss: "to teach", mandarin: "jiāo", freq: 49, source: "community-verified", confidence: 0.94 },
  { traditional: "买", simplified: "买", pengim: "boi2", tone: 2, gloss: "to buy", mandarin: "mǎi", freq: 50, source: "community-verified", confidence: 0.95 },
  { traditional: "卖", simplified: "卖", pengim: "boi7", tone: 7, gloss: "to sell", mandarin: "mài", freq: 51, source: "community-verified", confidence: 0.95 },
  { traditional: "开", simplified: "开", pengim: "kui1", tone: 1, gloss: "to open", mandarin: "kāi", freq: 52, source: "community-verified", confidence: 0.94 },
  { traditional: "关", simplified: "关", pengim: "guêng1", tone: 1, gloss: "to close / to shut", mandarin: "guān", freq: 53, source: "community-verified", confidence: 0.94 },
  { traditional: "会", simplified: "会", pengim: "oi6", tone: 6, gloss: "can / know how to / will", mandarin: "huì", example: "我会写字 (I can write)", freq: 54, source: "community-verified", confidence: 0.95 },
  { traditional: "识", simplified: "识", pengim: "bag4", tone: 4, gloss: "to know (a person) / to recognize", example: "我识伊 (I know him)", freq: 55, source: "community-verified", confidence: 0.9 },
  { traditional: "记得", simplified: "记得", pengim: "gi3 dig4", tone: 3, gloss: "to remember", mandarin: "jìde", freq: 56, source: "community-verified", confidence: 0.92 },
  { traditional: "唔记得", simplified: "唔记得", pengim: "m6 gi3 dig4", tone: 6, gloss: "to forget", example: "我唔记得了 (I forgot)", freq: 57, source: "community-verified", confidence: 0.92 },
  { traditional: "做", simplified: "做", pengim: "zo3", tone: 3, gloss: "to do / to make", mandarin: "zuò", example: "做作业 (do homework)", freq: 58, source: "community-verified", confidence: 0.95 },
  { traditional: "用", simplified: "用", pengim: "êng7", tone: 7, gloss: "to use", mandarin: "yòng", freq: 59, source: "community-verified", confidence: 0.94 },
  { traditional: "帮", simplified: "帮", pengim: "bang1", tone: 1, gloss: "to help", mandarin: "bāng", example: "帮帮我 (help me)", freq: 60, source: "community-verified", confidence: 0.94 },
  { traditional: "放", simplified: "放", pengim: "bang3", tone: 3, gloss: "to put / to place / to set down", mandarin: "fàng", freq: 61, source: "community-verified", confidence: 0.93 },
  { traditional: "寻", simplified: "寻", pengim: "cim5", tone: 5, gloss: "to look for / to search", example: "寻物件 (look for things)", freq: 62, source: "community-verified", confidence: 0.9 },
  { traditional: "等", simplified: "等", pengim: "dan2", tone: 2, gloss: "to wait", mandarin: "děng", freq: 63, source: "community-verified", confidence: 0.94 },
  { traditional: "乞", simplified: "乞", pengim: "kêh4", tone: 4, gloss: "to give (also 予)", example: "乞我 (give me)", freq: 64, source: "community-verified", confidence: 0.88 },
  { traditional: "攑", simplified: "攑", pengim: "kioh8", tone: 8, gloss: "to take / to lift / to pick up", example: "攑起来 (pick it up)", freq: 65, source: "community-verified", confidence: 0.85 },
  { traditional: "洗", simplified: "洗", pengim: "soi2", tone: 2, gloss: "to wash", mandarin: "xǐ", freq: 66, source: "community-verified", confidence: 0.92 },
  { traditional: "扫", simplified: "扫", pengim: "sao3", tone: 3, gloss: "to sweep", mandarin: "sǎo", freq: 67, source: "community-verified", confidence: 0.92 },
  { traditional: "煮", simplified: "煮", pengim: "ze2", tone: 2, gloss: "to cook (boil/simmer)", mandarin: "zhǔ", freq: 68, source: "community-verified", confidence: 0.9 },
  { traditional: "食茶", simplified: "食茶", pengim: "ziah8 dê5", tone: 8, gloss: "to drink tea", freq: 69, source: "community-verified", confidence: 0.95 },
  { traditional: "哭", simplified: "哭", pengim: "kao3", tone: 3, gloss: "to cry", mandarin: "kū", freq: 70, source: "community-verified", confidence: 0.9 },
  { traditional: "笑", simplified: "笑", pengim: "cio3", tone: 3, gloss: "to laugh / to smile", mandarin: "xiào", freq: 71, source: "community-verified", confidence: 0.92 },
  { traditional: "唱", simplified: "唱", pengim: "ciang3", tone: 3, gloss: "to sing", mandarin: "chàng", freq: 72, source: "community-verified", confidence: 0.92 },
  { traditional: "跳", simplified: "跳", pengim: "tiao3", tone: 3, gloss: "to jump / to dance", mandarin: "tiào", freq: 73, source: "community-verified", confidence: 0.92 },
  { traditional: "耍", simplified: "耍", pengim: "sng2", tone: 2, gloss: "to play (games / with toys)", example: "耍电脑 (play on computer)", freq: 74, source: "community-verified", confidence: 0.88 },
  { traditional: "歇", simplified: "歇", pengim: "hiah4", tone: 4, gloss: "to rest", mandarin: "xiē", example: "歇一下 (rest a bit)", freq: 75, source: "community-verified", confidence: 0.9 },
  { traditional: "睡眠", simplified: "睡眠", pengim: "ug8 min5", tone: 8, gloss: "to sleep (formal)", example: "爱睡眠了 (time to sleep)", freq: 76, source: "llm-suggested", confidence: 0.7 },
  { traditional: "站", simplified: "站", pengim: "zam6", tone: 6, gloss: "to stand (also 徛)", mandarin: "zhàn", freq: 77, source: "llm-suggested", confidence: 0.75 },
  { traditional: "徛", simplified: "徛", pengim: "kia6", tone: 6, gloss: "to stand", example: "徛起来 (stand up)", freq: 78, source: "community-verified", confidence: 0.85 },
  // ── Common nouns ──
  { traditional: "水", simplified: "水", pengim: "zui2", tone: 2, gloss: "water", mandarin: "shuǐ", freq: 79, source: "community-verified", confidence: 0.97 },
  { traditional: "饭", simplified: "饭", pengim: "bung7", tone: 7, gloss: "cooked rice / meal", mandarin: "fàn", freq: 80, source: "community-verified", confidence: 0.96 },
  { traditional: "茶", simplified: "茶", pengim: "dê5", tone: 5, gloss: "tea", mandarin: "chá", freq: 81, source: "community-verified", confidence: 0.96 },
  { traditional: "书", simplified: "书", pengim: "ze1", tone: 1, gloss: "book", mandarin: "shū", freq: 82, source: "community-verified", confidence: 0.95 },
  { traditional: "字", simplified: "字", pengim: "ri7", tone: 7, gloss: "character / word / letter", mandarin: "zì", freq: 83, source: "community-verified", confidence: 0.95 },
  { traditional: "名", simplified: "名", pengim: "mia5", tone: 5, gloss: "name", mandarin: "míng", freq: 84, source: "community-verified", confidence: 0.95 },
  { traditional: "衫", simplified: "衫", pengim: "sa1", tone: 1, gloss: "clothes / shirt", mandarin: "shān", freq: 85, source: "community-verified", confidence: 0.93 },
  { traditional: "衫裤", simplified: "衫裤", pengim: "sa1 kou3", tone: 1, gloss: "clothes (general)", example: "买衫裤 (buy clothes)", freq: 86, source: "community-verified", confidence: 0.9 },
  { traditional: "厝", simplified: "厝", pengim: "cu3", tone: 3, gloss: "house / home", example: "返厝 (go home)", freq: 87, source: "community-verified", confidence: 0.94 },
  { traditional: "学校", simplified: "学校", pengim: "hag8 hao6", tone: 8, gloss: "school", mandarin: "xuéxiào", freq: 88, source: "community-verified", confidence: 0.96 },
  { traditional: "老师", simplified: "老师", pengim: "lao6 se1", tone: 6, gloss: "teacher", mandarin: "lǎoshī", freq: 89, source: "community-verified", confidence: 0.95 },
  { traditional: "学生", simplified: "学生", pengim: "hag8 sêng1", tone: 8, gloss: "student", mandarin: "xuésheng", freq: 90, source: "community-verified", confidence: 0.96 },
  { traditional: "同学", simplified: "同学", pengim: "dang5 hag8", tone: 5, gloss: "classmate", mandarin: "tóngxué", freq: 91, source: "community-verified", confidence: 0.95 },
  { traditional: "朋友", simplified: "朋友", pengim: "pêng5 iu2", tone: 5, gloss: "friend", mandarin: "péngyou", freq: 92, source: "community-verified", confidence: 0.96 },
  { traditional: "家己侬", simplified: "家己人", pengim: "ga1 gi7 nang5", tone: 1, gloss: "family / one's own people", freq: 93, source: "community-verified", confidence: 0.93 },
  { traditional: "阿公", simplified: "阿公", pengim: "a1 gong1", tone: 1, gloss: "grandfather (paternal)", freq: 94, source: "community-verified", confidence: 0.94 },
  { traditional: "阿妈", simplified: "阿妈", pengim: "a1 ma1", tone: 1, gloss: "grandmother / mother (dialectal)", freq: 95, source: "community-verified", confidence: 0.9 },
  { traditional: "爸", simplified: "爸", pengim: "ba5", tone: 5, gloss: "father / dad", mandarin: "bà", example: "阿爸 (dad)", freq: 96, source: "community-verified", confidence: 0.93 },
  { traditional: "妈", simplified: "妈", pengim: "ma1", tone: 1, gloss: "mother / mum", mandarin: "mā", freq: 97, source: "community-verified", confidence: 0.93 },
  { traditional: "仔", simplified: "仔", pengim: "gian2", tone: 2, gloss: "child / son / diminutive suffix", example: "孥仔 (child)", freq: 98, source: "community-verified", confidence: 0.9 },
  { traditional: "时阵", simplified: "时阵", pengim: "si5 zung5", tone: 5, gloss: "time / moment", example: "有时阵 (sometimes)", freq: 99, source: "community-verified", confidence: 0.9 },
  { traditional: "今日", simplified: "今日", pengim: "gin1 rig8", tone: 1, gloss: "today", mandarin: "jīnrì", freq: 100, source: "community-verified", confidence: 0.94 },
  { traditional: "明日", simplified: "明日", pengim: "mê5 rig8", tone: 5, gloss: "tomorrow", mandarin: "míngrì", freq: 101, source: "community-verified", confidence: 0.94 },
  { traditional: "昨日", simplified: "昨日", pengim: "zo3 rig8", tone: 3, gloss: "yesterday", mandarin: "zuórì", freq: 102, source: "community-verified", confidence: 0.94 },
  { traditional: "钱", simplified: "钱", pengim: "zin5", tone: 5, gloss: "money", mandarin: "qián", example: "几多钱？(How much?)", freq: 103, source: "community-verified", confidence: 0.95 },
  { traditional: "话", simplified: "话", pengim: "uê7", tone: 7, gloss: "speech / language", mandarin: "huà", example: "潮州话 (Teochew)", freq: 104, source: "community-verified", confidence: 0.95 },
  { traditional: "课", simplified: "课", pengim: "ko3", tone: 3, gloss: "lesson / class", mandarin: "kè", freq: 105, source: "community-verified", confidence: 0.92 },
  { traditional: "题目", simplified: "题目", pengim: "toi5 mag8", tone: 5, gloss: "question / problem (on a worksheet)", mandarin: "tímù", freq: 106, source: "community-verified", confidence: 0.9 },
  { traditional: "作业", simplified: "作业", pengim: "zag4 ngiab8", tone: 4, gloss: "homework / assignment", mandarin: "zuòyè", freq: 107, source: "community-verified", confidence: 0.93 },
  { traditional: "试卷", simplified: "试卷", pengim: "si3 geng2", tone: 3, gloss: "exam paper / test", mandarin: "shìjuàn", freq: 108, source: "community-verified", confidence: 0.9 },
  { traditional: "考试", simplified: "考试", pengim: "ko2 si3", tone: 2, gloss: "exam / test", mandarin: "kǎoshì", freq: 109, source: "community-verified", confidence: 0.93 },
  // ── Adjectives ──
  { traditional: "好", simplified: "好", pengim: "ho2", tone: 2, gloss: "good / very (degree)", mandarin: "hǎo", example: "好好 (very good)", freq: 110, source: "community-verified", confidence: 0.97 },
  { traditional: "孬", simplified: "孬", pengim: "mo2", tone: 2, gloss: "bad / not good", freq: 111, source: "community-verified", confidence: 0.93 },
  { traditional: "大", simplified: "大", pengim: "dua7", tone: 7, gloss: "big / large", mandarin: "dà", freq: 112, source: "community-verified", confidence: 0.96 },
  { traditional: "细", simplified: "细", pengim: "soi3", tone: 3, gloss: "small / little / young", mandarin: "xì", freq: 113, source: "community-verified", confidence: 0.95 },
  { traditional: "长", simplified: "长", pengim: "deng5", tone: 5, gloss: "long", mandarin: "cháng", freq: 114, source: "community-verified", confidence: 0.94 },
  { traditional: "短", simplified: "短", pengim: "do2", tone: 2, gloss: "short", mandarin: "duǎn", freq: 115, source: "community-verified", confidence: 0.94 },
  { traditional: "高", simplified: "高", pengim: "gao1", tone: 1, gloss: "tall / high", mandarin: "gāo", freq: 116, source: "community-verified", confidence: 0.95 },
  { traditional: "矮", simplified: "矮", pengim: "oi2", tone: 2, gloss: "short (height)", mandarin: "ǎi", freq: 117, source: "community-verified", confidence: 0.92 },
  { traditional: "快", simplified: "快", pengim: "kue3", tone: 3, gloss: "fast / quick", mandarin: "kuài", freq: 118, source: "community-verified", confidence: 0.94 },
  { traditional: "慢", simplified: "慢", pengim: "mang7", tone: 7, gloss: "slow", mandarin: "màn", freq: 119, source: "community-verified", confidence: 0.94 },
  { traditional: "真", simplified: "真", pengim: "zing1", tone: 1, gloss: "really / truly", mandarin: "zhēn", freq: 120, source: "community-verified", confidence: 0.94 },
  { traditional: "新", simplified: "新", pengim: "sing1", tone: 1, gloss: "new", mandarin: "xīn", freq: 121, source: "community-verified", confidence: 0.95 },
  { traditional: "旧", simplified: "旧", pengim: "gu7", tone: 7, gloss: "old (not new)", mandarin: "jiù", freq: 122, source: "community-verified", confidence: 0.94 },
  { traditional: "甜", simplified: "甜", pengim: "diam5", tone: 5, gloss: "sweet", mandarin: "tián", freq: 123, source: "community-verified", confidence: 0.94 },
  { traditional: "咸", simplified: "咸", pengim: "giam5", tone: 5, gloss: "salty", mandarin: "xián", freq: 124, source: "community-verified", confidence: 0.94 },
  { traditional: "苦", simplified: "苦", pengim: "kou2", tone: 2, gloss: "bitter / hard (life)", mandarin: "kǔ", freq: 125, source: "community-verified", confidence: 0.93 },
  { traditional: "雅", simplified: "雅", pengim: "ngia2", tone: 2, gloss: "pretty / beautiful", example: "雅孥仔 (pretty girl)", freq: 126, source: "community-verified", confidence: 0.88 },
  { traditional: "孬看", simplified: "孬看", pengim: "mo2 toin2", tone: 2, gloss: "ugly / bad-looking", freq: 127, source: "community-verified", confidence: 0.9 },
  { traditional: "欢喜", simplified: "欢喜", pengim: "huann1 hi2", tone: 1, gloss: "happy / glad", example: "我尽欢喜 (I'm very happy)", freq: 128, source: "community-verified", confidence: 0.93 },
  { traditional: "累", simplified: "累", pengim: "lui7", tone: 7, gloss: "tired", mandarin: "lèi", freq: 129, source: "llm-suggested", confidence: 0.78 },
  { traditional: "惊心", simplified: "惊心", pengim: "gia1 sim1", tone: 1, gloss: "worried / anxious", freq: 130, source: "llm-suggested", confidence: 0.75 },
  { traditional: "冷", simplified: "冷", pengim: "nin2", tone: 2, gloss: "cold (weather / feeling)", mandarin: "lěng", freq: 131, source: "community-verified", confidence: 0.9 },
  { traditional: "热", simplified: "热", pengim: "ruah8", tone: 8, gloss: "hot", mandarin: "rè", freq: 132, source: "community-verified", confidence: 0.92 },
  { traditional: "容易", simplified: "容易", pengim: "iong5 i6", tone: 5, gloss: "easy", mandarin: "róngyì", freq: 133, source: "community-verified", confidence: 0.92 },
  { traditional: "难", simplified: "难", pengim: "oh8", tone: 8, gloss: "difficult / hard", mandarin: "nán", freq: 134, source: "community-verified", confidence: 0.92 },
  { traditional: "对", simplified: "对", pengim: "dui3", tone: 3, gloss: "correct / right", mandarin: "duì", freq: 135, source: "community-verified", confidence: 0.93 },
  { traditional: "错", simplified: "错", pengim: "co3", tone: 3, gloss: "wrong / incorrect", mandarin: "cuò", freq: 136, source: "community-verified", confidence: 0.93 },
  { traditional: "多", simplified: "多", pengim: "zoi7", tone: 7, gloss: "many / much (also 㩼)", mandarin: "duō", freq: 137, source: "community-verified", confidence: 0.93 },
  { traditional: "㩼", simplified: "㩼", pengim: "zoi7", tone: 7, gloss: "many / much (dialectal)", freq: 138, source: "community-verified", confidence: 0.88 },
  { traditional: "少", simplified: "少", pengim: "zioi2", tone: 2, gloss: "few / little", mandarin: "shǎo", freq: 139, source: "community-verified", confidence: 0.92 },
  { traditional: "清气", simplified: "清气", pengim: "cêng1 ki3", tone: 1, gloss: "clean", example: "清气个衫 (clean clothes)", freq: 140, source: "community-verified", confidence: 0.88 },
  { traditional: "邋遢", simplified: "邋遢", pengim: "lah4 tah4", tone: 4, gloss: "dirty / messy", freq: 141, source: "community-verified", confidence: 0.85 },
  { traditional: "饱", simplified: "饱", pengim: "ba2", tone: 2, gloss: "full (after eating)", mandarin: "bǎo", freq: 142, source: "community-verified", confidence: 0.93 },
  { traditional: "肚困", simplified: "肚困", pengim: "dou6 kung3", tone: 6, gloss: "hungry", freq: 143, source: "community-verified", confidence: 0.88 },
  { traditional: "聪明", simplified: "聪明", pengim: "cong1 mêng5", tone: 1, gloss: "clever / smart", mandarin: "cōngming", freq: 144, source: "community-verified", confidence: 0.92 },
  { traditional: "力落", simplified: "力落", pengim: "lag8 loh8", tone: 8, gloss: "diligent / hardworking", freq: 145, source: "llm-suggested", confidence: 0.8 },
  { traditional: "认真", simplified: "认真", pengim: "ring7 zing1", tone: 7, gloss: "serious / earnest", mandarin: "rènzhēn", freq: 146, source: "community-verified", confidence: 0.92 },
  // ── Numbers ──
  { traditional: "一", simplified: "一", pengim: "zêg8", tone: 8, gloss: "one", mandarin: "yī", freq: 147, source: "community-verified", confidence: 0.98 },
  { traditional: "二", simplified: "二", pengim: "no6", tone: 6, gloss: "two", mandarin: "èr", freq: 148, source: "community-verified", confidence: 0.98 },
  { traditional: "三", simplified: "三", pengim: "san1", tone: 1, gloss: "three", mandarin: "sān", freq: 149, source: "community-verified", confidence: 0.98 },
  { traditional: "四", simplified: "四", pengim: "si3", tone: 3, gloss: "four", mandarin: "sì", freq: 150, source: "community-verified", confidence: 0.98 },
  { traditional: "五", simplified: "五", pengim: "ngou6", tone: 6, gloss: "five", mandarin: "wǔ", freq: 151, source: "community-verified", confidence: 0.98 },
  { traditional: "六", simplified: "六", pengim: "lak8", tone: 8, gloss: "six", mandarin: "liù", freq: 152, source: "community-verified", confidence: 0.98 },
  { traditional: "七", simplified: "七", pengim: "cig4", tone: 4, gloss: "seven", mandarin: "qī", freq: 153, source: "community-verified", confidence: 0.98 },
  { traditional: "八", simplified: "八", pengim: "boih4", tone: 4, gloss: "eight", mandarin: "bā", freq: 154, source: "community-verified", confidence: 0.98 },
  { traditional: "九", simplified: "九", pengim: "gao2", tone: 2, gloss: "nine", mandarin: "jiǔ", freq: 155, source: "community-verified", confidence: 0.98 },
  { traditional: "十", simplified: "十", pengim: "zab8", tone: 8, gloss: "ten", mandarin: "shí", freq: 156, source: "community-verified", confidence: 0.98 },
  { traditional: "百", simplified: "百", pengim: "bêh4", tone: 4, gloss: "hundred", mandarin: "bǎi", freq: 157, source: "community-verified", confidence: 0.96 },
  { traditional: "千", simplified: "千", pengim: "coin1", tone: 1, gloss: "thousand", mandarin: "qiān", freq: 158, source: "community-verified", confidence: 0.96 },
  { traditional: "万", simplified: "万", pengim: "bhuang7", tone: 7, gloss: "ten thousand", mandarin: "wàn", freq: 159, source: "community-verified", confidence: 0.95 },
  { traditional: "零", simplified: "零", pengim: "lêng5", tone: 5, gloss: "zero", mandarin: "líng", freq: 160, source: "community-verified", confidence: 0.95 },
  { traditional: "半", simplified: "半", pengim: "buann3", tone: 3, gloss: "half", mandarin: "bàn", freq: 161, source: "community-verified", confidence: 0.95 },
  // ── Measure words ──
  { traditional: "只", simplified: "只", pengim: "ziah4", tone: 4, gloss: "classifier for animals / one of a pair", example: "只鸡 (a chicken)", freq: 162, source: "community-verified", confidence: 0.9 },
  { traditional: "条", simplified: "条", pengim: "diao5", tone: 5, gloss: "classifier for long thin objects", mandarin: "tiáo", freq: 163, source: "community-verified", confidence: 0.9 },
  { traditional: "张", simplified: "张", pengim: "dion1", tone: 1, gloss: "classifier for flat objects (paper/table)", mandarin: "zhāng", freq: 164, source: "community-verified", confidence: 0.9 },
  { traditional: "本", simplified: "本", pengim: "bung2", tone: 2, gloss: "classifier for books", mandarin: "běn", freq: 165, source: "community-verified", confidence: 0.92 },
  { traditional: "粒", simplified: "粒", pengim: "liap8", tone: 8, gloss: "classifier for small round objects", mandarin: "lì", freq: 166, source: "community-verified", confidence: 0.9 },
  { traditional: "双", simplified: "双", pengim: "sang1", tone: 1, gloss: "classifier for pairs (shoes/hands)", mandarin: "shuāng", freq: 167, source: "community-verified", confidence: 0.92 },
  // ── Nature & weather ──
  { traditional: "雨", simplified: "雨", pengim: "hou6", tone: 6, gloss: "rain", mandarin: "yǔ", freq: 168, source: "community-verified", confidence: 0.95 },
  { traditional: "风", simplified: "风", pengim: "huang1", tone: 1, gloss: "wind", mandarin: "fēng", freq: 169, source: "community-verified", confidence: 0.95 },
  { traditional: "天", simplified: "天", pengim: "tin1", tone: 1, gloss: "sky / day", mandarin: "tiān", freq: 170, source: "community-verified", confidence: 0.96 },
  { traditional: "日", simplified: "日", pengim: "rig8", tone: 8, gloss: "sun / day", mandarin: "rì", freq: 171, source: "community-verified", confidence: 0.96 },
  { traditional: "月", simplified: "月", pengim: "gueh8", tone: 8, gloss: "moon / month", mandarin: "yuè", freq: 172, source: "community-verified", confidence: 0.96 },
  { traditional: "星", simplified: "星", pengim: "cên1", tone: 1, gloss: "star", mandarin: "xīng", freq: 173, source: "community-verified", confidence: 0.92 },
  { traditional: "云", simplified: "云", pengim: "hung5", tone: 5, gloss: "cloud", mandarin: "yún", freq: 174, source: "community-verified", confidence: 0.92 },
  { traditional: "雪", simplified: "雪", pengim: "soh4", tone: 4, gloss: "snow", mandarin: "xuě", freq: 175, source: "community-verified", confidence: 0.92 },
  { traditional: "山", simplified: "山", pengim: "sua1", tone: 1, gloss: "mountain", mandarin: "shān", freq: 176, source: "community-verified", confidence: 0.95 },
  { traditional: "海", simplified: "海", pengim: "hai2", tone: 2, gloss: "sea", mandarin: "hǎi", freq: 177, source: "community-verified", confidence: 0.95 },
  { traditional: "河", simplified: "河", pengim: "ho5", tone: 5, gloss: "river", mandarin: "hé", freq: 178, source: "community-verified", confidence: 0.95 },
  { traditional: "树", simplified: "树", pengim: "ciu7", tone: 7, gloss: "tree", mandarin: "shù", freq: 179, source: "community-verified", confidence: 0.94 },
  { traditional: "花", simplified: "花", pengim: "huê1", tone: 1, gloss: "flower", mandarin: "huā", freq: 180, source: "community-verified", confidence: 0.95 },
  { traditional: "草", simplified: "草", pengim: "cao2", tone: 2, gloss: "grass", mandarin: "cǎo", freq: 181, source: "community-verified", confidence: 0.94 },
  { traditional: "石", simplified: "石", pengim: "zioh8", tone: 8, gloss: "stone / rock", mandarin: "shí", freq: 182, source: "community-verified", confidence: 0.94 },
  { traditional: "火", simplified: "火", pengim: "huê2", tone: 2, gloss: "fire", mandarin: "huǒ", freq: 183, source: "community-verified", confidence: 0.95 },
  { traditional: "光", simplified: "光", pengim: "guang1", tone: 1, gloss: "light / bright", mandarin: "guāng", freq: 184, source: "community-verified", confidence: 0.94 },
  // ── Animals ──
  { traditional: "猫", simplified: "猫", pengim: "ngiao1", tone: 1, gloss: "cat", mandarin: "māo", freq: 185, source: "community-verified", confidence: 0.95 },
  { traditional: "狗", simplified: "狗", pengim: "kao2", tone: 2, gloss: "dog", mandarin: "gǒu", freq: 186, source: "community-verified", confidence: 0.96 },
  { traditional: "鸡", simplified: "鸡", pengim: "goi1", tone: 1, gloss: "chicken", mandarin: "jī", freq: 187, source: "community-verified", confidence: 0.95 },
  { traditional: "牛", simplified: "牛", pengim: "ghu5", tone: 5, gloss: "cow / ox", mandarin: "niú", freq: 188, source: "community-verified", confidence: 0.95 },
  { traditional: "猪", simplified: "猪", pengim: "de1", tone: 1, gloss: "pig", mandarin: "zhū", freq: 189, source: "community-verified", confidence: 0.94 },
  { traditional: "羊", simplified: "羊", pengim: "iên5", tone: 5, gloss: "sheep / goat", mandarin: "yáng", freq: 190, source: "community-verified", confidence: 0.94 },
  { traditional: "马", simplified: "马", pengim: "bhê2", tone: 2, gloss: "horse", mandarin: "mǎ", freq: 191, source: "community-verified", confidence: 0.94 },
  { traditional: "鸟", simplified: "鸟", pengim: "ziao2", tone: 2, gloss: "bird", mandarin: "niǎo", freq: 192, source: "community-verified", confidence: 0.94 },
  { traditional: "鱼", simplified: "鱼", pengim: "he5", tone: 5, gloss: "fish", mandarin: "yú", freq: 193, source: "community-verified", confidence: 0.95 },
  { traditional: "虫", simplified: "虫", pengim: "tang5", tone: 5, gloss: "bug / insect", mandarin: "chóng", freq: 194, source: "community-verified", confidence: 0.93 },
  // ── Food & drink ──
  { traditional: "菜", simplified: "菜", pengim: "cai3", tone: 3, gloss: "vegetable / dish", mandarin: "cài", freq: 195, source: "community-verified", confidence: 0.95 },
  { traditional: "肉", simplified: "肉", pengim: "nêg8", tone: 8, gloss: "meat", mandarin: "ròu", freq: 196, source: "community-verified", confidence: 0.94 },
  { traditional: "蛋", simplified: "蛋", pengim: "nung6", tone: 6, gloss: "egg", mandarin: "dàn", freq: 198, source: "community-verified", confidence: 0.92 },
  { traditional: "汤", simplified: "汤", pengim: "teng1", tone: 1, gloss: "soup", mandarin: "tāng", freq: 199, source: "community-verified", confidence: 0.94 },
  { traditional: "糖", simplified: "糖", pengim: "teng5", tone: 5, gloss: "sugar / candy", mandarin: "táng", freq: 201, source: "community-verified", confidence: 0.93 },
  { traditional: "盐", simplified: "盐", pengim: "iam5", tone: 5, gloss: "salt", mandarin: "yán", freq: 202, source: "community-verified", confidence: 0.93 },
  { traditional: "油", simplified: "油", pengim: "iu5", tone: 5, gloss: "oil", mandarin: "yóu", freq: 203, source: "community-verified", confidence: 0.93 },
  { traditional: "水果", simplified: "水果", pengim: "zui2 guê2", tone: 2, gloss: "fruit", mandarin: "shuǐguǒ", freq: 204, source: "community-verified", confidence: 0.92 },
  { traditional: "苹果", simplified: "苹果", pengim: "pêng5 guê2", tone: 5, gloss: "apple", mandarin: "píngguǒ", freq: 205, source: "community-verified", confidence: 0.92 },
  { traditional: "牛奶", simplified: "牛奶", pengim: "ghu5 ni1", tone: 5, gloss: "milk", mandarin: "niúnǎi", freq: 206, source: "community-verified", confidence: 0.9 },
  { traditional: "粥", simplified: "粥", pengim: "muê5", tone: 5, gloss: "rice congee / porridge", mandarin: "zhōu", freq: 207, source: "community-verified", confidence: 0.9 },
  // ── Time & date ──
  { traditional: "点钟", simplified: "点钟", pengim: "diam2 zêng1", tone: 2, gloss: "o'clock / hour", example: "几点钟？(What time?)", freq: 208, source: "community-verified", confidence: 0.9 },
  { traditional: "分", simplified: "分", pengim: "hung1", tone: 1, gloss: "minute", mandarin: "fēn", freq: 209, source: "community-verified", confidence: 0.93 },
  { traditional: "年", simplified: "年", pengim: "ni5", tone: 5, gloss: "year", mandarin: "nián", freq: 210, source: "community-verified", confidence: 0.95 },
  { traditional: "礼拜", simplified: "礼拜", pengim: "loi2 bai3", tone: 2, gloss: "week / Sunday", mandarin: "lǐbài", freq: 211, source: "community-verified", confidence: 0.9 },
  { traditional: "礼拜一", simplified: "礼拜一", pengim: "loi2 bai3 ig4", tone: 2, gloss: "Monday", freq: 212, source: "community-verified", confidence: 0.88 },
  { traditional: "礼拜二", simplified: "礼拜二", pengim: "loi2 bai3 no6", tone: 2, gloss: "Tuesday", freq: 213, source: "community-verified", confidence: 0.88 },
  { traditional: "礼拜三", simplified: "礼拜三", pengim: "loi2 bai3 san1", tone: 2, gloss: "Wednesday", freq: 214, source: "community-verified", confidence: 0.88 },
  { traditional: "礼拜四", simplified: "礼拜四", pengim: "loi2 bai3 si3", tone: 2, gloss: "Thursday", freq: 215, source: "community-verified", confidence: 0.88 },
  { traditional: "礼拜五", simplified: "礼拜五", pengim: "loi2 bai3 ngou6", tone: 2, gloss: "Friday", freq: 216, source: "community-verified", confidence: 0.88 },
  { traditional: "礼拜六", simplified: "礼拜六", pengim: "loi2 bai3 lak8", tone: 2, gloss: "Saturday", freq: 217, source: "community-verified", confidence: 0.88 },
  // ── Home & household ──
  { traditional: "门", simplified: "门", pengim: "mung5", tone: 5, gloss: "door", mandarin: "mén", freq: 218, source: "community-verified", confidence: 0.95 },
  { traditional: "窗", simplified: "窗", pengim: "têng1", tone: 1, gloss: "window", mandarin: "chuāng", freq: 219, source: "community-verified", confidence: 0.92 },
  { traditional: "床", simplified: "床", pengim: "ceng5", tone: 5, gloss: "bed", mandarin: "chuáng", freq: 220, source: "community-verified", confidence: 0.95 },
  { traditional: "桌", simplified: "桌", pengim: "doh4", tone: 4, gloss: "table / desk", mandarin: "zhuō", freq: 221, source: "community-verified", confidence: 0.94 },
  { traditional: "椅", simplified: "椅", pengim: "i2", tone: 2, gloss: "chair", mandarin: "yǐ", freq: 222, source: "community-verified", confidence: 0.94 },
  { traditional: "灯", simplified: "灯", pengim: "dêng1", tone: 1, gloss: "lamp / light", mandarin: "dēng", freq: 223, source: "community-verified", confidence: 0.94 },
  { traditional: "房间", simplified: "房间", pengim: "pang5 goin1", tone: 5, gloss: "room", mandarin: "fángjiān", freq: 224, source: "community-verified", confidence: 0.92 },
  { traditional: "电视", simplified: "电视", pengim: "dian6 si6", tone: 6, gloss: "television / TV", mandarin: "diànshì", freq: 225, source: "community-verified", confidence: 0.92 },
  { traditional: "电话", simplified: "电话", pengim: "dian6 uê7", tone: 6, gloss: "telephone", mandarin: "diànhuà", freq: 226, source: "community-verified", confidence: 0.92 },
  { traditional: "电脑", simplified: "电脑", pengim: "dian6 nao2", tone: 6, gloss: "computer", mandarin: "diànnǎo", freq: 227, source: "community-verified", confidence: 0.92 },
  // ── Body ──
  { traditional: "头", simplified: "头", pengim: "tao5", tone: 5, gloss: "head", mandarin: "tóu", freq: 228, source: "community-verified", confidence: 0.95 },
  { traditional: "目", simplified: "目", pengim: "mag8", tone: 8, gloss: "eye", example: "目珠 (eye)", freq: 229, source: "community-verified", confidence: 0.92 },
  { traditional: "耳", simplified: "耳", pengim: "hi6", tone: 6, gloss: "ear", mandarin: "ěr", freq: 230, source: "community-verified", confidence: 0.92 },
  { traditional: "鼻", simplified: "鼻", pengim: "pin7", tone: 7, gloss: "nose", mandarin: "bí", freq: 231, source: "community-verified", confidence: 0.92 },
  { traditional: "嘴", simplified: "嘴", pengim: "cui3", tone: 3, gloss: "mouth", mandarin: "zuǐ", freq: 232, source: "community-verified", confidence: 0.92 },
  { traditional: "手", simplified: "手", pengim: "ciu2", tone: 2, gloss: "hand", mandarin: "shǒu", freq: 233, source: "community-verified", confidence: 0.96 },
  { traditional: "脚", simplified: "脚", pengim: "ka1", tone: 1, gloss: "foot / leg", mandarin: "jiǎo", freq: 234, source: "community-verified", confidence: 0.94 },
  { traditional: "心", simplified: "心", pengim: "sim1", tone: 1, gloss: "heart", mandarin: "xīn", freq: 235, source: "community-verified", confidence: 0.94 },
  { traditional: "面", simplified: "面", pengim: "min7", tone: 7, gloss: "face / noodles (same written form)", mandarin: "miàn", freq: 236, source: "community-verified", confidence: 0.93 },
  // ── Transport ──
  { traditional: "车", simplified: "车", pengim: "cia1", tone: 1, gloss: "car / vehicle", mandarin: "chē", freq: 237, source: "community-verified", confidence: 0.95 },
  { traditional: "火车", simplified: "火车", pengim: "huê2 cia1", tone: 2, gloss: "train", mandarin: "huǒchē", freq: 238, source: "community-verified", confidence: 0.93 },
  { traditional: "飞机", simplified: "飞机", pengim: "bue1 gi1", tone: 1, gloss: "airplane", mandarin: "fēijī", freq: 239, source: "community-verified", confidence: 0.93 },
  { traditional: "船", simplified: "船", pengim: "zung5", tone: 5, gloss: "boat / ship", mandarin: "chuán", freq: 240, source: "community-verified", confidence: 0.94 },
  { traditional: "路", simplified: "路", pengim: "lou7", tone: 7, gloss: "road / path", mandarin: "lù", freq: 241, source: "community-verified", confidence: 0.94 },
  // ── Everyday phrases ──
  { traditional: "汝好", simplified: "汝好", pengim: "le2 ho2", tone: 2, gloss: "hello / hi", freq: 242, source: "community-verified", confidence: 0.97 },
  { traditional: "你好", simplified: "你好", pengim: "le2 ho2", tone: 2, gloss: "hello / hi (common written form)", freq: 243, source: "community-verified", confidence: 0.97 },
  { traditional: "㩼谢", simplified: "㩼谢", pengim: "zoi7 sia7", tone: 7, gloss: "thank you", example: "㩼谢汝 (thank you)", freq: 244, source: "community-verified", confidence: 0.94 },
  { traditional: "多谢", simplified: "多谢", pengim: "do1 sia7", tone: 1, gloss: "thanks (many thanks)", mandarin: "duōxiè", freq: 245, source: "community-verified", confidence: 0.93 },
  { traditional: "对唔住", simplified: "对唔住", pengim: "dui3 m6 zu6", tone: 3, gloss: "sorry / excuse me", freq: 246, source: "community-verified", confidence: 0.94 },
  { traditional: "无相干", simplified: "无相干", pengim: "bho5 siang1 guan1", tone: 5, gloss: "no problem / it's OK / doesn't matter", freq: 247, source: "community-verified", confidence: 0.92 },
  { traditional: "唔知", simplified: "唔知", pengim: "m6 zai1", tone: 6, gloss: "don't know", freq: 248, source: "community-verified", confidence: 0.95 },
  { traditional: "唔好", simplified: "唔好", pengim: "m6 ho2", tone: 6, gloss: "not good / don't", freq: 249, source: "community-verified", confidence: 0.93 },
  { traditional: "好食", simplified: "好食", pengim: "ho2 ziah8", tone: 2, gloss: "delicious / tasty", freq: 250, source: "community-verified", confidence: 0.94 },
  { traditional: "食饭", simplified: "食饭", pengim: "ziah8 bung7", tone: 8, gloss: "to eat a meal / have rice", freq: 251, source: "community-verified", confidence: 0.96 },
  { traditional: "潮州话", simplified: "潮州话", pengim: "dio5 ziu1 uê7", tone: 5, gloss: "the Teochew language", freq: 252, source: "community-verified", confidence: 0.96 },
  { traditional: "普通话", simplified: "普通话", pengim: "pu2 tong1 uê7", tone: 2, gloss: "Mandarin Chinese", mandarin: "pǔtōnghuà", freq: 253, source: "community-verified", confidence: 0.95 },
  { traditional: "英语", simplified: "英语", pengim: "êng1 ghi2", tone: 1, gloss: "English (language)", mandarin: "yīngyǔ", freq: 254, source: "community-verified", confidence: 0.95 },
  { traditional: "做得", simplified: "做得", pengim: "zo3 dig4", tone: 3, gloss: "OK / that works / can do", freq: 255, source: "community-verified", confidence: 0.94 },
  { traditional: "做功课", simplified: "做功课", pengim: "zo3 gang1 ko3", tone: 3, gloss: "to do homework", freq: 256, source: "community-verified", confidence: 0.9 },
  { traditional: "做作业", simplified: "做作业", pengim: "zo3 zag4 ngiab8", tone: 3, gloss: "to do homework / assignment", freq: 257, source: "community-verified", confidence: 0.92 },
  { traditional: "再会", simplified: "再会", pengim: "zai3 huê6", tone: 3, gloss: "goodbye (see you again)", mandarin: "zàihuì", freq: 258, source: "community-verified", confidence: 0.9 },
  { traditional: "拜拜", simplified: "拜拜", pengim: "bai1 bai1", tone: 1, gloss: "bye-bye", freq: 259, source: "community-verified", confidence: 0.95 },
  { traditional: "请", simplified: "请", pengim: "ciang2", tone: 2, gloss: "please", mandarin: "qǐng", freq: 260, source: "community-verified", confidence: 0.93 },
  { traditional: "免客气", simplified: "免客气", pengim: "mian2 kêh4 ki3", tone: 2, gloss: "you're welcome / no need to be polite", freq: 261, source: "community-verified", confidence: 0.9 },
  { traditional: "加油", simplified: "加油", pengim: "ga1 iu5", tone: 1, gloss: "keep going / come on (encouragement)", mandarin: "jiāyóu", freq: 262, source: "community-verified", confidence: 0.92 },
  { traditional: "小心", simplified: "小心", pengim: "sio2 sim1", tone: 2, gloss: "be careful", mandarin: "xiǎoxīn", freq: 263, source: "community-verified", confidence: 0.92 },
  { traditional: "慢慢来", simplified: "慢慢来", pengim: "mang7 mang7 lai5", tone: 7, gloss: "take your time / go slowly", freq: 264, source: "community-verified", confidence: 0.92 },
  { traditional: "听无", simplified: "听无", pengim: "tia1 bho5", tone: 1, gloss: "didn't catch / don't understand", example: "我听无 (I didn't catch that)", freq: 265, source: "community-verified", confidence: 0.88 },
  { traditional: "明白了", simplified: "明白了", pengim: "mêng5 bag4 liao2", tone: 5, gloss: "understand now / got it", freq: 266, source: "community-verified", confidence: 0.9 },
  { traditional: "唔使", simplified: "唔使", pengim: "m6 sai2", tone: 6, gloss: "no need / don't have to", freq: 267, source: "community-verified", confidence: 0.92 },
  { traditional: "爱食", simplified: "爱食", pengim: "ain3 ziah8", tone: 3, gloss: "want to eat / like to eat", freq: 268, source: "community-verified", confidence: 0.93 },
  { traditional: "好个", simplified: "好个", pengim: "ho2 gai7", tone: 2, gloss: "good one / that's good", freq: 269, source: "community-verified", confidence: 0.9 },
  { traditional: "正确", simplified: "正确", pengim: "zian3 kêg4", tone: 3, gloss: "correct / right", mandarin: "zhèngquè", freq: 270, source: "community-verified", confidence: 0.93 },
  { traditional: "答案", simplified: "答案", pengim: "dab4 an3", tone: 4, gloss: "answer (to a question)", mandarin: "dá'àn", freq: 271, source: "community-verified", confidence: 0.92 },
  // ── More verbs (daily actions) ──
  { traditional: "上堂", simplified: "上堂", pengim: "sion6 deng5", tone: 6, gloss: "to attend class", example: "上堂了 (class is on)", freq: 272, source: "community-verified", confidence: 0.85 },
  { traditional: "落堂", simplified: "落堂", pengim: "loh8 deng5", tone: 8, gloss: "class dismissed / to finish class", freq: 273, source: "community-verified", confidence: 0.85 },
  { traditional: "起身", simplified: "起身", pengim: "ki2 sing1", tone: 2, gloss: "to get up", example: "爱起身了 (time to get up)", freq: 274, source: "community-verified", confidence: 0.88 },
  { traditional: "洗面", simplified: "洗面", pengim: "soi2 min7", tone: 2, gloss: "to wash one's face", freq: 275, source: "community-verified", confidence: 0.85 },
  { traditional: "返厝", simplified: "返厝", pengim: "deng2 cu3", tone: 2, gloss: "to go home / return home", freq: 276, source: "community-verified", confidence: 0.9 },
  { traditional: "出门", simplified: "出门", pengim: "cug4 mung5", tone: 4, gloss: "to go out / leave home", mandarin: "chūmén", freq: 277, source: "community-verified", confidence: 0.9 },
  { traditional: "入来", simplified: "入来", pengim: "rib8 lai5", tone: 8, gloss: "to come in", mandarin: "rùlái", freq: 278, source: "community-verified", confidence: 0.88 },
  { traditional: "出去", simplified: "出去", pengim: "cug4 ke3", tone: 4, gloss: "to go out", mandarin: "chūqù", freq: 279, source: "community-verified", confidence: 0.92 },
  { traditional: "开始", simplified: "开始", pengim: "kai1 si2", tone: 1, gloss: "to begin / to start", mandarin: "kāishǐ", freq: 280, source: "community-verified", confidence: 0.92 },
  { traditional: "完成", simplified: "完成", pengim: "uang5 sêng5", tone: 5, gloss: "to finish / to complete", mandarin: "wánchéng", freq: 281, source: "community-verified", confidence: 0.92 },
  { traditional: "准备", simplified: "准备", pengim: "zung2 bi6", tone: 2, gloss: "to prepare / to get ready", mandarin: "zhǔnbèi", freq: 282, source: "community-verified", confidence: 0.92 },
  { traditional: "认识", simplified: "认识", pengim: "ring7 si7", tone: 7, gloss: "to know / to be acquainted with", mandarin: "rènshi", freq: 283, source: "community-verified", confidence: 0.9 },
  { traditional: "觉得", simplified: "觉得", pengim: "gag4 dig4", tone: 4, gloss: "to feel / to think (opinion)", mandarin: "juéde", freq: 284, source: "community-verified", confidence: 0.9 },
  { traditional: "需要", simplified: "需要", pengim: "su1 iau3", tone: 1, gloss: "to need / to require", mandarin: "xūyào", freq: 285, source: "community-verified", confidence: 0.92 },
  { traditional: "应该", simplified: "应该", pengim: "êng1 gai1", tone: 1, gloss: "should / ought to", mandarin: "yīnggāi", freq: 286, source: "community-verified", confidence: 0.92 },
  { traditional: "相信", simplified: "相信", pengim: "siang1 sing3", tone: 1, gloss: "to believe / to trust", mandarin: "xiāngxìn", freq: 287, source: "community-verified", confidence: 0.9 },
  { traditional: "借", simplified: "借", pengim: "zioh4", tone: 4, gloss: "to borrow / to lend", mandarin: "jiè", freq: 288, source: "community-verified", confidence: 0.92 },
  { traditional: "收到", simplified: "收到", pengim: "siu1 gao3", tone: 1, gloss: "to receive / to get", mandarin: "shōudào", freq: 289, source: "community-verified", confidence: 0.92 },
  { traditional: "爬", simplified: "爬", pengim: "bê5", tone: 5, gloss: "to climb / to crawl", mandarin: "pá", freq: 290, source: "community-verified", confidence: 0.88 },
  { traditional: "飞", simplified: "飞", pengim: "bue1", tone: 1, gloss: "to fly", mandarin: "fēi", freq: 291, source: "community-verified", confidence: 0.92 },
  { traditional: "泅水", simplified: "泅水", pengim: "siu5 zui2", tone: 5, gloss: "to swim", freq: 292, source: "community-verified", confidence: 0.85 },
  { traditional: "跌倒", simplified: "跌倒", pengim: "buah8 do2", tone: 8, gloss: "to fall down / to trip", freq: 293, source: "llm-suggested", confidence: 0.78 },
  { traditional: "拍", simplified: "拍", pengim: "pah4", tone: 4, gloss: "to hit / to beat / to play (ball)", example: "拍球 (play ball)", freq: 294, source: "community-verified", confidence: 0.9 },
  { traditional: "念", simplified: "念", pengim: "niam6", tone: 6, gloss: "to read aloud / to recite", mandarin: "niàn", freq: 295, source: "community-verified", confidence: 0.9 },
  { traditional: "画", simplified: "画", pengim: "uê7", tone: 7, gloss: "to draw / to paint", mandarin: "huà", freq: 296, source: "community-verified", confidence: 0.92 },
  { traditional: "试", simplified: "试", pengim: "ci3", tone: 3, gloss: "to try / to attempt", mandarin: "shì", example: "试一下 (give it a try)", freq: 297, source: "community-verified", confidence: 0.92 },
  { traditional: "算", simplified: "算", pengim: "sng3", tone: 3, gloss: "to calculate / to count", mandarin: "suàn", freq: 298, source: "community-verified", confidence: 0.9 },
  { traditional: "计数", simplified: "计数", pengim: "gi3 su3", tone: 3, gloss: "to count / to compute", freq: 299, source: "community-verified", confidence: 0.85 },
  { traditional: "揾", simplified: "揾", pengim: "ngang2", tone: 2, gloss: "to look for / to seek", example: "揾对象 (look for something)", freq: 300, source: "llm-suggested", confidence: 0.75 },
  { traditional: "应付", simplified: "应付", pengim: "êng3 hu3", tone: 3, gloss: "to cope / to deal with", mandarin: "yìngfù", freq: 301, source: "community-verified", confidence: 0.88 },
  { traditional: "答应", simplified: "答应", pengim: "dab4 êng3", tone: 4, gloss: "to promise / to agree", mandarin: "dāyìng", freq: 302, source: "community-verified", confidence: 0.9 },
  { traditional: "请假", simplified: "请假", pengim: "cian2 kê3", tone: 2, gloss: "to ask for leave", mandarin: "qǐngjià", freq: 303, source: "community-verified", confidence: 0.9 },
  { traditional: "做早", simplified: "做早", pengim: "zo3 za2", tone: 3, gloss: "to be early / arrive early", freq: 304, source: "llm-suggested", confidence: 0.7 },
  // ── Body parts (more) ──
  { traditional: "目珠", simplified: "目珠", pengim: "mag8 ziu1", tone: 8, gloss: "eye (colloquial)", example: "目珠红 (red eyes)", freq: 305, source: "community-verified", confidence: 0.9 },
  { traditional: "头毛", simplified: "头毛", pengim: "tao5 mo5", tone: 5, gloss: "hair (on head)", freq: 306, source: "community-verified", confidence: 0.88 },
  { traditional: "鼻空", simplified: "鼻空", pengim: "pin7 kang1", tone: 7, gloss: "nose (colloquial)", freq: 307, source: "community-verified", confidence: 0.88 },
  { traditional: "齿", simplified: "齿", pengim: "ki2", tone: 2, gloss: "tooth", mandarin: "chǐ", freq: 308, source: "community-verified", confidence: 0.9 },
  { traditional: "舌", simplified: "舌", pengim: "zih8", tone: 8, gloss: "tongue", mandarin: "shé", freq: 309, source: "community-verified", confidence: 0.92 },
  { traditional: "頷", simplified: "颔", pengim: "am6", tone: 6, gloss: "neck", freq: 310, source: "llm-suggested", confidence: 0.75 },
  { traditional: "肩头", simplified: "肩头", pengim: "goin1 tao5", tone: 1, gloss: "shoulder", freq: 311, source: "llm-suggested", confidence: 0.7 },
  { traditional: "肚", simplified: "肚", pengim: "dou6", tone: 6, gloss: "belly / stomach", example: "肚困 (hungry)", freq: 312, source: "community-verified", confidence: 0.9 },
  { traditional: "腰", simplified: "腰", pengim: "io1", tone: 1, gloss: "waist", mandarin: "yāo", freq: 313, source: "community-verified", confidence: 0.9 },
  { traditional: "脚腿", simplified: "脚腿", pengim: "ka1 tui2", tone: 1, gloss: "leg", freq: 314, source: "llm-suggested", confidence: 0.75 },
  { traditional: "手尾指", simplified: "手尾指", pengim: "ciu2 bhuê2 zoi2", tone: 2, gloss: "little finger", freq: 315, source: "llm-suggested", confidence: 0.65 },
  // ── Family (more) ──
  { traditional: "阿兄", simplified: "阿兄", pengim: "a1 hia1", tone: 1, gloss: "elder brother", freq: 316, source: "community-verified", confidence: 0.92 },
  { traditional: "阿弟", simplified: "阿弟", pengim: "a1 di6", tone: 1, gloss: "younger brother", freq: 317, source: "community-verified", confidence: 0.92 },
  { traditional: "阿姐", simplified: "阿姐", pengim: "a1 ze2", tone: 1, gloss: "elder sister", freq: 318, source: "community-verified", confidence: 0.92 },
  { traditional: "阿妹", simplified: "阿妹", pengim: "a1 muê7", tone: 1, gloss: "younger sister", freq: 319, source: "community-verified", confidence: 0.92 },
  { traditional: "阿叔", simplified: "阿叔", pengim: "a1 zêg4", tone: 1, gloss: "uncle (father's younger brother)", freq: 320, source: "community-verified", confidence: 0.9 },
  { traditional: "阿姨", simplified: "阿姨", pengim: "a1 i5", tone: 1, gloss: "aunt (mother's sister) / lady", freq: 321, source: "community-verified", confidence: 0.9 },
  { traditional: "阿爸", simplified: "阿爸", pengim: "a1 ba5", tone: 1, gloss: "father / dad", freq: 322, source: "community-verified", confidence: 0.94 },
  { traditional: "翁", simplified: "翁", pengim: "ang1", tone: 1, gloss: "husband", freq: 324, source: "community-verified", confidence: 0.85 },
  { traditional: "妻", simplified: "妻", pengim: "ci1", tone: 1, gloss: "wife", mandarin: "qī", freq: 325, source: "community-verified", confidence: 0.9 },
  // ── School & study (more) ──
  { traditional: "校长", simplified: "校长", pengim: "hao6 dion2", tone: 6, gloss: "school principal", mandarin: "xiàozhǎng", freq: 326, source: "community-verified", confidence: 0.9 },
  { traditional: "课本", simplified: "课本", pengim: "ko3 bung2", tone: 3, gloss: "textbook", mandarin: "kèběn", freq: 327, source: "community-verified", confidence: 0.92 },
  { traditional: "笔", simplified: "笔", pengim: "big4", tone: 4, gloss: "pen", mandarin: "bǐ", freq: 328, source: "community-verified", confidence: 0.94 },
  { traditional: "铅笔", simplified: "铅笔", pengim: "ing5 big4", tone: 5, gloss: "pencil", mandarin: "qiānbǐ", freq: 329, source: "community-verified", confidence: 0.92 },
  { traditional: "纸", simplified: "纸", pengim: "zua2", tone: 2, gloss: "paper", mandarin: "zhǐ", freq: 330, source: "community-verified", confidence: 0.94 },
  { traditional: "书包", simplified: "书包", pengim: "ze1 bao1", tone: 1, gloss: "schoolbag", mandarin: "shūbāo", freq: 331, source: "community-verified", confidence: 0.92 },
  { traditional: "教室", simplified: "教室", pengim: "ga3 sig4", tone: 3, gloss: "classroom", mandarin: "jiàoshì", freq: 332, source: "community-verified", confidence: 0.9 },
  { traditional: "操场", simplified: "操场", pengim: "cao1 dion5", tone: 1, gloss: "playground", mandarin: "cāochǎng", freq: 333, source: "community-verified", confidence: 0.9 },
  { traditional: "数学", simplified: "数学", pengim: "sou3 hag8", tone: 3, gloss: "mathematics", mandarin: "shùxué", freq: 334, source: "community-verified", confidence: 0.94 },
  { traditional: "语文", simplified: "语文", pengim: "ghi2 bhung5", tone: 2, gloss: "Chinese language (subject)", mandarin: "yǔwén", freq: 335, source: "community-verified", confidence: 0.9 },
  { traditional: "科学", simplified: "科学", pengim: "kuê1 hag8", tone: 1, gloss: "science", mandarin: "kēxué", freq: 336, source: "community-verified", confidence: 0.92 },
  { traditional: "历史", simplified: "历史", pengim: "lig8 si2", tone: 8, gloss: "history", mandarin: "lìshǐ", freq: 337, source: "community-verified", confidence: 0.92 },
  { traditional: "音乐", simplified: "音乐", pengim: "ngim1 gah8", tone: 1, gloss: "music", mandarin: "yīnyuè", freq: 338, source: "community-verified", confidence: 0.92 },
  { traditional: "美术", simplified: "美术", pengim: "mi2 sug8", tone: 2, gloss: "art (subject)", mandarin: "měishù", freq: 339, source: "community-verified", confidence: 0.9 },
  { traditional: "分数", simplified: "分数", pengim: "hung1 su3", tone: 1, gloss: "score / mark / fraction", mandarin: "fēnshù", freq: 340, source: "community-verified", confidence: 0.9 },
  { traditional: "及格", simplified: "及格", pengim: "gib8 gah4", tone: 8, gloss: "to pass (a test)", mandarin: "jígé", freq: 341, source: "community-verified", confidence: 0.9 },
  { traditional: "练习", simplified: "练习", pengim: "liang6 sip8", tone: 6, gloss: "to practice / exercise", mandarin: "liànxí", freq: 342, source: "community-verified", confidence: 0.9 },
  { traditional: "听写", simplified: "听写", pengim: "tia1 sia2", tone: 1, gloss: "dictation (school exercise)", mandarin: "tīngxiě", freq: 343, source: "community-verified", confidence: 0.9 },
  // ── Time (more) ──
  { traditional: "后日", simplified: "后日", pengim: "ao6 rig8", tone: 6, gloss: "the day after tomorrow", freq: 344, source: "community-verified", confidence: 0.9 },
  { traditional: "前日", simplified: "前日", pengim: "zoin5 rig8", tone: 5, gloss: "the day before yesterday", freq: 345, source: "community-verified", confidence: 0.9 },
  { traditional: "早起", simplified: "早起", pengim: "za2 ki2", tone: 2, gloss: "morning", example: "早起食饭 (eat breakfast in the morning)", freq: 346, source: "community-verified", confidence: 0.85 },
  { traditional: "日昼", simplified: "日昼", pengim: "rig8 dao3", tone: 8, gloss: "noon / midday", freq: 347, source: "community-verified", confidence: 0.85 },
  { traditional: "下昼", simplified: "下昼", pengim: "ê6 dao3", tone: 6, gloss: "afternoon", freq: 348, source: "community-verified", confidence: 0.85 },
  { traditional: "夜昏", simplified: "夜昏", pengim: "mê5 hng1", tone: 5, gloss: "evening / night", freq: 349, source: "community-verified", confidence: 0.85 },
  { traditional: "现在", simplified: "现在", pengim: "hin7 zai6", tone: 7, gloss: "now", mandarin: "xiànzài", freq: 350, source: "community-verified", confidence: 0.92 },
  { traditional: "过去", simplified: "过去", pengim: "gue3 ke3", tone: 3, gloss: "the past", mandarin: "guòqù", freq: 351, source: "community-verified", confidence: 0.92 },
  { traditional: "将来", simplified: "将来", pengim: "ziang1 lai5", tone: 1, gloss: "the future", mandarin: "jiānglái", freq: 352, source: "community-verified", confidence: 0.9 },
  { traditional: "马上", simplified: "马上", pengim: "bhê2 siong6", tone: 2, gloss: "immediately / right away", mandarin: "mǎshàng", freq: 353, source: "community-verified", confidence: 0.9 },
  { traditional: "秒", simplified: "秒", pengim: "miou2", tone: 2, gloss: "second (time unit)", mandarin: "miǎo", freq: 354, source: "community-verified", confidence: 0.92 },
  { traditional: "点", simplified: "点", pengim: "diam2", tone: 2, gloss: "o'clock / dot / point", mandarin: "diǎn", example: "三点 (three o'clock)", freq: 355, source: "community-verified", confidence: 0.92 },
  // ── Nature (more) ──
  { traditional: "日头", simplified: "日头", pengim: "rig8 tao5", tone: 8, gloss: "sun (colloquial)", example: "日头大 (the sun is strong)", freq: 356, source: "community-verified", confidence: 0.88 },
  { traditional: "雷", simplified: "雷", pengim: "lui5", tone: 5, gloss: "thunder", mandarin: "léi", freq: 357, source: "community-verified", confidence: 0.9 },
  { traditional: "闪电", simplified: "闪电", pengim: "siam2 dian6", tone: 2, gloss: "lightning", mandarin: "shǎndiàn", freq: 358, source: "community-verified", confidence: 0.9 },
  { traditional: "沙", simplified: "沙", pengim: "sua1", tone: 1, gloss: "sand", mandarin: "shā", freq: 359, source: "community-verified", confidence: 0.92 },
  { traditional: "金", simplified: "金", pengim: "gim1", tone: 1, gloss: "gold", mandarin: "jīn", freq: 360, source: "community-verified", confidence: 0.94 },
  { traditional: "银", simplified: "银", pengim: "ngeng5", tone: 5, gloss: "silver", mandarin: "yín", freq: 361, source: "community-verified", confidence: 0.92 },
  // ── Animals (more) ──
  { traditional: "老虎", simplified: "老虎", pengim: "lao6 hou2", tone: 6, gloss: "tiger", mandarin: "lǎohǔ", freq: 362, source: "community-verified", confidence: 0.92 },
  { traditional: "猴", simplified: "猴", pengim: "gao5", tone: 5, gloss: "monkey", mandarin: "hóu", freq: 363, source: "community-verified", confidence: 0.92 },
  { traditional: "兔", simplified: "兔", pengim: "tou3", tone: 3, gloss: "rabbit", mandarin: "tù", freq: 364, source: "community-verified", confidence: 0.92 },
  { traditional: "蛇", simplified: "蛇", pengim: "zua5", tone: 5, gloss: "snake", mandarin: "shé", freq: 365, source: "community-verified", confidence: 0.92 },
  { traditional: "鸭", simplified: "鸭", pengim: "ah4", tone: 4, gloss: "duck", mandarin: "yā", freq: 366, source: "community-verified", confidence: 0.92 },
  { traditional: "虾", simplified: "虾", pengim: "hê5", tone: 5, gloss: "shrimp / prawn", mandarin: "xiā", freq: 367, source: "community-verified", confidence: 0.9 },
  { traditional: "蚂蚁", simplified: "蚂蚁", pengim: "hia6", tone: 6, gloss: "ant", mandarin: "mǎyǐ", freq: 368, source: "community-verified", confidence: 0.85 },
  { traditional: "鸟仔", simplified: "鸟仔", pengim: "ziao2 gian2", tone: 2, gloss: "little bird", freq: 369, source: "community-verified", confidence: 0.85 },
  // ── Food (more) ──
  { traditional: "早饭", simplified: "早饭", pengim: "za2 bung7", tone: 2, gloss: "breakfast", mandarin: "zǎofàn", freq: 370, source: "community-verified", confidence: 0.9 },
  { traditional: "昼饭", simplified: "昼饭", pengim: "dao3 bung7", tone: 3, gloss: "lunch", freq: 371, source: "community-verified", confidence: 0.85 },
  { traditional: "夜饭", simplified: "夜饭", pengim: "mê5 bung7", tone: 5, gloss: "dinner / supper", freq: 372, source: "community-verified", confidence: 0.85 },
  { traditional: "饼", simplified: "饼", pengim: "bian2", tone: 2, gloss: "biscuit / cake / pastry", mandarin: "bǐng", freq: 373, source: "community-verified", confidence: 0.9 },
  { traditional: "面包", simplified: "面包", pengim: "min7 bao1", tone: 7, gloss: "bread", mandarin: "miànbāo", freq: 374, source: "community-verified", confidence: 0.92 },
  { traditional: "雪糕", simplified: "雪糕", pengim: "soh4 go1", tone: 4, gloss: "ice cream", freq: 375, source: "community-verified", confidence: 0.88 },
  { traditional: "糖仔", simplified: "糖仔", pengim: "teng5 gian2", tone: 5, gloss: "candy / sweets", freq: 376, source: "community-verified", confidence: 0.85 },
  { traditional: "水果仔", simplified: "水果仔", pengim: "zui2 guê2 gian2", tone: 2, gloss: "small fruit / berries", freq: 377, source: "llm-suggested", confidence: 0.7 },
  // ── Home (more) ──
  { traditional: "锁匙", simplified: "锁匙", pengim: "so2 si5", tone: 2, gloss: "key", freq: 378, source: "community-verified", confidence: 0.85 },
  { traditional: "垃圾桶", simplified: "垃圾桶", pengim: "lah4 sab4 thang1", tone: 4, gloss: "trash can", freq: 379, source: "community-verified", confidence: 0.8 },
  { traditional: "电灯", simplified: "电灯", pengim: "dian6 dêng1", tone: 6, gloss: "electric light / lamp", mandarin: "diàndēng", freq: 380, source: "community-verified", confidence: 0.92 },
  { traditional: "楼梯", simplified: "楼梯", pengim: "lao5 toi1", tone: 5, gloss: "stairs", mandarin: "lóutī", freq: 381, source: "community-verified", confidence: 0.9 },
  { traditional: "浴堂", simplified: "浴堂", pengim: "iog8 teng5", tone: 8, gloss: "bathroom", freq: 382, source: "llm-suggested", confidence: 0.7 },
  { traditional: "楼", simplified: "楼", pengim: "lao5", tone: 5, gloss: "floor / building / upstairs", mandarin: "lóu", freq: 383, source: "community-verified", confidence: 0.9 },
  { traditional: "冰箱", simplified: "冰箱", pengim: "bian1 sion1", tone: 1, gloss: "refrigerator", mandarin: "bīngxiāng", freq: 384, source: "community-verified", confidence: 0.92 },
  // ── Places & services ──
  { traditional: "银行", simplified: "银行", pengim: "ngeng5 hang5", tone: 5, gloss: "bank", mandarin: "yínháng", freq: 385, source: "community-verified", confidence: 0.9 },
  { traditional: "店", simplified: "店", pengim: "diam3", tone: 3, gloss: "shop / store", mandarin: "diàn", freq: 386, source: "community-verified", confidence: 0.92 },
  { traditional: "市场", simplified: "市场", pengim: "ci6 dion5", tone: 6, gloss: "market", mandarin: "shìchǎng", freq: 387, source: "community-verified", confidence: 0.9 },
  { traditional: "公园", simplified: "公园", pengim: "gong1 hng5", tone: 1, gloss: "park", mandarin: "gōngyuán", freq: 388, source: "community-verified", confidence: 0.9 },
  { traditional: "医院", simplified: "医院", pengim: "i1 in7", tone: 1, gloss: "hospital", mandarin: "yīyuàn", freq: 389, source: "community-verified", confidence: 0.9 },
  { traditional: "医生", simplified: "医生", pengim: "i1 sêng1", tone: 1, gloss: "doctor", mandarin: "yīshēng", freq: 390, source: "community-verified", confidence: 0.92 },
  { traditional: "药", simplified: "药", pengim: "ioh8", tone: 8, gloss: "medicine", mandarin: "yào", freq: 391, source: "community-verified", confidence: 0.92 },
  { traditional: "饭店", simplified: "饭店", pengim: "pang6 diam3", tone: 6, gloss: "restaurant", mandarin: "fàndiàn", freq: 392, source: "community-verified", confidence: 0.9 },
  { traditional: "图书馆", simplified: "图书馆", pengim: "dou5 su1 guang2", tone: 5, gloss: "library", mandarin: "túshūguǎn", freq: 393, source: "community-verified", confidence: 0.9 },
  // ── More adjectives ──
  { traditional: "肥", simplified: "肥", pengim: "bui5", tone: 5, gloss: "fat / plump (people/animals)", mandarin: "féi", freq: 394, source: "community-verified", confidence: 0.92 },
  { traditional: "瘦", simplified: "瘦", pengim: "sou3", tone: 3, gloss: "thin / skinny", mandarin: "shòu", freq: 395, source: "community-verified", confidence: 0.92 },
  { traditional: "后生", simplified: "后生", pengim: "hau6 sên1", tone: 6, gloss: "young", example: "后生仔 (young man)", freq: 396, source: "community-verified", confidence: 0.88 },
  { traditional: "老", simplified: "老", pengim: "lao6", tone: 6, gloss: "old (person)", mandarin: "lǎo", freq: 397, source: "community-verified", confidence: 0.94 },
  { traditional: "重要", simplified: "重要", pengim: "diang6 iau3", tone: 6, gloss: "important", mandarin: "zhòngyào", freq: 398, source: "community-verified", confidence: 0.92 },
  { traditional: "简单", simplified: "简单", pengim: "gang1 dang1", tone: 1, gloss: "simple", mandarin: "jiǎndān", freq: 399, source: "community-verified", confidence: 0.92 },
  { traditional: "复杂", simplified: "复杂", pengim: "hog8 zab8", tone: 8, gloss: "complicated", mandarin: "fùzá", freq: 400, source: "community-verified", confidence: 0.92 },
  { traditional: "安全", simplified: "安全", pengim: "an1 ceng5", tone: 1, gloss: "safe / safety", mandarin: "ānquán", freq: 401, source: "community-verified", confidence: 0.92 },
  { traditional: "危险", simplified: "危险", pengim: "ngui6 hiam2", tone: 6, gloss: "dangerous", mandarin: "wēixiǎn", freq: 402, source: "community-verified", confidence: 0.92 },
  { traditional: "便宜", simplified: "便宜", pengim: "boin5 gi5", tone: 5, gloss: "cheap", mandarin: "piányi", freq: 403, source: "community-verified", confidence: 0.88 },
  { traditional: "贵", simplified: "贵", pengim: "gui3", tone: 3, gloss: "expensive", mandarin: "guì", freq: 404, source: "community-verified", confidence: 0.94 },
  { traditional: "新鲜", simplified: "新鲜", pengim: "sing1 si1", tone: 1, gloss: "fresh", mandarin: "xīnxiān", freq: 405, source: "community-verified", confidence: 0.92 },
  { traditional: "远", simplified: "远", pengim: "hng6", tone: 6, gloss: "far", mandarin: "yuǎn", freq: 406, source: "community-verified", confidence: 0.92 },
  { traditional: "近", simplified: "近", pengim: "gêng6", tone: 6, gloss: "near", mandarin: "jìn", freq: 407, source: "community-verified", confidence: 0.92 },
  { traditional: "深", simplified: "深", pengim: "cim1", tone: 1, gloss: "deep", mandarin: "shēn", freq: 408, source: "community-verified", confidence: 0.9 },
  { traditional: "浅", simplified: "浅", pengim: "cian2", tone: 2, gloss: "shallow", mandarin: "qiǎn", freq: 409, source: "community-verified", confidence: 0.9 },
  { traditional: "重", simplified: "重", pengim: "dang6", tone: 6, gloss: "heavy", mandarin: "zhòng", freq: 410, source: "community-verified", confidence: 0.92 },
  { traditional: "轻", simplified: "轻", pengim: "king1", tone: 1, gloss: "light (weight)", mandarin: "qīng", freq: 411, source: "community-verified", confidence: 0.92 },
  { traditional: "硬", simplified: "硬", pengim: "ngên6", tone: 6, gloss: "hard / stiff", mandarin: "yìng", freq: 412, source: "community-verified", confidence: 0.9 },
  { traditional: "软", simplified: "软", pengim: "neng2", tone: 2, gloss: "soft", mandarin: "ruǎn", freq: 413, source: "community-verified", confidence: 0.9 },
  { traditional: "满", simplified: "满", pengim: "mua2", tone: 2, gloss: "full", mandarin: "mǎn", freq: 414, source: "community-verified", confidence: 0.9 },
  { traditional: "空", simplified: "空", pengim: "kang1", tone: 1, gloss: "empty", mandarin: "kōng", freq: 415, source: "community-verified", confidence: 0.92 },
  { traditional: "有趣", simplified: "有趣", pengim: "u6 cu3", tone: 6, gloss: "interesting / fun", mandarin: "yǒuqù", freq: 416, source: "community-verified", confidence: 0.9 },
  { traditional: "无聊", simplified: "无聊", pengim: "bho5 liao5", tone: 5, gloss: "boring", mandarin: "wúliáo", freq: 417, source: "community-verified", confidence: 0.9 },
  { traditional: "强壮", simplified: "强壮", pengim: "kiang5 zang3", tone: 5, gloss: "strong / robust", mandarin: "qiángzhuàng", freq: 418, source: "community-verified", confidence: 0.9 },
  { traditional: "弱", simplified: "弱", pengim: "riag8", tone: 8, gloss: "weak", mandarin: "ruò", freq: 419, source: "community-verified", confidence: 0.9 },
  { traditional: "奇怪", simplified: "奇怪", pengim: "ki5 guai3", tone: 5, gloss: "strange / odd", mandarin: "qíguài", freq: 420, source: "community-verified", confidence: 0.92 },
  // ── Adverbs / conjunctions / particles (more) ──
  { traditional: "更", simplified: "更", pengim: "gêng3", tone: 3, gloss: "even more", mandarin: "gèng", freq: 421, source: "community-verified", confidence: 0.92 },
  { traditional: "最", simplified: "最", pengim: "zuê3", tone: 3, gloss: "the most", mandarin: "zuì", freq: 422, source: "community-verified", confidence: 0.92 },
  { traditional: "太", simplified: "太", pengim: "tai3", tone: 3, gloss: "too (excessively)", mandarin: "tài", freq: 423, source: "community-verified", confidence: 0.92 },
  { traditional: "非常", simplified: "非常", pengim: "hui1 siang5", tone: 1, gloss: "extremely / very", mandarin: "fēicháng", freq: 424, source: "community-verified", confidence: 0.92 },
  { traditional: "还", simplified: "还", pengim: "hain5", tone: 5, gloss: "still / yet / also", mandarin: "hái", freq: 425, source: "community-verified", confidence: 0.9 },
  { traditional: "再", simplified: "再", pengim: "zai3", tone: 3, gloss: "again / once more", mandarin: "zài", freq: 426, source: "community-verified", confidence: 0.92 },
  { traditional: "又", simplified: "又", pengim: "iu6", tone: 6, gloss: "again / also (again)", mandarin: "yòu", freq: 427, source: "community-verified", confidence: 0.9 },
  { traditional: "也", simplified: "也", pengim: "a7", tone: 7, gloss: "also / too", mandarin: "yě", freq: 428, source: "community-verified", confidence: 0.88 },
  { traditional: "都", simplified: "都", pengim: "dou1", tone: 1, gloss: "all / both / entirely", mandarin: "dōu", freq: 429, source: "community-verified", confidence: 0.9 },
  { traditional: "就", simplified: "就", pengim: "ziu6", tone: 6, gloss: "then / right away / exactly", mandarin: "jiù", freq: 430, source: "community-verified", confidence: 0.9 },
  { traditional: "一齐", simplified: "一齐", pengim: "zêg8 toi5", tone: 8, gloss: "together / at the same time", example: "一齐去 (go together)", freq: 431, source: "community-verified", confidence: 0.88 },
  { traditional: "做伙", simplified: "做伙", pengim: "zo3 huê2", tone: 3, gloss: "together (dialectal)", freq: 432, source: "community-verified", confidence: 0.85 },
  { traditional: "然后", simplified: "然后", pengim: "zin5 ao6", tone: 5, gloss: "then / afterwards", mandarin: "ránhòu", freq: 433, source: "community-verified", confidence: 0.9 },
  { traditional: "因为", simplified: "因为", pengim: "ing1 ui5", tone: 1, gloss: "because", mandarin: "yīnwèi", freq: 434, source: "community-verified", confidence: 0.92 },
  { traditional: "所以", simplified: "所以", pengim: "so2 i2", tone: 2, gloss: "therefore / so", mandarin: "suǒyǐ", freq: 435, source: "community-verified", confidence: 0.92 },
  { traditional: "但是", simplified: "但是", pengim: "dan6 si6", tone: 6, gloss: "but / however", mandarin: "dànshì", freq: 436, source: "community-verified", confidence: 0.92 },
  { traditional: "如果", simplified: "如果", pengim: "ri5 guê2", tone: 5, gloss: "if", mandarin: "rúguǒ", freq: 437, source: "community-verified", confidence: 0.92 },
  { traditional: "可能", simplified: "可能", pengim: "ko2 nêng5", tone: 2, gloss: "maybe / possibly", mandarin: "kěnéng", freq: 438, source: "community-verified", confidence: 0.92 },
  { traditional: "一定", simplified: "一定", pengim: "zêg8 dian7", tone: 8, gloss: "definitely / certainly", mandarin: "yídìng", freq: 439, source: "community-verified", confidence: 0.92 },
  // ── Classroom phrases / tutoring commands ──
  { traditional: "睇下只题", simplified: "睇下这题", pengim: "toin2 ê6 zi2 toi5", tone: 2, gloss: "look at this question", freq: 440, source: "community-verified", confidence: 0.88 },
  { traditional: "想一下", simplified: "想一下", pengim: "sion2 zêg8 ê6", tone: 2, gloss: "think about it a moment", freq: 441, source: "community-verified", confidence: 0.92 },
  { traditional: "试一下", simplified: "试一下", pengim: "ci3 zêg8 ê6", tone: 3, gloss: "give it a try", freq: 442, source: "community-verified", confidence: 0.92 },
  { traditional: "慢慢想", simplified: "慢慢想", pengim: "mang7 mang7 sion2", tone: 7, gloss: "take your time thinking", freq: 443, source: "community-verified", confidence: 0.9 },
  { traditional: "做得好", simplified: "做得好", pengim: "zo3 dig4 ho2", tone: 3, gloss: "well done / good job", freq: 444, source: "community-verified", confidence: 0.92 },
  { traditional: "好厉害", simplified: "好厉害", pengim: "ho2 li6 hai7", tone: 2, gloss: "amazing / great job", freq: 445, source: "community-verified", confidence: 0.9 },
  { traditional: "继续", simplified: "继续", pengim: "gi3 sog8", tone: 3, gloss: "continue / keep going", mandarin: "jìxù", freq: 446, source: "community-verified", confidence: 0.9 },
  { traditional: "再来一次", simplified: "再来一次", pengim: "zai3 lai5 zêg8 zu3", tone: 3, gloss: "try once more", freq: 447, source: "community-verified", confidence: 0.9 },
  { traditional: "大声读", simplified: "大声读", pengim: "dua7 sian1 tag8", tone: 7, gloss: "read aloud loudly", freq: 448, source: "community-verified", confidence: 0.85 },
  { traditional: "睇此块", simplified: "看这里", pengim: "toin2 zi2 go3", tone: 2, gloss: "look here", freq: 449, source: "community-verified", confidence: 0.88 },
  { traditional: "听我讲", simplified: "听我讲", pengim: "tia1 ua2 gong2", tone: 1, gloss: "listen to me", freq: 450, source: "community-verified", confidence: 0.92 },
  { traditional: "佮我来", simplified: "跟我来", pengim: "gah4 ua2 lai5", tone: 4, gloss: "come with me", freq: 451, source: "community-verified", confidence: 0.88 },
  { traditional: "坐下来", simplified: "坐下来", pengim: "zo6 ê6 lai5", tone: 6, gloss: "sit down", freq: 452, source: "community-verified", confidence: 0.9 },
  { traditional: "徛起来", simplified: "站起来", pengim: "kia6 ki2 lai5", tone: 6, gloss: "stand up", freq: 453, source: "community-verified", confidence: 0.88 },
  { traditional: "勿惊", simplified: "别怕", pengim: "mai3 gia1", tone: 3, gloss: "don't be afraid", freq: 454, source: "community-verified", confidence: 0.92 },
  { traditional: "勿紧张", simplified: "别紧张", pengim: "mai3 gin2 dion1", tone: 3, gloss: "don't be nervous", freq: 455, source: "community-verified", confidence: 0.88 },
  { traditional: "甲我知", simplified: "告诉我", pengim: "gah4 ua2 zai1", tone: 4, gloss: "tell me", freq: 456, source: "community-verified", confidence: 0.88 },
  { traditional: "我知道了", simplified: "我知道了", pengim: "ua2 zai1 liao2", tone: 2, gloss: "I understand now / got it", freq: 457, source: "community-verified", confidence: 0.9 },
  { traditional: "食未", simplified: "食未", pengim: "ziah8 bhuê7", tone: 8, gloss: "have you eaten? (greeting)", freq: 458, source: "community-verified", confidence: 0.88 },
  { traditional: "再见", simplified: "再见", pengim: "zai3 gin3", tone: 3, gloss: "goodbye", mandarin: "zàijiàn", freq: 459, source: "community-verified", confidence: 0.94 },
  { traditional: "生日快乐", simplified: "生日快乐", pengim: "sên1 rig8 kuai3 log8", tone: 1, gloss: "happy birthday", freq: 460, source: "community-verified", confidence: 0.92 },
  { traditional: "新年快乐", simplified: "新年快乐", pengim: "sing1 ni5 kuai3 log8", tone: 1, gloss: "happy new year", freq: 461, source: "community-verified", confidence: 0.92 },
  { traditional: "恭喜", simplified: "恭喜", pengim: "giong1 hi2", tone: 1, gloss: "congratulations", mandarin: "gōngxǐ", freq: 462, source: "community-verified", confidence: 0.92 },
  { traditional: "平安", simplified: "平安", pengim: "pêng5 uan1", tone: 5, gloss: "safe and sound / peace", mandarin: "píng'ān", freq: 463, source: "community-verified", confidence: 0.9 },
  { traditional: "身体健康", simplified: "身体健康", pengim: "sing1 tai6 giang6 kang1", tone: 1, gloss: "good health", freq: 464, source: "community-verified", confidence: 0.88 },
  // ── Time / clock (more) ──
  { traditional: "点钟半", simplified: "点半", pengim: "diam2 zêng1 buann3", tone: 2, gloss: "half past the hour", freq: 465, source: "community-verified", confidence: 0.85 },
  { traditional: "早", simplified: "早", pengim: "za2", tone: 2, gloss: "early / soon", mandarin: "zǎo", freq: 466, source: "community-verified", confidence: 0.92 },
  { traditional: "晏", simplified: "晏", pengim: "uan3", tone: 3, gloss: "late (time)", example: "来晏了 (came late)", freq: 467, source: "community-verified", confidence: 0.85 },
  { traditional: "一夜", simplified: "一夜", pengim: "zêg8 mê5", tone: 8, gloss: "all night / one night", freq: 468, source: "community-verified", confidence: 0.88 },
  { traditional: "一日", simplified: "一日", pengim: "zêg8 rig8", tone: 8, gloss: "one day / all day", freq: 469, source: "community-verified", confidence: 0.9 },
  // ── Colors ──
  { traditional: "红", simplified: "红", pengim: "ang5", tone: 5, gloss: "red", mandarin: "hóng", freq: 470, source: "community-verified", confidence: 0.94 },
  { traditional: "黄", simplified: "黄", pengim: "ng5", tone: 5, gloss: "yellow", mandarin: "huáng", freq: 471, source: "community-verified", confidence: 0.92 },
  { traditional: "白", simplified: "白", pengim: "bêh8", tone: 8, gloss: "white", mandarin: "bái", freq: 472, source: "community-verified", confidence: 0.94 },
  { traditional: "乌", simplified: "乌", pengim: "ou1", tone: 1, gloss: "black (dialectal)", freq: 473, source: "community-verified", confidence: 0.9 },
  { traditional: "黑", simplified: "黑", pengim: "o1", tone: 1, gloss: "black (standard)", mandarin: "hēi", freq: 474, source: "community-verified", confidence: 0.9 },
  { traditional: "蓝", simplified: "蓝", pengim: "nam5", tone: 5, gloss: "blue", mandarin: "lán", freq: 475, source: "community-verified", confidence: 0.92 },
  { traditional: "绿", simplified: "绿", pengim: "lêg8", tone: 8, gloss: "green", mandarin: "lǜ", freq: 476, source: "community-verified", confidence: 0.92 },
  { traditional: "青", simplified: "青", pengim: "cên1", tone: 1, gloss: "green / blue-green / young", mandarin: "qīng", freq: 477, source: "community-verified", confidence: 0.9 },
  { traditional: "紫", simplified: "紫", pengim: "zi2", tone: 2, gloss: "purple", mandarin: "zǐ", freq: 478, source: "community-verified", confidence: 0.9 },
  { traditional: "颜色", simplified: "颜色", pengim: "ngang5 sêg4", tone: 5, gloss: "color", mandarin: "yánsè", freq: 479, source: "community-verified", confidence: 0.92 },
  // ── Clothes & accessories ──
  { traditional: "帽", simplified: "帽", pengim: "bho7", tone: 7, gloss: "hat / cap", mandarin: "mào", freq: 480, source: "community-verified", confidence: 0.92 },
  { traditional: "鞋", simplified: "鞋", pengim: "oi5", tone: 5, gloss: "shoes", mandarin: "xié", freq: 481, source: "community-verified", confidence: 0.92 },
  { traditional: "袜", simplified: "袜", pengim: "guêh8", tone: 8, gloss: "socks / stockings", mandarin: "wà", freq: 482, source: "community-verified", confidence: 0.9 },
  { traditional: "裤", simplified: "裤", pengim: "kou3", tone: 3, gloss: "trousers / pants", mandarin: "kù", freq: 483, source: "community-verified", confidence: 0.9 },
  { traditional: "裙", simplified: "裙", pengim: "gung5", tone: 5, gloss: "skirt / dress", mandarin: "qún", freq: 484, source: "community-verified", confidence: 0.9 },
  { traditional: "首饰", simplified: "首饰", pengim: "siu2 sig4", tone: 2, gloss: "jewelry", mandarin: "shǒushì", freq: 485, source: "community-verified", confidence: 0.88 },
  // ── Abstract / misc nouns ──
  { traditional: "道理", simplified: "道理", pengim: "dao6 li2", tone: 6, gloss: "reason / logic / principle", mandarin: "dàolǐ", freq: 486, source: "community-verified", confidence: 0.9 },
  { traditional: "意思", simplified: "意思", pengim: "i3 se1", tone: 3, gloss: "meaning", mandarin: "yìsi", example: "乜个意思？(What does it mean?)", freq: 487, source: "community-verified", confidence: 0.92 },
  { traditional: "办法", simplified: "办法", pengim: "pang6 huab4", tone: 6, gloss: "method / way / solution", mandarin: "bànfǎ", freq: 488, source: "community-verified", confidence: 0.92 },
  { traditional: "问题", simplified: "问题", pengim: "mung7 toi5", tone: 7, gloss: "question / problem", mandarin: "wèntí", freq: 489, source: "community-verified", confidence: 0.94 },
  { traditional: "主意", simplified: "主意", pengim: "zu2 i3", tone: 2, gloss: "idea / plan", mandarin: "zhǔyì", freq: 491, source: "community-verified", confidence: 0.9 },
  { traditional: "时间", simplified: "时间", pengim: "si5 gang1", tone: 5, gloss: "time", mandarin: "shíjiān", freq: 492, source: "community-verified", confidence: 0.92 },
  { traditional: "地方", simplified: "地方", pengim: "di7 hng1", tone: 7, gloss: "place / location", mandarin: "dìfāng", freq: 493, source: "community-verified", confidence: 0.92 },
  { traditional: "天气", simplified: "天气", pengim: "tin1 ki3", tone: 1, gloss: "weather", mandarin: "tiānqì", freq: 494, source: "community-verified", confidence: 0.92 },
  { traditional: "事情", simplified: "事情", pengim: "se7 cêng5", tone: 7, gloss: "matter / affair / thing", mandarin: "shìqing", freq: 495, source: "community-verified", confidence: 0.9 },
  // ── More tutoring phrases ──
  { traditional: "慢慢来无要紧", simplified: "慢慢来不要紧", pengim: "mang7 mang7 lai5 bho5 iau3 gin2", tone: 7, gloss: "take it easy, no rush", freq: 496, source: "community-verified", confidence: 0.85 },
  { traditional: "这道题不会做", simplified: "这道题不会做", pengim: "zi2 dao6 toi5 m6 oi6 zo3", tone: 2, gloss: "I can't solve this question", freq: 497, source: "community-verified", confidence: 0.85 },
  { traditional: "甲汝讲", simplified: "告诉你", pengim: "gah4 le2 gong2", tone: 4, gloss: "tell you / let me tell you", freq: 498, source: "community-verified", confidence: 0.85 },
  { traditional: "睇清楚", simplified: "看清楚", pengim: "toin2 cêng1 co2", tone: 2, gloss: "look carefully", freq: 499, source: "community-verified", confidence: 0.85 },
  { traditional: "做对了", simplified: "做对了", pengim: "zo3 dui3 liao2", tone: 3, gloss: "that's correct", freq: 500, source: "community-verified", confidence: 0.88 },
  // ── Extra common Teochew tokens ──
  { traditional: "猛", simplified: "猛", pengim: "mên2", tone: 2, gloss: "fast / quick (dialectal)", example: "行猛点 (walk faster)", freq: 501, source: "community-verified", confidence: 0.85 },
  { traditional: "刣", simplified: "刣", pengim: "tai5", tone: 5, gloss: "to kill / to slaughter", freq: 502, source: "llm-suggested", confidence: 0.7 },
  { traditional: "伓", simplified: "伓", pengim: "ng6", tone: 6, gloss: "not (variant of 唔)", freq: 503, source: "llm-suggested", confidence: 0.7 },
  { traditional: "乜个事", simplified: "乜个事", pengim: "mih4 gai5 se7", tone: 4, gloss: "what's the matter", freq: 504, source: "community-verified", confidence: 0.88 },
  { traditional: "风台", simplified: "风台", pengim: "huang1 tai1", tone: 1, gloss: "typhoon", example: "风台来 (a typhoon is coming)", freq: 505, source: "community-verified", confidence: 0.88 },
  { traditional: "日昼时", simplified: "日昼时", pengim: "rig8 dao3 si5", tone: 8, gloss: "noontime / at noon", freq: 506, source: "llm-suggested", confidence: 0.7 },
  { traditional: "物件", simplified: "物件", pengim: "muêh8 gian6", tone: 8, gloss: "things / stuff / object", example: "买物件 (buy things)", freq: 507, source: "community-verified", confidence: 0.85 },
  { traditional: "歇困", simplified: "歇困", pengim: "hiah4 kung3", tone: 4, gloss: "to sleep / to rest (dialectal)", freq: 508, source: "llm-suggested", confidence: 0.65 },
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
    if (b.entry.confidence !== a.entry.confidence)
      return b.entry.confidence - a.entry.confidence;
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
