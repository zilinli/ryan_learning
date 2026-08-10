/**
 * Local Hakka (客家话 / 客语) dictionary dataset.
 *
 * Curated seed lexicon for learners, based on the Taiwan Ministry of
 * Education "臺灣客家語書寫推薦用字" standard where available, plus the
 * common mainland online written forms (涯, 冇, 唔, 麼个) that appear in
 * actual Hakka writing. Romanization uses the Taiwan Hakka Pinyin (四县腔)
 * with tone marks, which is the most widely documented scheme.
 *
 * Each entry is graded with a `source` tag and a 0-1 `confidence` so the
 * frontend can sort by trust and native speakers can review low-confidence
 * rows first (see docs/subsystems/dialect-eval-set.md).
 *
 * Sources consulted:
 * - 教育部臺灣客家語常用詞辭典 (hakkadict.moe.edu.tw)
 * - 臺灣客家語書寫推薦用字 (Ministry of Education, Taiwan)
 * - Hakka 800-word vocabulary list (客家委員會)
 *
 * Notes:
 * - 涯 (ngaiˇ, "I") is the common online form; the formal standard is 𠊎.
 * - 佢 (giˇ, "he/she") matches the Cantonese character.
 * - 个 (ge) is the possessive marker, same character as Cantonese/Hokkien.
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
  /** Provenance / trust grading */
  source: "moe-standard" | "community-verified" | "llm-suggested";
  /** 0-1 — probability the written form & reading are correct */
  confidence: number;
};

/** Curated subset of common Hakka words & particles for learners. */
export const HAKKA_DICT: HakkaEntry[] = [
  // ══ Pronouns & function words ══
  { traditional: "涯", simplified: "涯", roman: "ngaiˇ", gloss: "I / me (common online form; formal: 𠊎)", example: "涯个书 (my book)", freq: 1, source: "community-verified", confidence: 0.95 },
  { traditional: "𠊎", simplified: "𠊎", roman: "ngaiˇ", gloss: "I / me (formal recommended character)", freq: 2, source: "moe-standard", confidence: 0.8 },
  { traditional: "你", simplified: "你", roman: "nˇ", gloss: "you", mandarin: "nǐ", freq: 3, source: "community-verified", confidence: 0.97 },
  { traditional: "佢", simplified: "佢", roman: "giˇ", gloss: "he / him / she / her / it", example: "佢係老师 (he is a teacher)", freq: 4, source: "community-verified", confidence: 0.94 },
  { traditional: "个", simplified: "个", roman: "ge", gloss: "possessive particle (的)", example: "涯个名 (my name)", freq: 5, source: "community-verified", confidence: 0.97 },
  { traditional: "毋", simplified: "毋", roman: "mˇ", gloss: "not (negation)", example: "毋係 (is not)", freq: 6, source: "moe-standard", confidence: 0.95 },
  { traditional: "唔", simplified: "唔", roman: "mˇ", gloss: "not (negation, common variant of 毋)", example: "唔知 (don't know)", freq: 7, source: "community-verified", confidence: 0.95 },
  { traditional: "冇", simplified: "冇", roman: "moˇ", gloss: "don't have / there isn't", example: "冇错 (no mistake)", freq: 8, source: "community-verified", confidence: 0.94 },
  { traditional: "有", simplified: "有", roman: "iuˊ", gloss: "to have / there is", mandarin: "yǒu", freq: 9, source: "community-verified", confidence: 0.97 },
  { traditional: "係", simplified: "系", roman: "he", gloss: "to be (is/am/are)", example: "係呀 (yes it is)", freq: 10, source: "community-verified", confidence: 0.96 },
  { traditional: "毋係", simplified: "毋系", roman: "mˇ he", gloss: "no / is not", freq: 11, source: "moe-standard", confidence: 0.93 },
  { traditional: "莫", simplified: "莫", roman: "mog", gloss: "don't (prohibition)", example: "莫惊 (don't be scared)", freq: 12, source: "community-verified", confidence: 0.93 },
  { traditional: "摎", simplified: "摎", roman: "lauˊ", gloss: "and / with (conjunction)", example: "涯摎你 (you and I)", freq: 13, source: "moe-standard", confidence: 0.88 },
  { traditional: "恁", simplified: "恁", roman: "anˋ", gloss: "so / this (degree)", example: "恁好 (so good)", freq: 14, source: "moe-standard", confidence: 0.85 },
  { traditional: "當", simplified: "当", roman: "dongˊ", gloss: "very (degree)", example: "當好 (very good)", freq: 15, source: "moe-standard", confidence: 0.92 },
  { traditional: "自家", simplified: "自家", roman: "cii gaˊ", gloss: "oneself / by oneself", example: "自家做 (do it yourself)", freq: 16, source: "moe-standard", confidence: 0.9 },
  { traditional: "大家", simplified: "大家", roman: "tai gaˊ", gloss: "everyone", mandarin: "dàjiā", freq: 17, source: "community-verified", confidence: 0.93 },
  { traditional: "別儕", simplified: "别人", roman: "pedˇ saˇ", gloss: "others / other people", freq: 18, source: "moe-standard", confidence: 0.85 },
  { traditional: "麼儕", simplified: "么人", roman: "maˋ saˇ", gloss: "who", example: "麼儕來？(Who came?)", freq: 19, source: "moe-standard", confidence: 0.85 },
  // ── Question words ──
  { traditional: "麼个", simplified: "么个", roman: "maˋ ge", gloss: "what", example: "麼个东西？(What thing?)", freq: 20, source: "community-verified", confidence: 0.94 },
  { traditional: "仰般", simplified: "仰般", roman: "ngiongˋ banˊ", gloss: "how (also 样般)", example: "仰般做？(How to do it?)", freq: 21, source: "moe-standard", confidence: 0.92 },
  { traditional: "哪位", simplified: "哪位", roman: "nai vi", gloss: "where", example: "去哪位？(Where to?)", freq: 22, source: "moe-standard", confidence: 0.9 },
  { traditional: "這", simplified: "这", roman: "iaˋ", gloss: "this", example: "這只题 (this question)", freq: 23, source: "moe-standard", confidence: 0.88 },
  { traditional: "該", simplified: "该", roman: "ge", gloss: "that", example: "該本书 (that book)", freq: 24, source: "moe-standard", confidence: 0.88 },
  { traditional: "幾多", simplified: "几多", roman: "giˋ doˊ", gloss: "how many / how much", example: "幾多錢？(How much?)", freq: 25, source: "moe-standard", confidence: 0.92 },
  { traditional: "做麼个", simplified: "做么个", roman: "zo maˋ ge", gloss: "why / what for", freq: 26, source: "moe-standard", confidence: 0.9 },
  { traditional: "幾時", simplified: "几时", roman: "giˋ siiˇ", gloss: "when", example: "幾時來？(When are you coming?)", freq: 27, source: "moe-standard", confidence: 0.92 },
  // ── Common verbs ──
  { traditional: "食", simplified: "食", roman: "siid", gloss: "to eat / to drink (one verb for both)", mandarin: "shí", example: "食饭 (eat a meal)", freq: 28, source: "community-verified", confidence: 0.97 },
  { traditional: "看", simplified: "看", roman: "kon", gloss: "to see / to look / to watch", mandarin: "kàn", freq: 29, source: "community-verified", confidence: 0.95 },
  { traditional: "䀴", simplified: "䀴", roman: "ngiangˋ", gloss: "to look / to stare (Hakka-specific)", freq: 30, source: "moe-standard", confidence: 0.8 },
  { traditional: "聽", simplified: "听", roman: "tangˊ", gloss: "to listen / to hear", mandarin: "tīng", freq: 31, source: "community-verified", confidence: 0.94 },
  { traditional: "講", simplified: "讲", roman: "gongˋ", gloss: "to speak / to say", mandarin: "jiǎng", example: "講客家话 (speak Hakka)", freq: 32, source: "community-verified", confidence: 0.95 },
  { traditional: "問", simplified: "问", roman: "mun", gloss: "to ask", mandarin: "wèn", freq: 33, source: "community-verified", confidence: 0.94 },
  { traditional: "知", simplified: "知", roman: "diˊ", gloss: "to know", mandarin: "zhī", example: "毋知 (don't know)", freq: 34, source: "community-verified", confidence: 0.93 },
  { traditional: "想", simplified: "想", roman: "xiongˋ", gloss: "to think / to want", mandarin: "xiǎng", freq: 35, source: "community-verified", confidence: 0.95 },
  { traditional: "愛", simplified: "爱", roman: "oi", gloss: "to want / to love", mandarin: "ài", example: "涯愛食茶 (I like drinking tea)", freq: 36, source: "moe-standard", confidence: 0.92 },
  { traditional: "驚", simplified: "惊", roman: "giangˊ", gloss: "to be afraid", example: "莫惊 (don't be scared)", freq: 37, source: "moe-standard", confidence: 0.92 },
  { traditional: "去", simplified: "去", roman: "hi", gloss: "to go", mandarin: "qù", freq: 38, source: "community-verified", confidence: 0.96 },
  { traditional: "來", simplified: "来", roman: "loiˇ", gloss: "to come", mandarin: "lái", example: "來這 (come here)", freq: 39, source: "community-verified", confidence: 0.95 },
  { traditional: "到", simplified: "到", roman: "do", gloss: "to arrive / to reach", mandarin: "dào", example: "到學校 (arrive at school)", freq: 40, source: "community-verified", confidence: 0.92 },
  { traditional: "坐", simplified: "坐", roman: "coˊ", gloss: "to sit", mandarin: "zuò", freq: 41, source: "community-verified", confidence: 0.94 },
  { traditional: "行", simplified: "行", roman: "hangˇ", gloss: "to walk / to go (on foot)", mandarin: "xíng", freq: 42, source: "community-verified", confidence: 0.94 },
  { traditional: "走", simplified: "走", roman: "zeuˋ", gloss: "to run", mandarin: "zǒu", freq: 43, source: "community-verified", confidence: 0.9 },
  { traditional: "讀", simplified: "读", roman: "tug", gloss: "to read / to study", mandarin: "dú", example: "讀書 (study)", freq: 44, source: "community-verified", confidence: 0.95 },
  { traditional: "寫", simplified: "写", roman: "siaˋ", gloss: "to write", mandarin: "xiě", freq: 45, source: "community-verified", confidence: 0.94 },
  { traditional: "學", simplified: "学", roman: "hog", gloss: "to learn / to study", mandarin: "xué", freq: 46, source: "community-verified", confidence: 0.95 },
  { traditional: "教", simplified: "教", roman: "gau", gloss: "to teach", mandarin: "jiāo", freq: 47, source: "community-verified", confidence: 0.93 },
  { traditional: "買", simplified: "买", roman: "maiˊ", gloss: "to buy", mandarin: "mǎi", freq: 48, source: "community-verified", confidence: 0.94 },
  { traditional: "賣", simplified: "卖", roman: "mai", gloss: "to sell", mandarin: "mài", freq: 49, source: "community-verified", confidence: 0.94 },
  { traditional: "開", simplified: "开", roman: "koiˊ", gloss: "to open", mandarin: "kāi", freq: 50, source: "community-verified", confidence: 0.93 },
  { traditional: "關", simplified: "关", roman: "guanˊ", gloss: "to close / to shut", mandarin: "guān", freq: 51, source: "community-verified", confidence: 0.93 },
  { traditional: "會", simplified: "会", roman: "voi", gloss: "can / know how to / will", mandarin: "huì", example: "涯會写字 (I can write)", freq: 52, source: "community-verified", confidence: 0.95 },
  { traditional: "識", simplified: "识", roman: "siid", gloss: "to know (a person) / to recognize", example: "涯識佢 (I know him)", freq: 53, source: "moe-standard", confidence: 0.85 },
  { traditional: "記", simplified: "记", roman: "gi", gloss: "to remember / to memorize", mandarin: "jì", freq: 54, source: "community-verified", confidence: 0.92 },
  { traditional: "做", simplified: "做", roman: "zo", gloss: "to do / to make", mandarin: "zuò", example: "做作業 (do homework)", freq: 55, source: "community-verified", confidence: 0.95 },
  { traditional: "用", simplified: "用", roman: "iung", gloss: "to use", mandarin: "yòng", freq: 56, source: "community-verified", confidence: 0.93 },
  { traditional: "幫", simplified: "帮", roman: "bongˊ", gloss: "to help", mandarin: "bāng", example: "幫涯一下 (help me a moment)", freq: 57, source: "community-verified", confidence: 0.93 },
  { traditional: "放", simplified: "放", roman: "biong", gloss: "to put / to place", mandarin: "fàng", freq: 58, source: "community-verified", confidence: 0.92 },
  { traditional: "等", simplified: "等", roman: "denˋ", gloss: "to wait", mandarin: "děng", freq: 59, source: "community-verified", confidence: 0.92 },
  { traditional: "愛食", simplified: "爱食", roman: "oi siid", gloss: "want to eat / like to eat", freq: 60, source: "community-verified", confidence: 0.9 },
  { traditional: "洗", simplified: "洗", roman: "seˋ", gloss: "to wash", mandarin: "xǐ", freq: 61, source: "community-verified", confidence: 0.92 },
  { traditional: "掃", simplified: "扫", roman: "so", gloss: "to sweep", mandarin: "sǎo", freq: 62, source: "community-verified", confidence: 0.9 },
  { traditional: "煮", simplified: "煮", roman: "zuˋ", gloss: "to cook", mandarin: "zhǔ", freq: 63, source: "community-verified", confidence: 0.9 },
  { traditional: "哭", simplified: "哭", roman: "gug", gloss: "to cry", mandarin: "kū", freq: 64, source: "community-verified", confidence: 0.9 },
  { traditional: "笑", simplified: "笑", roman: "seu", gloss: "to laugh / to smile", mandarin: "xiào", freq: 65, source: "community-verified", confidence: 0.92 },
  { traditional: "唱", simplified: "唱", roman: "cong", gloss: "to sing", mandarin: "chàng", freq: 66, source: "community-verified", confidence: 0.92 },
  { traditional: "跳", simplified: "跳", roman: "tiau", gloss: "to jump", mandarin: "tiào", freq: 67, source: "community-verified", confidence: 0.9 },
  { traditional: "歇", simplified: "歇", roman: "hiedˋ", gloss: "to rest", mandarin: "xiē", example: "歇一下 (rest a bit)", freq: 68, source: "moe-standard", confidence: 0.9 },
  { traditional: "睡", simplified: "睡", roman: "sói", gloss: "to sleep", mandarin: "shuì", example: "愛睡啊 (time to sleep)", freq: 69, source: "community-verified", confidence: 0.85 },
  { traditional: "徛", simplified: "徛", roman: "kiˊ", gloss: "to stand", example: "徛起來 (stand up)", freq: 70, source: "moe-standard", confidence: 0.8 },
  // ── Common nouns ──
  { traditional: "水", simplified: "水", roman: "suiˋ", gloss: "water", mandarin: "shuǐ", freq: 71, source: "community-verified", confidence: 0.97 },
  { traditional: "飯", simplified: "饭", roman: "fan", gloss: "cooked rice / meal", mandarin: "fàn", freq: 72, source: "community-verified", confidence: 0.96 },
  { traditional: "茶", simplified: "茶", roman: "caˇ", gloss: "tea", mandarin: "chá", example: "食茶 (drink tea)", freq: 73, source: "community-verified", confidence: 0.95 },
  { traditional: "書", simplified: "书", roman: "suˊ", gloss: "book", mandarin: "shū", freq: 74, source: "community-verified", confidence: 0.94 },
  { traditional: "字", simplified: "字", roman: "sii", gloss: "character / word / letter", mandarin: "zì", freq: 75, source: "community-verified", confidence: 0.94 },
  { traditional: "名", simplified: "名", roman: "miangˇ", gloss: "name", mandarin: "míng", freq: 76, source: "community-verified", confidence: 0.94 },
  { traditional: "衫", simplified: "衫", roman: "samˊ", gloss: "clothes / shirt", mandarin: "shān", freq: 77, source: "community-verified", confidence: 0.92 },
  { traditional: "屋", simplified: "屋", roman: "vugˋ", gloss: "house", mandarin: "wū", freq: 78, source: "moe-standard", confidence: 0.93 },
  { traditional: "屋下", simplified: "屋下", roman: "vugˋ haˊ", gloss: "home (at home)", freq: 79, source: "moe-standard", confidence: 0.9 },
  { traditional: "學校", simplified: "学校", roman: "hog gau", gloss: "school", mandarin: "xuéxiào", freq: 80, source: "community-verified", confidence: 0.95 },
  { traditional: "先生", simplified: "先生", roman: "xinˊ sangˊ", gloss: "teacher (Hakka usage) / Mr.", mandarin: "xiānsheng", freq: 81, source: "community-verified", confidence: 0.9 },
  { traditional: "學生", simplified: "学生", roman: "hog sangˊ", gloss: "student", mandarin: "xuésheng", freq: 82, source: "community-verified", confidence: 0.95 },
  { traditional: "朋友", simplified: "朋友", roman: "penˇ iuˊ", gloss: "friend", mandarin: "péngyou", freq: 83, source: "community-verified", confidence: 0.95 },
  { traditional: "阿公", simplified: "阿公", roman: "aˊ gungˊ", gloss: "grandfather (paternal)", freq: 84, source: "community-verified", confidence: 0.93 },
  { traditional: "阿婆", simplified: "阿婆", roman: "aˊ poˇ", gloss: "grandmother (paternal)", freq: 85, source: "community-verified", confidence: 0.92 },
  { traditional: "細人仔", simplified: "细人仔", roman: "se nginˇ eˋ", gloss: "child / kids", freq: 86, source: "moe-standard", confidence: 0.88 },
  { traditional: "時節", simplified: "时节", roman: "siiˇ jiedˋ", gloss: "time / moment / season", example: "有時節 (sometimes)", freq: 87, source: "moe-standard", confidence: 0.85 },
  { traditional: "今晡日", simplified: "今晡日", roman: "gimˊ buˊ ngidˋ", gloss: "today", freq: 88, source: "moe-standard", confidence: 0.9 },
  { traditional: "天光日", simplified: "天光日", roman: "tienˊ gongˊ ngidˋ", gloss: "tomorrow", freq: 89, source: "moe-standard", confidence: 0.9 },
  { traditional: "昨日", simplified: "昨日", roman: "cog ngidˋ", gloss: "yesterday", mandarin: "zuórì", freq: 90, source: "community-verified", confidence: 0.9 },
  { traditional: "錢", simplified: "钱", roman: "qienˇ", gloss: "money", mandarin: "qián", example: "幾多錢？(How much?)", freq: 91, source: "community-verified", confidence: 0.94 },
  { traditional: "話", simplified: "话", roman: "fa", gloss: "speech / language", mandarin: "huà", example: "客家话 (Hakka)", freq: 92, source: "community-verified", confidence: 0.94 },
  { traditional: "課", simplified: "课", roman: "ko", gloss: "lesson / class", mandarin: "kè", freq: 93, source: "community-verified", confidence: 0.92 },
  { traditional: "作業", simplified: "作业", roman: "zogˋ ngiab", gloss: "homework / assignment", mandarin: "zuòyè", freq: 94, source: "community-verified", confidence: 0.92 },
  { traditional: "題目", simplified: "题目", roman: "taiˇ mug", gloss: "question / problem (on a worksheet)", mandarin: "tímù", freq: 95, source: "community-verified", confidence: 0.9 },
  { traditional: "考試", simplified: "考试", roman: "kauˋ sii", gloss: "exam / test", mandarin: "kǎoshì", freq: 96, source: "community-verified", confidence: 0.92 },
  // ── Adjectives ──
  { traditional: "好", simplified: "好", roman: "hoˋ", gloss: "good / well", mandarin: "hǎo", example: "當好 (very good)", freq: 97, source: "community-verified", confidence: 0.97 },
  { traditional: "壞", simplified: "坏", roman: "fai", gloss: "bad", mandarin: "huài", freq: 98, source: "community-verified", confidence: 0.93 },
  { traditional: "大", simplified: "大", roman: "tai", gloss: "big / large", mandarin: "dà", freq: 99, source: "community-verified", confidence: 0.96 },
  { traditional: "細", simplified: "细", roman: "se", gloss: "small / little / young", mandarin: "xì", freq: 100, source: "moe-standard", confidence: 0.93 },
  { traditional: "長", simplified: "长", roman: "congˇ", gloss: "long", mandarin: "cháng", freq: 101, source: "community-verified", confidence: 0.94 },
  { traditional: "短", simplified: "短", roman: "donˋ", gloss: "short", mandarin: "duǎn", freq: 102, source: "community-verified", confidence: 0.94 },
  { traditional: "高", simplified: "高", roman: "goˊ", gloss: "tall / high", mandarin: "gāo", freq: 103, source: "community-verified", confidence: 0.95 },
  { traditional: "矮", simplified: "矮", roman: "aiˋ", gloss: "short (height)", mandarin: "ǎi", freq: 104, source: "community-verified", confidence: 0.92 },
  { traditional: "遽", simplified: "遽", roman: "giagˋ", gloss: "fast / quick", freq: 105, source: "moe-standard", confidence: 0.88 },
  { traditional: "慢", simplified: "慢", roman: "man", gloss: "slow", mandarin: "màn", freq: 106, source: "community-verified", confidence: 0.93 },
  { traditional: "真", simplified: "真", roman: "ziinˊ", gloss: "really / truly", mandarin: "zhēn", freq: 107, source: "community-verified", confidence: 0.93 },
  { traditional: "新", simplified: "新", roman: "xinˊ", gloss: "new", mandarin: "xīn", freq: 108, source: "community-verified", confidence: 0.94 },
  { traditional: "舊", simplified: "旧", roman: "kiu", gloss: "old (not new)", mandarin: "jiù", freq: 109, source: "community-verified", confidence: 0.93 },
  { traditional: "甜", simplified: "甜", roman: "tiamˇ", gloss: "sweet", mandarin: "tián", freq: 110, source: "community-verified", confidence: 0.93 },
  { traditional: "鹹", simplified: "咸", roman: "hamˇ", gloss: "salty", mandarin: "xián", freq: 111, source: "community-verified", confidence: 0.93 },
  { traditional: "苦", simplified: "苦", roman: "fuˋ", gloss: "bitter / hard (life)", mandarin: "kǔ", freq: 112, source: "community-verified", confidence: 0.92 },
  { traditional: "靚", simplified: "靓", roman: "jiang", gloss: "pretty / beautiful", example: "好靚 (very pretty)", freq: 113, source: "moe-standard", confidence: 0.9 },
  { traditional: "難看", simplified: "难看", roman: "nanˇ kon", gloss: "ugly / bad-looking", freq: 114, source: "community-verified", confidence: 0.9 },
  { traditional: "歡喜", simplified: "欢喜", roman: "fonˊ hiˋ", gloss: "happy / glad", example: "涯好歡喜 (I'm very happy)", freq: 115, source: "moe-standard", confidence: 0.9 },
  { traditional: "冷", simplified: "冷", roman: "langˊ", gloss: "cold (weather / feeling)", mandarin: "lěng", freq: 116, source: "community-verified", confidence: 0.92 },
  { traditional: "熱", simplified: "热", roman: "ngied", gloss: "hot", mandarin: "rè", freq: 117, source: "community-verified", confidence: 0.93 },
  { traditional: "容易", simplified: "容易", roman: "iungˇ i", gloss: "easy", mandarin: "róngyì", freq: 118, source: "community-verified", confidence: 0.92 },
  { traditional: "難", simplified: "难", roman: "nanˇ", gloss: "difficult / hard", mandarin: "nán", freq: 119, source: "community-verified", confidence: 0.93 },
  { traditional: "著", simplified: "着", roman: "cog", gloss: "correct / right", example: "做著了 (that's correct)", freq: 120, source: "moe-standard", confidence: 0.88 },
  { traditional: "錯", simplified: "错", roman: "co", gloss: "wrong / incorrect", mandarin: "cuò", freq: 121, source: "community-verified", confidence: 0.93 },
  { traditional: "多", simplified: "多", roman: "doˊ", gloss: "many / much", mandarin: "duō", freq: 122, source: "community-verified", confidence: 0.94 },
  { traditional: "少", simplified: "少", roman: "seuˋ", gloss: "few / little", mandarin: "shǎo", freq: 123, source: "community-verified", confidence: 0.92 },
  { traditional: "淨", simplified: "净", roman: "qiang", gloss: "clean", example: "淨淨 (clean)", freq: 124, source: "moe-standard", confidence: 0.85 },
  { traditional: "飽", simplified: "饱", roman: "bauˋ", gloss: "full (after eating)", mandarin: "bǎo", freq: 125, source: "community-verified", confidence: 0.92 },
  { traditional: "肚枵", simplified: "肚枵", roman: "duˋ heuˊ", gloss: "hungry", freq: 126, source: "moe-standard", confidence: 0.85 },
  { traditional: "聰明", simplified: "聪明", roman: "cungˊ minˇ", gloss: "clever / smart", mandarin: "cōngming", freq: 127, source: "community-verified", confidence: 0.92 },
  { traditional: "認真", simplified: "认真", roman: "ngin ziinˊ", gloss: "serious / earnest", mandarin: "rènzhēn", freq: 128, source: "community-verified", confidence: 0.92 },
  // ── Numbers ──
  { traditional: "一", simplified: "一", roman: "idˋ", gloss: "one", mandarin: "yī", freq: 129, source: "community-verified", confidence: 0.98 },
  { traditional: "二", simplified: "二", roman: "ngi", gloss: "two", mandarin: "èr", freq: 130, source: "community-verified", confidence: 0.98 },
  { traditional: "三", simplified: "三", roman: "samˊ", gloss: "three", mandarin: "sān", freq: 131, source: "community-verified", confidence: 0.98 },
  { traditional: "四", simplified: "四", roman: "xi", gloss: "four", mandarin: "sì", freq: 132, source: "community-verified", confidence: 0.98 },
  { traditional: "五", simplified: "五", roman: "ngˋ", gloss: "five", mandarin: "wǔ", freq: 133, source: "community-verified", confidence: 0.98 },
  { traditional: "六", simplified: "六", roman: "liugˋ", gloss: "six", mandarin: "liù", freq: 134, source: "community-verified", confidence: 0.98 },
  { traditional: "七", simplified: "七", roman: "qidˋ", gloss: "seven", mandarin: "qī", freq: 135, source: "community-verified", confidence: 0.98 },
  { traditional: "八", simplified: "八", roman: "badˋ", gloss: "eight", mandarin: "bā", freq: 136, source: "community-verified", confidence: 0.98 },
  { traditional: "九", simplified: "九", roman: "giuˋ", gloss: "nine", mandarin: "jiǔ", freq: 137, source: "community-verified", confidence: 0.98 },
  { traditional: "十", simplified: "十", roman: "siib", gloss: "ten", mandarin: "shí", freq: 138, source: "community-verified", confidence: 0.98 },
  { traditional: "百", simplified: "百", roman: "bagˋ", gloss: "hundred", mandarin: "bǎi", freq: 139, source: "community-verified", confidence: 0.95 },
  { traditional: "千", simplified: "千", roman: "qienˊ", gloss: "thousand", mandarin: "qiān", freq: 140, source: "community-verified", confidence: 0.95 },
  { traditional: "萬", simplified: "万", roman: "van", gloss: "ten thousand", mandarin: "wàn", freq: 141, source: "community-verified", confidence: 0.95 },
  { traditional: "零", simplified: "零", roman: "langˇ", gloss: "zero", mandarin: "líng", freq: 142, source: "community-verified", confidence: 0.93 },
  { traditional: "半", simplified: "半", roman: "ban", gloss: "half", mandarin: "bàn", freq: 143, source: "community-verified", confidence: 0.93 },
  // ── Measure words ──
  { traditional: "隻", simplified: "只", roman: "zagˋ", gloss: "classifier for animals / one of a pair", example: "隻雞 (a chicken)", freq: 144, source: "moe-standard", confidence: 0.9 },
  { traditional: "條", simplified: "条", roman: "tiauˇ", gloss: "classifier for long thin objects", mandarin: "tiáo", freq: 145, source: "community-verified", confidence: 0.9 },
  { traditional: "張", simplified: "张", roman: "zongˊ", gloss: "classifier for flat objects (paper/table)", mandarin: "zhāng", freq: 146, source: "community-verified", confidence: 0.9 },
  { traditional: "本", simplified: "本", roman: "bunˋ", gloss: "classifier for books", mandarin: "běn", freq: 147, source: "community-verified", confidence: 0.92 },
  { traditional: "粒", simplified: "粒", roman: "liap", gloss: "classifier for small round objects", mandarin: "lì", freq: 148, source: "community-verified", confidence: 0.9 },
  { traditional: "雙", simplified: "双", roman: "sungˊ", gloss: "classifier for pairs (shoes/hands)", mandarin: "shuāng", freq: 149, source: "community-verified", confidence: 0.92 },
  // ── Nature & weather ──
  { traditional: "雨", simplified: "雨", roman: "iˋ", gloss: "rain", mandarin: "yǔ", freq: 150, source: "community-verified", confidence: 0.94 },
  { traditional: "風", simplified: "风", roman: "fungˊ", gloss: "wind", mandarin: "fēng", freq: 151, source: "community-verified", confidence: 0.94 },
  { traditional: "天", simplified: "天", roman: "tienˊ", gloss: "sky / day", mandarin: "tiān", freq: 152, source: "community-verified", confidence: 0.95 },
  { traditional: "日", simplified: "日", roman: "ngidˋ", gloss: "sun / day", mandarin: "rì", freq: 153, source: "community-verified", confidence: 0.95 },
  { traditional: "月", simplified: "月", roman: "ngiedˋ", gloss: "moon / month", mandarin: "yuè", freq: 154, source: "community-verified", confidence: 0.95 },
  { traditional: "星", simplified: "星", roman: "senˊ", gloss: "star", mandarin: "xīng", freq: 155, source: "community-verified", confidence: 0.9 },
  { traditional: "雲", simplified: "云", roman: "iunˇ", gloss: "cloud", mandarin: "yún", freq: 156, source: "community-verified", confidence: 0.9 },
  { traditional: "雪", simplified: "雪", roman: "xiedˋ", gloss: "snow", mandarin: "xuě", freq: 157, source: "community-verified", confidence: 0.9 },
  { traditional: "山", simplified: "山", roman: "sanˊ", gloss: "mountain", mandarin: "shān", freq: 158, source: "community-verified", confidence: 0.94 },
  { traditional: "海", simplified: "海", roman: "hoiˋ", gloss: "sea", mandarin: "hǎi", freq: 159, source: "community-verified", confidence: 0.94 },
  { traditional: "河", simplified: "河", roman: "hoˇ", gloss: "river", mandarin: "hé", freq: 160, source: "community-verified", confidence: 0.94 },
  { traditional: "樹", simplified: "树", roman: "su", gloss: "tree", mandarin: "shù", freq: 161, source: "community-verified", confidence: 0.93 },
  { traditional: "花", simplified: "花", roman: "faˊ", gloss: "flower", mandarin: "huā", freq: 162, source: "community-verified", confidence: 0.94 },
  { traditional: "草", simplified: "草", roman: "coˋ", gloss: "grass", mandarin: "cǎo", freq: 163, source: "community-verified", confidence: 0.93 },
  { traditional: "石", simplified: "石", roman: "sag", gloss: "stone / rock", mandarin: "shí", freq: 164, source: "community-verified", confidence: 0.93 },
  { traditional: "火", simplified: "火", roman: "foˋ", gloss: "fire", mandarin: "huǒ", freq: 165, source: "community-verified", confidence: 0.94 },
  { traditional: "光", simplified: "光", roman: "gongˊ", gloss: "light / bright", mandarin: "guāng", freq: 166, source: "community-verified", confidence: 0.93 },
  // ── Animals ──
  { traditional: "貓", simplified: "猫", roman: "meuˊ", gloss: "cat", mandarin: "māo", freq: 167, source: "community-verified", confidence: 0.94 },
  { traditional: "狗", simplified: "狗", roman: "gieuˋ", gloss: "dog", mandarin: "gǒu", freq: 168, source: "community-verified", confidence: 0.95 },
  { traditional: "雞", simplified: "鸡", roman: "gieˊ", gloss: "chicken", mandarin: "jī", freq: 169, source: "community-verified", confidence: 0.94 },
  { traditional: "牛", simplified: "牛", roman: "ngiuˇ", gloss: "cow / ox", mandarin: "niú", freq: 170, source: "community-verified", confidence: 0.94 },
  { traditional: "豬", simplified: "猪", roman: "zuˊ", gloss: "pig", mandarin: "zhū", freq: 171, source: "community-verified", confidence: 0.93 },
  { traditional: "羊", simplified: "羊", roman: "iongˇ", gloss: "sheep / goat", mandarin: "yáng", freq: 172, source: "community-verified", confidence: 0.93 },
  { traditional: "馬", simplified: "马", roman: "maˊ", gloss: "horse", mandarin: "mǎ", freq: 173, source: "community-verified", confidence: 0.93 },
  { traditional: "鳥", simplified: "鸟", roman: "diauˊ", gloss: "bird", mandarin: "niǎo", freq: 174, source: "community-verified", confidence: 0.93 },
  { traditional: "魚", simplified: "鱼", roman: "ngˇ", gloss: "fish", mandarin: "yú", freq: 175, source: "community-verified", confidence: 0.94 },
  { traditional: "蟲", simplified: "虫", roman: "cungˇ", gloss: "bug / insect", mandarin: "chóng", freq: 176, source: "community-verified", confidence: 0.92 },
  { traditional: "老虎", simplified: "老虎", roman: "loˋ fuˋ", gloss: "tiger", mandarin: "lǎohǔ", freq: 177, source: "community-verified", confidence: 0.92 },
  { traditional: "猴", simplified: "猴", roman: "heuˇ", gloss: "monkey", mandarin: "hóu", freq: 178, source: "community-verified", confidence: 0.92 },
  { traditional: "兔", simplified: "兔", roman: "tu", gloss: "rabbit", mandarin: "tù", freq: 179, source: "community-verified", confidence: 0.92 },
  { traditional: "蛇", simplified: "蛇", roman: "saˇ", gloss: "snake", mandarin: "shé", freq: 180, source: "community-verified", confidence: 0.92 },
  { traditional: "鴨", simplified: "鸭", roman: "abˋ", gloss: "duck", mandarin: "yā", freq: 181, source: "community-verified", confidence: 0.92 },
  { traditional: "蝦", simplified: "虾", roman: "haˇ", gloss: "shrimp / prawn", mandarin: "xiā", freq: 182, source: "community-verified", confidence: 0.9 },
  { traditional: "蟻", simplified: "蚁", roman: "ngi", gloss: "ant", mandarin: "yǐ", freq: 183, source: "community-verified", confidence: 0.85 },
  { traditional: "鳥仔", simplified: "鸟仔", roman: "diauˊ eˋ", gloss: "little bird", freq: 184, source: "community-verified", confidence: 0.85 },
  // ── Food & drink ──
  { traditional: "菜", simplified: "菜", roman: "coi", gloss: "vegetable / dish", mandarin: "cài", freq: 185, source: "community-verified", confidence: 0.94 },
  { traditional: "肉", simplified: "肉", roman: "ngiugˋ", gloss: "meat", mandarin: "ròu", freq: 186, source: "community-verified", confidence: 0.93 },
  { traditional: "蛋", simplified: "蛋", roman: "tan", gloss: "egg", mandarin: "dàn", freq: 187, source: "community-verified", confidence: 0.9 },
  { traditional: "湯", simplified: "汤", roman: "tongˊ", gloss: "soup", mandarin: "tāng", freq: 188, source: "community-verified", confidence: 0.93 },
  { traditional: "麵", simplified: "面", roman: "mien", gloss: "noodles", mandarin: "miàn", freq: 189, source: "community-verified", confidence: 0.9 },
  { traditional: "糖", simplified: "糖", roman: "tongˇ", gloss: "sugar / candy", mandarin: "táng", freq: 190, source: "community-verified", confidence: 0.92 },
  { traditional: "鹽", simplified: "盐", roman: "iamˇ", gloss: "salt", mandarin: "yán", freq: 191, source: "community-verified", confidence: 0.92 },
  { traditional: "油", simplified: "油", roman: "iuˇ", gloss: "oil", mandarin: "yóu", freq: 192, source: "community-verified", confidence: 0.92 },
  { traditional: "水果", simplified: "水果", roman: "suiˋ goˋ", gloss: "fruit", mandarin: "shuǐguǒ", freq: 193, source: "community-verified", confidence: 0.9 },
  { traditional: "牛奶", simplified: "牛奶", roman: "ngiuˇ nen", gloss: "milk", mandarin: "niúnǎi", freq: 194, source: "community-verified", confidence: 0.88 },
  { traditional: "粥", simplified: "粥", roman: "zugˋ", gloss: "rice congee / porridge", mandarin: "zhōu", freq: 195, source: "community-verified", confidence: 0.88 },
  // ── Time & date ──
  { traditional: "點鐘", simplified: "点钟", roman: "diamˋ zungˊ", gloss: "o'clock / hour", example: "幾點鐘？(What time?)", freq: 196, source: "moe-standard", confidence: 0.88 },
  { traditional: "分", simplified: "分", roman: "funˊ", gloss: "minute", mandarin: "fēn", freq: 197, source: "community-verified", confidence: 0.92 },
  { traditional: "年", simplified: "年", roman: "ngienˇ", gloss: "year", mandarin: "nián", freq: 198, source: "community-verified", confidence: 0.94 },
  { traditional: "禮拜", simplified: "礼拜", roman: "liˊ bai", gloss: "week / Sunday", mandarin: "lǐbài", freq: 199, source: "community-verified", confidence: 0.9 },
  { traditional: "禮拜一", simplified: "礼拜一", roman: "liˊ bai idˋ", gloss: "Monday", freq: 200, source: "community-verified", confidence: 0.88 },
  { traditional: "禮拜二", simplified: "礼拜二", roman: "liˊ bai ngi", gloss: "Tuesday", freq: 201, source: "community-verified", confidence: 0.88 },
  { traditional: "禮拜三", simplified: "礼拜三", roman: "liˊ bai samˊ", gloss: "Wednesday", freq: 202, source: "community-verified", confidence: 0.88 },
  { traditional: "禮拜四", simplified: "礼拜四", roman: "liˊ bai xi", gloss: "Thursday", freq: 203, source: "community-verified", confidence: 0.88 },
  { traditional: "禮拜五", simplified: "礼拜五", roman: "liˊ bai ngˋ", gloss: "Friday", freq: 204, source: "community-verified", confidence: 0.88 },
  { traditional: "禮拜六", simplified: "礼拜六", roman: "liˊ bai liugˋ", gloss: "Saturday", freq: 205, source: "community-verified", confidence: 0.88 },
  // ── Home & household ──
  { traditional: "門", simplified: "门", roman: "munˇ", gloss: "door", mandarin: "mén", freq: 206, source: "community-verified", confidence: 0.94 },
  { traditional: "窗", simplified: "窗", roman: "cungˊ", gloss: "window", mandarin: "chuāng", freq: 207, source: "community-verified", confidence: 0.92 },
  { traditional: "眠床", simplified: "眠床", roman: "minˇ congˇ", gloss: "bed", freq: 208, source: "moe-standard", confidence: 0.88 },
  { traditional: "桌", simplified: "桌", roman: "zogˋ", gloss: "table / desk", mandarin: "zhuō", freq: 209, source: "community-verified", confidence: 0.93 },
  { traditional: "椅", simplified: "椅", roman: "iˋ", gloss: "chair", mandarin: "yǐ", freq: 210, source: "community-verified", confidence: 0.93 },
  { traditional: "燈", simplified: "灯", roman: "denˊ", gloss: "lamp / light", mandarin: "dēng", freq: 211, source: "community-verified", confidence: 0.93 },
  { traditional: "房間", simplified: "房间", roman: "fongˇ gienˊ", gloss: "room", mandarin: "fángjiān", freq: 212, source: "community-verified", confidence: 0.92 },
  { traditional: "電視", simplified: "电视", roman: "tien si", gloss: "television / TV", mandarin: "diànshì", freq: 213, source: "community-verified", confidence: 0.92 },
  { traditional: "電話", simplified: "电话", roman: "tien fa", gloss: "telephone", mandarin: "diànhuà", freq: 214, source: "community-verified", confidence: 0.92 },
  { traditional: "電腦", simplified: "电脑", roman: "tien nauˋ", gloss: "computer", mandarin: "diànnǎo", freq: 215, source: "community-verified", confidence: 0.92 },
  // ── Body ──
  { traditional: "頭", simplified: "头", roman: "teuˇ", gloss: "head", mandarin: "tóu", freq: 216, source: "community-verified", confidence: 0.94 },
  { traditional: "目珠", simplified: "目珠", roman: "mugˋ zuˊ", gloss: "eye (colloquial)", freq: 217, source: "moe-standard", confidence: 0.88 },
  { traditional: "耳", simplified: "耳", roman: "ngiˋ", gloss: "ear", mandarin: "ěr", freq: 218, source: "community-verified", confidence: 0.92 },
  { traditional: "鼻", simplified: "鼻", roman: "pi", gloss: "nose", mandarin: "bí", freq: 219, source: "community-verified", confidence: 0.92 },
  { traditional: "嘴", simplified: "嘴", roman: "zoi", gloss: "mouth", mandarin: "zuǐ", freq: 220, source: "community-verified", confidence: 0.92 },
  { traditional: "手", simplified: "手", roman: "suˋ", gloss: "hand", mandarin: "shǒu", freq: 221, source: "community-verified", confidence: 0.95 },
  { traditional: "腳", simplified: "脚", roman: "giogˋ", gloss: "foot / leg", mandarin: "jiǎo", freq: 222, source: "community-verified", confidence: 0.93 },
  { traditional: "心", simplified: "心", roman: "simˊ", gloss: "heart", mandarin: "xīn", freq: 223, source: "community-verified", confidence: 0.93 },
  { traditional: "面", simplified: "面", roman: "mien", gloss: "face", mandarin: "miàn", freq: 224, source: "community-verified", confidence: 0.93 },
  // ── Transport ──
  { traditional: "車", simplified: "车", roman: "caˊ", gloss: "car / vehicle", mandarin: "chē", freq: 225, source: "community-verified", confidence: 0.94 },
  { traditional: "火車", simplified: "火车", roman: "foˋ caˊ", gloss: "train", mandarin: "huǒchē", freq: 226, source: "community-verified", confidence: 0.92 },
  { traditional: "飛機", simplified: "飞机", roman: "fuiˊ giˊ", gloss: "airplane", mandarin: "fēijī", freq: 227, source: "community-verified", confidence: 0.92 },
  { traditional: "船", simplified: "船", roman: "sonˇ", gloss: "boat / ship", mandarin: "chuán", freq: 228, source: "community-verified", confidence: 0.93 },
  { traditional: "路", simplified: "路", roman: "lu", gloss: "road / path", mandarin: "lù", freq: 229, source: "community-verified", confidence: 0.93 },
  // ── Everyday phrases ──
  { traditional: "你好", simplified: "你好", roman: "nˇ hoˋ", gloss: "hello / hi", freq: 230, source: "community-verified", confidence: 0.97 },
  { traditional: "多謝", simplified: "多谢", roman: "doˊ qia", gloss: "thank you", freq: 231, source: "community-verified", confidence: 0.93 },
  { traditional: "承蒙你", simplified: "承蒙你", roman: "siinˇ mung nˇ", gloss: "thank you (formal)", freq: 232, source: "moe-standard", confidence: 0.88 },
  { traditional: "對毋住", simplified: "对毋住", roman: "dui mˇ cu", gloss: "sorry / excuse me", freq: 233, source: "moe-standard", confidence: 0.9 },
  { traditional: "無相干", simplified: "无相干", roman: "moˇ xiongˊ gonˊ", gloss: "no problem / it's OK", freq: 234, source: "moe-standard", confidence: 0.9 },
  { traditional: "毋知", simplified: "毋知", roman: "mˇ diˊ", gloss: "don't know", freq: 235, source: "moe-standard", confidence: 0.92 },
  { traditional: "毋好", simplified: "毋好", roman: "mˇ hoˋ", gloss: "not good / don't", freq: 236, source: "moe-standard", confidence: 0.92 },
  { traditional: "好食", simplified: "好食", roman: "hoˋ siid", gloss: "delicious / tasty", freq: 237, source: "community-verified", confidence: 0.93 },
  { traditional: "食飯", simplified: "食饭", roman: "siid fan", gloss: "to eat a meal", freq: 238, source: "community-verified", confidence: 0.95 },
  { traditional: "食茶", simplified: "食茶", roman: "siid caˇ", gloss: "to drink tea", freq: 239, source: "community-verified", confidence: 0.94 },
  { traditional: "客家話", simplified: "客家话", roman: "hagˋ gaˊ fa", gloss: "the Hakka language", freq: 240, source: "community-verified", confidence: 0.95 },
  { traditional: "做得", simplified: "做得", roman: "zo dedˋ", gloss: "OK / that works / can do", freq: 241, source: "community-verified", confidence: 0.94 },
  { traditional: "做作業", simplified: "做作业", roman: "zo zogˋ ngiab", gloss: "to do homework", freq: 242, source: "community-verified", confidence: 0.92 },
  { traditional: "再會", simplified: "再会", roman: "zai voi", gloss: "goodbye (see you again)", mandarin: "zàihuì", freq: 243, source: "moe-standard", confidence: 0.9 },
  { traditional: "請", simplified: "请", roman: "qiangˋ", gloss: "please", mandarin: "qǐng", freq: 244, source: "community-verified", confidence: 0.92 },
  { traditional: "無客氣", simplified: "无客气", roman: "moˇ hagˋ hi", gloss: "you're welcome", freq: 245, source: "moe-standard", confidence: 0.9 },
  { traditional: "加油", simplified: "加油", roman: "gaˊ iuˇ", gloss: "keep going / come on (encouragement)", mandarin: "jiāyóu", freq: 246, source: "community-verified", confidence: 0.92 },
  { traditional: "小心", simplified: "小心", roman: "seuˋ simˊ", gloss: "be careful", mandarin: "xiǎoxīn", freq: 247, source: "community-verified", confidence: 0.92 },
  { traditional: "慢慢來", simplified: "慢慢来", roman: "man man loiˇ", gloss: "take your time / go slowly", freq: 248, source: "community-verified", confidence: 0.92 },
  { traditional: "聽無", simplified: "听无", roman: "tangˊ moˇ", gloss: "didn't catch / don't understand", freq: 249, source: "community-verified", confidence: 0.88 },
  { traditional: "明白了", simplified: "明白了", roman: "minˇ bagˋ le", gloss: "understand now / got it", freq: 250, source: "community-verified", confidence: 0.9 },
  { traditional: "毋使", simplified: "毋使", roman: "mˇ siiˋ", gloss: "no need / don't have to", freq: 251, source: "moe-standard", confidence: 0.9 },
  { traditional: "無問題", simplified: "无问题", roman: "moˇ mun tiˇ", gloss: "no problem", freq: 252, source: "community-verified", confidence: 0.92 },
  { traditional: "正確", simplified: "正确", roman: "ziin kogˋ", gloss: "correct / right", mandarin: "zhèngquè", freq: 253, source: "community-verified", confidence: 0.93 },
  { traditional: "答案", simplified: "答案", roman: "dabˋ on", gloss: "answer (to a question)", mandarin: "dá'àn", freq: 254, source: "community-verified", confidence: 0.92 },
  // ── More verbs (daily actions) ──
  { traditional: "上堂", simplified: "上堂", roman: "songˊ tongˇ", gloss: "to attend class", freq: 255, source: "moe-standard", confidence: 0.85 },
  { traditional: "下堂", simplified: "下堂", roman: "haˊ tongˇ", gloss: "class dismissed / to finish class", freq: 256, source: "moe-standard", confidence: 0.85 },
  { traditional: "起床", simplified: "起床", roman: "hiˋ congˇ", gloss: "to get up", mandarin: "qǐchuáng", freq: 257, source: "community-verified", confidence: 0.92 },
  { traditional: "洗面", simplified: "洗面", roman: "seˋ mien", gloss: "to wash one's face", freq: 258, source: "community-verified", confidence: 0.88 },
  { traditional: "轉屋下", simplified: "转屋下", roman: "zonˋ vugˋ haˊ", gloss: "to go home", freq: 259, source: "moe-standard", confidence: 0.88 },
  { traditional: "出門", simplified: "出门", roman: "cudˋ munˇ", gloss: "to go out / leave home", mandarin: "chūmén", freq: 260, source: "community-verified", confidence: 0.92 },
  { traditional: "入來", simplified: "入来", roman: "ngib loiˇ", gloss: "to come in", freq: 261, source: "moe-standard", confidence: 0.88 },
  { traditional: "出去", simplified: "出去", roman: "cudˋ hi", gloss: "to go out", mandarin: "chūqù", freq: 262, source: "community-verified", confidence: 0.92 },
  { traditional: "開始", simplified: "开始", roman: "koiˊ siiˋ", gloss: "to begin / to start", mandarin: "kāishǐ", freq: 263, source: "community-verified", confidence: 0.92 },
  { traditional: "完成", simplified: "完成", roman: "vanˇ siinˇ", gloss: "to finish / to complete", mandarin: "wánchéng", freq: 264, source: "community-verified", confidence: 0.92 },
  { traditional: "準備", simplified: "准备", roman: "zunˋ pi", gloss: "to prepare / to get ready", mandarin: "zhǔnbèi", freq: 265, source: "community-verified", confidence: 0.92 },
  { traditional: "認識", simplified: "认识", roman: "ngin siid", gloss: "to know / to be acquainted with", mandarin: "rènshi", freq: 266, source: "community-verified", confidence: 0.9 },
  { traditional: "覺得", simplified: "觉得", roman: "gog dedˋ", gloss: "to feel / to think (opinion)", mandarin: "juéde", freq: 267, source: "community-verified", confidence: 0.9 },
  { traditional: "需要", simplified: "需要", roman: "siˊ iau", gloss: "to need / to require", mandarin: "xūyào", freq: 268, source: "community-verified", confidence: 0.92 },
  { traditional: "應該", simplified: "应该", roman: "inˊ goiˊ", gloss: "should / ought to", mandarin: "yīnggāi", freq: 269, source: "community-verified", confidence: 0.92 },
  { traditional: "相信", simplified: "相信", roman: "xiongˊ sin", gloss: "to believe / to trust", mandarin: "xiāngxìn", freq: 270, source: "community-verified", confidence: 0.9 },
  { traditional: "借", simplified: "借", roman: "jia", gloss: "to borrow / to lend", mandarin: "jiè", freq: 271, source: "community-verified", confidence: 0.92 },
  { traditional: "收到", simplified: "收到", roman: "suˊ do", gloss: "to receive / to get", mandarin: "shōudào", freq: 272, source: "community-verified", confidence: 0.92 },
  { traditional: "爬", simplified: "爬", roman: "paˇ", gloss: "to climb / to crawl", mandarin: "pá", freq: 273, source: "community-verified", confidence: 0.9 },
  { traditional: "飛", simplified: "飞", roman: "fuiˊ", gloss: "to fly", mandarin: "fēi", freq: 274, source: "community-verified", confidence: 0.92 },
  { traditional: "泅水", simplified: "泅水", roman: "ciuˇ suiˋ", gloss: "to swim", freq: 275, source: "moe-standard", confidence: 0.85 },
  { traditional: "跌倒", simplified: "跌倒", roman: "died doˋ", gloss: "to fall down / to trip", freq: 276, source: "llm-suggested", confidence: 0.78 },
  { traditional: "打", simplified: "打", roman: "daˋ", gloss: "to hit / to beat / to play (ball)", example: "打球 (play ball)", freq: 277, source: "community-verified", confidence: 0.9 },
  { traditional: "唸", simplified: "念", roman: "ngiam", gloss: "to read aloud / to recite", mandarin: "niàn", freq: 278, source: "community-verified", confidence: 0.9 },
  { traditional: "畫", simplified: "画", roman: "fa", gloss: "to draw / to paint", mandarin: "huà", freq: 279, source: "community-verified", confidence: 0.92 },
  { traditional: "試", simplified: "试", roman: "cii", gloss: "to try / to attempt", mandarin: "shì", example: "試一下 (give it a try)", freq: 280, source: "community-verified", confidence: 0.92 },
  { traditional: "算", simplified: "算", roman: "son", gloss: "to calculate / to count", mandarin: "suàn", freq: 281, source: "community-verified", confidence: 0.9 },
  { traditional: "答應", simplified: "答应", roman: "dabˋ in", gloss: "to promise / to agree", mandarin: "dāyìng", freq: 282, source: "community-verified", confidence: 0.9 },
  { traditional: "請假", simplified: "请假", roman: "qiangˋ gaˋ", gloss: "to ask for leave", mandarin: "qǐngjià", freq: 283, source: "community-verified", confidence: 0.9 },
  // ── Body parts (more) ──
  { traditional: "頭毛", simplified: "头毛", roman: "teuˇ moˊ", gloss: "hair (on head)", freq: 284, source: "moe-standard", confidence: 0.88 },
  { traditional: "鼻公", simplified: "鼻公", roman: "pi gungˊ", gloss: "nose (colloquial)", freq: 285, source: "moe-standard", confidence: 0.85 },
  { traditional: "牙", simplified: "牙", roman: "ngaˇ", gloss: "tooth", mandarin: "yá", freq: 286, source: "community-verified", confidence: 0.92 },
  { traditional: "舌", simplified: "舌", roman: "sad", gloss: "tongue", mandarin: "shé", freq: 287, source: "community-verified", confidence: 0.92 },
  { traditional: "頸", simplified: "颈", roman: "giangˋ", gloss: "neck", mandarin: "jǐng", freq: 288, source: "community-verified", confidence: 0.88 },
  { traditional: "肩頭", simplified: "肩头", roman: "gienˊ teuˇ", gloss: "shoulder", freq: 289, source: "llm-suggested", confidence: 0.7 },
  { traditional: "肚", simplified: "肚", roman: "duˋ", gloss: "belly / stomach", example: "肚枵 (hungry)", freq: 290, source: "moe-standard", confidence: 0.9 },
  { traditional: "腰", simplified: "腰", roman: "ieuˊ", gloss: "waist", mandarin: "yāo", freq: 291, source: "community-verified", confidence: 0.9 },
  { traditional: "腳腿", simplified: "脚腿", roman: "giogˋ tuiˋ", gloss: "leg", freq: 292, source: "community-verified", confidence: 0.85 },
  // ── Family (more) ──
  { traditional: "阿哥", simplified: "阿哥", roman: "aˊ goˊ", gloss: "elder brother", freq: 293, source: "community-verified", confidence: 0.92 },
  { traditional: "老弟", simplified: "老弟", roman: "loˋ taiˊ", gloss: "younger brother", freq: 294, source: "community-verified", confidence: 0.9 },
  { traditional: "阿姐", simplified: "阿姐", roman: "aˊ jiaˋ", gloss: "elder sister", freq: 295, source: "community-verified", confidence: 0.92 },
  { traditional: "老妹", simplified: "老妹", roman: "loˋ moi", gloss: "younger sister", freq: 296, source: "community-verified", confidence: 0.9 },
  { traditional: "阿叔", simplified: "阿叔", roman: "aˊ sugˋ", gloss: "uncle (father's younger brother)", freq: 297, source: "community-verified", confidence: 0.9 },
  { traditional: "阿姨", simplified: "阿姨", roman: "aˊ iˇ", gloss: "aunt (mother's sister) / lady", freq: 298, source: "community-verified", confidence: 0.9 },
  { traditional: "阿爸", simplified: "阿爸", roman: "aˊ baˊ", gloss: "father / dad", freq: 299, source: "community-verified", confidence: 0.94 },
  { traditional: "阿姆", simplified: "阿姆", roman: "aˊ meˊ", gloss: "mother / mum", freq: 300, source: "moe-standard", confidence: 0.9 },
  { traditional: "老公", simplified: "老公", roman: "loˋ gungˊ", gloss: "husband", freq: 301, source: "community-verified", confidence: 0.9 },
  { traditional: "老婆", simplified: "老婆", roman: "loˋ poˇ", gloss: "wife", freq: 302, source: "community-verified", confidence: 0.9 },
  // ── School & study (more) ──
  { traditional: "校長", simplified: "校长", roman: "gau zongˋ", gloss: "school principal", mandarin: "xiàozhǎng", freq: 303, source: "community-verified", confidence: 0.9 },
  { traditional: "課本", simplified: "课本", roman: "ko bunˋ", gloss: "textbook", mandarin: "kèběn", freq: 304, source: "community-verified", confidence: 0.92 },
  { traditional: "筆", simplified: "笔", roman: "bidˋ", gloss: "pen", mandarin: "bǐ", freq: 305, source: "community-verified", confidence: 0.93 },
  { traditional: "鉛筆", simplified: "铅笔", roman: "ienˇ bidˋ", gloss: "pencil", mandarin: "qiānbǐ", freq: 306, source: "community-verified", confidence: 0.92 },
  { traditional: "紙", simplified: "纸", roman: "ziiˋ", gloss: "paper", mandarin: "zhǐ", freq: 307, source: "community-verified", confidence: 0.93 },
  { traditional: "書包", simplified: "书包", roman: "suˊ bauˊ", gloss: "schoolbag", mandarin: "shūbāo", freq: 308, source: "community-verified", confidence: 0.92 },
  { traditional: "教室", simplified: "教室", roman: "gau siid", gloss: "classroom", mandarin: "jiàoshì", freq: 309, source: "community-verified", confidence: 0.9 },
  { traditional: "操場", simplified: "操场", roman: "cauˊ congˇ", gloss: "playground", mandarin: "cāochǎng", freq: 310, source: "community-verified", confidence: 0.9 },
  { traditional: "數學", simplified: "数学", roman: "su hog", gloss: "mathematics", mandarin: "shùxué", freq: 311, source: "community-verified", confidence: 0.93 },
  { traditional: "國文", simplified: "国文", roman: "guedˋ vunˇ", gloss: "Chinese language (subject)", mandarin: "guówén", freq: 312, source: "community-verified", confidence: 0.9 },
  { traditional: "科學", simplified: "科学", roman: "koˊ hog", gloss: "science", mandarin: "kēxué", freq: 313, source: "community-verified", confidence: 0.92 },
  { traditional: "歷史", simplified: "历史", roman: "lag siiˋ", gloss: "history", mandarin: "lìshǐ", freq: 314, source: "community-verified", confidence: 0.92 },
  { traditional: "音樂", simplified: "音乐", roman: "imˊ ngog", gloss: "music", mandarin: "yīnyuè", freq: 315, source: "community-verified", confidence: 0.92 },
  { traditional: "美術", simplified: "美术", roman: "miˊ sud", gloss: "art (subject)", mandarin: "měishù", freq: 316, source: "community-verified", confidence: 0.9 },
  { traditional: "分數", simplified: "分数", roman: "funˊ su", gloss: "score / mark / fraction", mandarin: "fēnshù", freq: 317, source: "community-verified", confidence: 0.9 },
  { traditional: "及格", simplified: "及格", roman: "kib giedˋ", gloss: "to pass (a test)", mandarin: "jígé", freq: 318, source: "community-verified", confidence: 0.9 },
  { traditional: "練習", simplified: "练习", roman: "lien sip", gloss: "to practice / exercise", mandarin: "liànxí", freq: 319, source: "community-verified", confidence: 0.9 },
  { traditional: "聽寫", simplified: "听写", roman: "tangˊ siaˋ", gloss: "dictation (school exercise)", mandarin: "tīngxiě", freq: 320, source: "community-verified", confidence: 0.9 },
  // ── Time (more) ──
  { traditional: "後日", simplified: "后日", roman: "heu ngidˋ", gloss: "the day after tomorrow", freq: 321, source: "moe-standard", confidence: 0.88 },
  { traditional: "前日", simplified: "前日", roman: "qienˇ ngidˋ", gloss: "the day before yesterday", freq: 322, source: "community-verified", confidence: 0.88 },
  { traditional: "朝晨", simplified: "朝晨", roman: "zeuˊ siinˇ", gloss: "morning", freq: 323, source: "moe-standard", confidence: 0.85 },
  { traditional: "當晝", simplified: "当昼", roman: "dongˊ zu", gloss: "noon / midday", freq: 324, source: "moe-standard", confidence: 0.85 },
  { traditional: "下晝", simplified: "下昼", roman: "haˊ zu", gloss: "afternoon", freq: 325, source: "moe-standard", confidence: 0.85 },
  { traditional: "暗晡", simplified: "暗晡", roman: "am buˊ", gloss: "evening / night", freq: 326, source: "moe-standard", confidence: 0.85 },
  { traditional: "現在", simplified: "现在", roman: "hien zai", gloss: "now", mandarin: "xiànzài", freq: 327, source: "community-verified", confidence: 0.92 },
  { traditional: "過去", simplified: "过去", roman: "go hi", gloss: "the past", mandarin: "guòqù", freq: 328, source: "community-verified", confidence: 0.92 },
  { traditional: "將來", simplified: "将来", roman: "jiongˊ loiˇ", gloss: "the future", mandarin: "jiānglái", freq: 329, source: "community-verified", confidence: 0.9 },
  { traditional: "馬上", simplified: "马上", roman: "maˊ song", gloss: "immediately / right away", mandarin: "mǎshàng", freq: 330, source: "community-verified", confidence: 0.9 },
  { traditional: "秒", simplified: "秒", roman: "meuˋ", gloss: "second (time unit)", mandarin: "miǎo", freq: 331, source: "community-verified", confidence: 0.92 },
  { traditional: "點", simplified: "点", roman: "diamˋ", gloss: "o'clock / dot / point", mandarin: "diǎn", example: "三點 (three o'clock)", freq: 332, source: "community-verified", confidence: 0.92 },
  // ── Nature (more) ──
  { traditional: "雷公", simplified: "雷公", roman: "luiˇ gungˊ", gloss: "thunder", freq: 333, source: "moe-standard", confidence: 0.88 },
  { traditional: "沙", simplified: "沙", roman: "saˊ", gloss: "sand", mandarin: "shā", freq: 334, source: "community-verified", confidence: 0.92 },
  { traditional: "金", simplified: "金", roman: "gimˊ", gloss: "gold", mandarin: "jīn", freq: 335, source: "community-verified", confidence: 0.93 },
  { traditional: "銀", simplified: "银", roman: "ngiunˇ", gloss: "silver", mandarin: "yín", freq: 336, source: "community-verified", confidence: 0.92 },
  // ── Animals (more) ──
  { traditional: "老鼠", simplified: "老鼠", roman: "loˋ cuˋ", gloss: "mouse / rat", mandarin: "lǎoshǔ", freq: 337, source: "community-verified", confidence: 0.92 },
  { traditional: "鵝", simplified: "鹅", roman: "ngoˇ", gloss: "goose", mandarin: "é", freq: 338, source: "community-verified", confidence: 0.9 },
  { traditional: "蝴蝶", simplified: "蝴蝶", roman: "fuˇ tiab", gloss: "butterfly", mandarin: "húdié", freq: 339, source: "community-verified", confidence: 0.9 },
  { traditional: "蜜蜂", simplified: "蜜蜂", roman: "mid fungˊ", gloss: "honeybee", mandarin: "mìfēng", freq: 340, source: "community-verified", confidence: 0.9 },
  { traditional: "烏鴉", simplified: "乌鸦", roman: "vuˊ aˊ", gloss: "crow", mandarin: "wūyā", freq: 341, source: "community-verified", confidence: 0.9 },
  // ── Food (more) ──
  { traditional: "朝食", simplified: "朝食", roman: "zeuˊ siid", gloss: "breakfast", freq: 342, source: "moe-standard", confidence: 0.85 },
  { traditional: "當晝食", simplified: "当昼食", roman: "dongˊ zu siid", gloss: "lunch", freq: 343, source: "moe-standard", confidence: 0.82 },
  { traditional: "夜食", simplified: "夜食", roman: "ia siid", gloss: "dinner / supper", freq: 344, source: "moe-standard", confidence: 0.82 },
  { traditional: "粄", simplified: "粄", roman: "banˋ", gloss: "Hakka rice cake / pastry", freq: 345, source: "moe-standard", confidence: 0.85 },
  { traditional: "面包", simplified: "面包", roman: "mien bauˊ", gloss: "bread", mandarin: "miànbāo", freq: 346, source: "community-verified", confidence: 0.92 },
  { traditional: "雪糕", simplified: "雪糕", roman: "xiedˋ gauˊ", gloss: "ice cream", freq: 347, source: "community-verified", confidence: 0.88 },
  // ── Home (more) ──
  { traditional: "鎖匙", simplified: "锁匙", roman: "soˋ siiˇ", gloss: "key", freq: 348, source: "moe-standard", confidence: 0.85 },
  { traditional: "電燈", simplified: "电灯", roman: "tien denˊ", gloss: "electric light / lamp", mandarin: "diàndēng", freq: 349, source: "community-verified", confidence: 0.92 },
  { traditional: "樓梯", simplified: "楼梯", roman: "leuˇ taiˊ", gloss: "stairs", mandarin: "lóutī", freq: 350, source: "community-verified", confidence: 0.9 },
  { traditional: "冰箱", simplified: "冰箱", roman: "benˊ xiongˊ", gloss: "refrigerator", mandarin: "bīngxiāng", freq: 351, source: "community-verified", confidence: 0.92 },
  // ── Places & services ──
  { traditional: "銀行", simplified: "银行", roman: "ngiunˇ hongˇ", gloss: "bank", mandarin: "yínháng", freq: 352, source: "community-verified", confidence: 0.9 },
  { traditional: "店", simplified: "店", roman: "diam", gloss: "shop / store", mandarin: "diàn", freq: 353, source: "community-verified", confidence: 0.92 },
  { traditional: "市場", simplified: "市场", roman: "siiˊ congˇ", gloss: "market", mandarin: "shìchǎng", freq: 354, source: "community-verified", confidence: 0.9 },
  { traditional: "公園", simplified: "公园", roman: "gungˊ ienˇ", gloss: "park", mandarin: "gōngyuán", freq: 355, source: "community-verified", confidence: 0.9 },
  { traditional: "醫院", simplified: "医院", roman: "iˊ ien", gloss: "hospital", mandarin: "yīyuàn", freq: 356, source: "community-verified", confidence: 0.9 },
  { traditional: "醫生", simplified: "医生", roman: "iˊ senˊ", gloss: "doctor", mandarin: "yīshēng", freq: 357, source: "community-verified", confidence: 0.92 },
  { traditional: "藥", simplified: "药", roman: "iog", gloss: "medicine", mandarin: "yào", freq: 358, source: "community-verified", confidence: 0.92 },
  { traditional: "飯店", simplified: "饭店", roman: "fan diam", gloss: "restaurant", mandarin: "fàndiàn", freq: 359, source: "community-verified", confidence: 0.9 },
  { traditional: "圖書館", simplified: "图书馆", roman: "tuˇ suˊ gonˋ", gloss: "library", mandarin: "túshūguǎn", freq: 360, source: "community-verified", confidence: 0.9 },
  // ── More adjectives ──
  { traditional: "肥", simplified: "肥", roman: "puiˇ", gloss: "fat / plump (people/animals)", mandarin: "féi", freq: 361, source: "community-verified", confidence: 0.92 },
  { traditional: "瘦", simplified: "瘦", roman: "ceu", gloss: "thin / skinny", mandarin: "shòu", freq: 362, source: "community-verified", confidence: 0.92 },
  { traditional: "後生", simplified: "后生", roman: "heu sangˊ", gloss: "young", freq: 363, source: "moe-standard", confidence: 0.88 },
  { traditional: "老", simplified: "老", roman: "loˋ", gloss: "old (person)", mandarin: "lǎo", freq: 364, source: "community-verified", confidence: 0.93 },
  { traditional: "重要", simplified: "重要", roman: "cung iau", gloss: "important", mandarin: "zhòngyào", freq: 365, source: "community-verified", confidence: 0.92 },
  { traditional: "簡單", simplified: "简单", roman: "gienˋ tanˊ", gloss: "simple", mandarin: "jiǎndān", freq: 366, source: "community-verified", confidence: 0.92 },
  { traditional: "複雜", simplified: "复杂", roman: "fug zag", gloss: "complicated", mandarin: "fùzá", freq: 367, source: "community-verified", confidence: 0.92 },
  { traditional: "安全", simplified: "安全", roman: "onˊ cionˇ", gloss: "safe / safety", mandarin: "ānquán", freq: 368, source: "community-verified", confidence: 0.92 },
  { traditional: "危險", simplified: "危险", roman: "ngiui hiamˋ", gloss: "dangerous", mandarin: "wēixiǎn", freq: 369, source: "community-verified", confidence: 0.92 },
  { traditional: "便宜", simplified: "便宜", roman: "pienˇ ngi", gloss: "cheap", mandarin: "piányi", freq: 370, source: "community-verified", confidence: 0.88 },
  { traditional: "貴", simplified: "贵", roman: "gui", gloss: "expensive", mandarin: "guì", freq: 371, source: "community-verified", confidence: 0.93 },
  { traditional: "新鮮", simplified: "新鲜", roman: "xinˊ xienˊ", gloss: "fresh", mandarin: "xīnxiān", freq: 372, source: "community-verified", confidence: 0.92 },
  { traditional: "遠", simplified: "远", roman: "ienˋ", gloss: "far", mandarin: "yuǎn", freq: 373, source: "community-verified", confidence: 0.92 },
  { traditional: "近", simplified: "近", roman: "kiunˊ", gloss: "near", mandarin: "jìn", freq: 374, source: "community-verified", confidence: 0.92 },
  { traditional: "深", simplified: "深", roman: "ciimˊ", gloss: "deep", mandarin: "shēn", freq: 375, source: "community-verified", confidence: 0.9 },
  { traditional: "淺", simplified: "浅", roman: "cienˋ", gloss: "shallow", mandarin: "qiǎn", freq: 376, source: "community-verified", confidence: 0.9 },
  { traditional: "重", simplified: "重", roman: "cungˊ", gloss: "heavy", mandarin: "zhòng", freq: 377, source: "community-verified", confidence: 0.92 },
  { traditional: "輕", simplified: "轻", roman: "kiangˊ", gloss: "light (weight)", mandarin: "qīng", freq: 378, source: "community-verified", confidence: 0.92 },
  { traditional: "硬", simplified: "硬", roman: "ngang", gloss: "hard / stiff", mandarin: "yìng", freq: 379, source: "community-verified", confidence: 0.9 },
  { traditional: "軟", simplified: "软", roman: "ngionˊ", gloss: "soft", mandarin: "ruǎn", freq: 380, source: "community-verified", confidence: 0.9 },
  { traditional: "滿", simplified: "满", roman: "manˊ", gloss: "full", mandarin: "mǎn", freq: 381, source: "community-verified", confidence: 0.9 },
  { traditional: "空", simplified: "空", roman: "kungˊ", gloss: "empty", mandarin: "kōng", freq: 382, source: "community-verified", confidence: 0.92 },
  { traditional: "有趣", simplified: "有趣", roman: "iuˊ ci", gloss: "interesting / fun", mandarin: "yǒuqù", freq: 383, source: "community-verified", confidence: 0.9 },
  { traditional: "無聊", simplified: "无聊", roman: "moˇ liauˇ", gloss: "boring", mandarin: "wúliáo", freq: 384, source: "community-verified", confidence: 0.9 },
  { traditional: "強壯", simplified: "强壮", roman: "kiongˇ zong", gloss: "strong / robust", mandarin: "qiángzhuàng", freq: 385, source: "community-verified", confidence: 0.9 },
  { traditional: "奇怪", simplified: "奇怪", roman: "kiˇ guai", gloss: "strange / odd", mandarin: "qíguài", freq: 386, source: "community-verified", confidence: 0.92 },
  // ── Adverbs / conjunctions / particles (more) ──
  { traditional: "還", simplified: "还", roman: "hanˇ", gloss: "still / yet / also", mandarin: "hái", freq: 387, source: "community-verified", confidence: 0.9 },
  { traditional: "再", simplified: "再", roman: "zai", gloss: "again / once more", mandarin: "zài", freq: 388, source: "community-verified", confidence: 0.92 },
  { traditional: "又", simplified: "又", roman: "iu", gloss: "again / also (again)", mandarin: "yòu", freq: 389, source: "community-verified", confidence: 0.9 },
  { traditional: "也", simplified: "也", roman: "iaˊ", gloss: "also / too", mandarin: "yě", freq: 390, source: "community-verified", confidence: 0.9 },
  { traditional: "都", simplified: "都", roman: "duˊ", gloss: "all / both / entirely", mandarin: "dōu", freq: 391, source: "community-verified", confidence: 0.9 },
  { traditional: "就", simplified: "就", roman: "qiu", gloss: "then / right away / exactly", mandarin: "jiù", freq: 392, source: "community-verified", confidence: 0.9 },
  { traditional: "一齊", simplified: "一齐", roman: "idˋ ceˇ", gloss: "together / at the same time", freq: 393, source: "community-verified", confidence: 0.88 },
  { traditional: "然後", simplified: "然后", roman: "ienˇ heu", gloss: "then / afterwards", mandarin: "ránhòu", freq: 394, source: "community-verified", confidence: 0.9 },
  { traditional: "因為", simplified: "因为", roman: "inˊ vui", gloss: "because", mandarin: "yīnwèi", freq: 395, source: "community-verified", confidence: 0.92 },
  { traditional: "所以", simplified: "所以", roman: "soˋ iˊ", gloss: "therefore / so", mandarin: "suǒyǐ", freq: 396, source: "community-verified", confidence: 0.92 },
  { traditional: "但係", simplified: "但是", roman: "tan he", gloss: "but / however", freq: 397, source: "moe-standard", confidence: 0.9 },
  { traditional: "如果", simplified: "如果", roman: "iˇ goˋ", gloss: "if", mandarin: "rúguǒ", freq: 398, source: "community-verified", confidence: 0.92 },
  { traditional: "可能", simplified: "可能", roman: "koˋ nenˇ", gloss: "maybe / possibly", mandarin: "kěnéng", freq: 399, source: "community-verified", confidence: 0.92 },
  { traditional: "一定", simplified: "一定", roman: "idˋ tin", gloss: "definitely / certainly", mandarin: "yídìng", freq: 400, source: "community-verified", confidence: 0.92 },
  // ── Classroom phrases / tutoring commands ──
  { traditional: "看下呢題", simplified: "看下这题", roman: "kon haˊ iaˋ taiˇ", gloss: "look at this question", freq: 401, source: "community-verified", confidence: 0.88 },
  { traditional: "想一下", simplified: "想一下", roman: "xiongˋ idˋ ha", gloss: "think about it a moment", freq: 402, source: "community-verified", confidence: 0.92 },
  { traditional: "試一下", simplified: "试一下", roman: "cii idˋ ha", gloss: "give it a try", freq: 403, source: "community-verified", confidence: 0.92 },
  { traditional: "慢慢想", simplified: "慢慢想", roman: "man man xiongˋ", gloss: "take your time thinking", freq: 404, source: "community-verified", confidence: 0.9 },
  { traditional: "做得好", simplified: "做得好", roman: "zo dedˋ hoˋ", gloss: "well done / good job", freq: 405, source: "community-verified", confidence: 0.92 },
  { traditional: "好厲害", simplified: "好厉害", roman: "hoˋ li hai", gloss: "amazing / great job", freq: 406, source: "community-verified", confidence: 0.9 },
  { traditional: "繼續", simplified: "继续", roman: "gi siug", gloss: "continue / keep going", mandarin: "jìxù", freq: 407, source: "community-verified", confidence: 0.9 },
  { traditional: "再來一次", simplified: "再来一次", roman: "zai loiˇ idˋ cii", gloss: "try once more", freq: 408, source: "community-verified", confidence: 0.9 },
  { traditional: "大聲讀", simplified: "大声读", roman: "tai sangˊ tug", gloss: "read aloud loudly", freq: 409, source: "community-verified", confidence: 0.85 },
  { traditional: "看這", simplified: "看这里", roman: "kon iaˋ", gloss: "look here", freq: 410, source: "community-verified", confidence: 0.88 },
  { traditional: "聽涯講", simplified: "听我讲", roman: "tangˊ ngaiˇ gongˋ", gloss: "listen to me", freq: 411, source: "community-verified", confidence: 0.88 },
  { traditional: "摎涯來", simplified: "跟我来", roman: "lauˊ ngaiˇ loiˇ", gloss: "come with me", freq: 412, source: "community-verified", confidence: 0.85 },
  { traditional: "坐下來", simplified: "坐下来", roman: "coˊ haˊ loiˇ", gloss: "sit down", freq: 413, source: "community-verified", confidence: 0.9 },
  { traditional: "徛起來", simplified: "站起来", roman: "kiˊ hiˋ loiˇ", gloss: "stand up", freq: 414, source: "moe-standard", confidence: 0.85 },
  { traditional: "莫驚", simplified: "别怕", roman: "mog giangˊ", gloss: "don't be afraid", freq: 415, source: "community-verified", confidence: 0.92 },
  { traditional: "莫緊張", simplified: "别紧张", roman: "mog giunˋ zongˊ", gloss: "don't be nervous", freq: 416, source: "community-verified", confidence: 0.88 },
  { traditional: "講分涯知", simplified: "告诉我", roman: "gongˋ bunˊ ngaiˇ diˊ", gloss: "tell me", freq: 417, source: "community-verified", confidence: 0.88 },
  { traditional: "涯知道了", simplified: "我知道了", roman: "ngaiˇ diˊ dedˋ le", gloss: "I understand now / got it", freq: 418, source: "community-verified", confidence: 0.9 },
  { traditional: "食飽無", simplified: "吃饱了吗", roman: "siid bauˋ moˇ", gloss: "have you eaten? (greeting)", freq: 419, source: "community-verified", confidence: 0.88 },
  { traditional: "生日快樂", simplified: "生日快乐", roman: "sangˊ ngidˋ kuai log", gloss: "happy birthday", freq: 420, source: "community-verified", confidence: 0.92 },
  { traditional: "新年快樂", simplified: "新年快乐", roman: "xinˊ ngienˇ kuai log", gloss: "happy new year", freq: 421, source: "community-verified", confidence: 0.92 },
  { traditional: "恭喜", simplified: "恭喜", roman: "giungˊ hiˋ", gloss: "congratulations", mandarin: "gōngxǐ", freq: 422, source: "community-verified", confidence: 0.92 },
  { traditional: "平安", simplified: "平安", roman: "pinˇ onˊ", gloss: "safe and sound / peace", mandarin: "píng'ān", freq: 423, source: "community-verified", confidence: 0.9 },
  // ── Colors ──
  { traditional: "紅", simplified: "红", roman: "fungˇ", gloss: "red", mandarin: "hóng", freq: 424, source: "community-verified", confidence: 0.93 },
  { traditional: "黃", simplified: "黄", roman: "vongˇ", gloss: "yellow", mandarin: "huáng", freq: 425, source: "community-verified", confidence: 0.92 },
  { traditional: "白", simplified: "白", roman: "pag", gloss: "white", mandarin: "bái", freq: 426, source: "community-verified", confidence: 0.93 },
  { traditional: "烏", simplified: "乌", roman: "vuˊ", gloss: "black (dialectal)", freq: 427, source: "community-verified", confidence: 0.9 },
  { traditional: "黑", simplified: "黑", roman: "hedˋ", gloss: "black (standard)", mandarin: "hēi", freq: 428, source: "community-verified", confidence: 0.9 },
  { traditional: "藍", simplified: "蓝", roman: "lamˇ", gloss: "blue", mandarin: "lán", freq: 429, source: "community-verified", confidence: 0.92 },
  { traditional: "綠", simplified: "绿", roman: "liug", gloss: "green", mandarin: "lǜ", freq: 430, source: "community-verified", confidence: 0.92 },
  { traditional: "青", simplified: "青", roman: "qiangˊ", gloss: "green / blue-green / young", mandarin: "qīng", freq: 431, source: "community-verified", confidence: 0.9 },
  { traditional: "紫", simplified: "紫", roman: "ziiˋ", gloss: "purple", mandarin: "zǐ", freq: 432, source: "community-verified", confidence: 0.9 },
  { traditional: "顏色", simplified: "颜色", roman: "nganˇ sedˋ", gloss: "color", mandarin: "yánsè", freq: 433, source: "community-verified", confidence: 0.92 },
  // ── Clothes & accessories ──
  { traditional: "帽", simplified: "帽", roman: "mo", gloss: "hat / cap", mandarin: "mào", freq: 434, source: "community-verified", confidence: 0.92 },
  { traditional: "鞋", simplified: "鞋", roman: "haiˇ", gloss: "shoes", mandarin: "xié", freq: 435, source: "community-verified", confidence: 0.92 },
  { traditional: "襪", simplified: "袜", roman: "mad", gloss: "socks / stockings", mandarin: "wà", freq: 436, source: "community-verified", confidence: 0.9 },
  { traditional: "褲", simplified: "裤", roman: "fu", gloss: "trousers / pants", mandarin: "kù", freq: 437, source: "community-verified", confidence: 0.9 },
  { traditional: "裙", simplified: "裙", roman: "kiunˇ", gloss: "skirt / dress", mandarin: "qún", freq: 438, source: "community-verified", confidence: 0.9 },
  // ── Abstract / misc nouns ──
  { traditional: "道理", simplified: "道理", roman: "to liˊ", gloss: "reason / logic / principle", mandarin: "dàolǐ", freq: 439, source: "community-verified", confidence: 0.9 },
  { traditional: "意思", simplified: "意思", roman: "i sii", gloss: "meaning", mandarin: "yìsi", example: "麼个意思？(What does it mean?)", freq: 440, source: "community-verified", confidence: 0.92 },
  { traditional: "辦法", simplified: "办法", roman: "pan fadˋ", gloss: "method / way / solution", mandarin: "bànfǎ", freq: 441, source: "community-verified", confidence: 0.92 },
  { traditional: "問題", simplified: "问题", roman: "mun tiˇ", gloss: "question / problem", mandarin: "wèntí", freq: 442, source: "community-verified", confidence: 0.93 },
  { traditional: "主意", simplified: "主意", roman: "zuˋ i", gloss: "idea / plan", mandarin: "zhǔyì", freq: 443, source: "community-verified", confidence: 0.9 },
  { traditional: "時間", simplified: "时间", roman: "siiˇ gienˊ", gloss: "time", mandarin: "shíjiān", freq: 444, source: "community-verified", confidence: 0.92 },
  { traditional: "地方", simplified: "地方", roman: "ti fongˊ", gloss: "place / location", mandarin: "dìfāng", freq: 445, source: "community-verified", confidence: 0.92 },
  { traditional: "天氣", simplified: "天气", roman: "tienˊ hi", gloss: "weather", mandarin: "tiānqì", freq: 446, source: "community-verified", confidence: 0.92 },
  { traditional: "事情", simplified: "事情", roman: "sii qinˇ", gloss: "matter / affair / thing", mandarin: "shìqing", freq: 447, source: "community-verified", confidence: 0.9 },
  { traditional: "物件", simplified: "物件", roman: "vud kien", gloss: "things / stuff / object", freq: 448, source: "moe-standard", confidence: 0.85 },
  // ── More tutoring phrases ──
  { traditional: "慢慢來毋著急", simplified: "慢慢来不要急", roman: "man man loiˇ mˇ cog gib", gloss: "take it easy, no rush", freq: 449, source: "community-verified", confidence: 0.88 },
  { traditional: "呢題涯毋會做", simplified: "这题我不会做", roman: "iaˋ taiˇ ngaiˇ mˇ voi zo", gloss: "I can't solve this question", freq: 450, source: "community-verified", confidence: 0.85 },
  { traditional: "講分你知", simplified: "告诉你", roman: "gongˋ bunˊ nˇ diˊ", gloss: "tell you / let me tell you", freq: 451, source: "community-verified", confidence: 0.88 },
  { traditional: "看清楚", simplified: "看清楚", roman: "kon qinˊ coˋ", gloss: "look carefully", freq: 452, source: "community-verified", confidence: 0.9 },
  { traditional: "做著了", simplified: "做对了", roman: "zo cog le", gloss: "that's correct", freq: 453, source: "community-verified", confidence: 0.88 },
  // ── Extra common Hakka tokens ──
  { traditional: "緊", simplified: "紧", roman: "giunˋ", gloss: "to hurry / quickly (dialectal)", example: "緊行 (walk fast)", freq: 454, source: "moe-standard", confidence: 0.85 },
  { traditional: "脈", simplified: "脉", roman: "mag", gloss: "to stare / look hard (dialectal)", freq: 455, source: "llm-suggested", confidence: 0.7 },
  { traditional: "得人惜", simplified: "得人惜", roman: "ded nginˇ xiagˋ", gloss: "lovable / adorable", freq: 456, source: "moe-standard", confidence: 0.85 },
  { traditional: "風颱", simplified: "风台", roman: "fungˊ toiˇ", gloss: "typhoon", freq: 457, source: "moe-standard", confidence: 0.85 },
  { traditional: "下晝時", simplified: "下昼时", roman: "haˊ zu siiˇ", gloss: "afternoon / at afternoon time", freq: 458, source: "llm-suggested", confidence: 0.7 },
  { traditional: "暗晡時", simplified: "暗晡时", roman: "am buˊ siiˇ", gloss: "nighttime / in the evening", freq: 459, source: "moe-standard", confidence: 0.85 },
  { traditional: "頭那", simplified: "头那", roman: "teuˇ na", gloss: "head (colloquial)", freq: 460, source: "moe-standard", confidence: 0.85 },
  { traditional: "目汁", simplified: "目汁", roman: "mugˋ ziib", gloss: "tears (eye liquid)", freq: 461, source: "moe-standard", confidence: 0.85 },
  { traditional: "鼻息", simplified: "鼻息", roman: "pi xiid", gloss: "breath (via nose)", freq: 462, source: "llm-suggested", confidence: 0.7 },
  { traditional: "討食", simplified: "讨食", roman: "toˋ siid", gloss: "to beg for food / ask for food", freq: 463, source: "moe-standard", confidence: 0.8 },
  { traditional: "愛睡", simplified: "爱睡", roman: "oi soi", gloss: "sleepy / want to sleep", freq: 464, source: "community-verified", confidence: 0.85 },
  { traditional: "做得好讚", simplified: "做得真棒", roman: "zo dedˋ hoˋ zan", gloss: "really well done", freq: 465, source: "community-verified", confidence: 0.85 },
  // ── More household / everyday nouns ──
  { traditional: "盤", simplified: "盘", roman: "panˇ", gloss: "plate / tray", mandarin: "pán", freq: 466, source: "community-verified", confidence: 0.9 },
  { traditional: "碗", simplified: "碗", roman: "vonˋ", gloss: "bowl", mandarin: "wǎn", freq: 467, source: "community-verified", confidence: 0.92 },
  { traditional: "筷子", simplified: "筷子", roman: "kuai zii", gloss: "chopsticks", mandarin: "kuàizi", freq: 468, source: "community-verified", confidence: 0.92 },
  { traditional: "鍋", simplified: "锅", roman: "goˊ", gloss: "pot / pan / wok", mandarin: "guō", freq: 469, source: "community-verified", confidence: 0.9 },
  { traditional: "刀", simplified: "刀", roman: "doˊ", gloss: "knife", mandarin: "dāo", freq: 470, source: "community-verified", confidence: 0.92 },
  { traditional: "椅子", simplified: "椅子", roman: "iˋ zii", gloss: "chair (colloquial)", freq: 471, source: "community-verified", confidence: 0.88 },
  { traditional: "鏡", simplified: "镜", roman: "giang", gloss: "mirror", mandarin: "jìng", freq: 472, source: "community-verified", confidence: 0.9 },
  { traditional: "毛巾", simplified: "毛巾", roman: "moˊ giunˊ", gloss: "towel", mandarin: "máojīn", freq: 473, source: "community-verified", confidence: 0.92 },
  { traditional: "牙刷", simplified: "牙刷", roman: "ngaˇ sodˋ", gloss: "toothbrush", mandarin: "yáshuā", freq: 474, source: "community-verified", confidence: 0.92 },
  { traditional: "肥皂", simplified: "肥皂", roman: "puiˇ co", gloss: "soap", mandarin: "féizào", freq: 475, source: "community-verified", confidence: 0.9 },
  { traditional: "垃圾", simplified: "垃圾", roman: "leu sab", gloss: "trash / rubbish", mandarin: "lājī", freq: 476, source: "community-verified", confidence: 0.88 },
  { traditional: "窗門", simplified: "窗门", roman: "cungˊ munˇ", gloss: "window (dialectal)", freq: 477, source: "moe-standard", confidence: 0.85 },
  // ── More school items ──
  { traditional: "黑板", simplified: "黑板", roman: "hedˋ banˋ", gloss: "blackboard", mandarin: "hēibǎn", freq: 478, source: "community-verified", confidence: 0.92 },
  { traditional: "粉筆", simplified: "粉笔", roman: "funˋ bidˋ", gloss: "chalk", mandarin: "fěnbǐ", freq: 479, source: "community-verified", confidence: 0.92 },
  { traditional: "尺", simplified: "尺", roman: "cagˋ", gloss: "ruler", mandarin: "chǐ", freq: 480, source: "community-verified", confidence: 0.9 },
  { traditional: "課堂", simplified: "课堂", roman: "ko tongˇ", gloss: "class / lesson", mandarin: "kètáng", freq: 481, source: "community-verified", confidence: 0.9 },
  { traditional: "作文", simplified: "作文", roman: "zogˋ vunˇ", gloss: "composition / essay", mandarin: "zuòwén", freq: 482, source: "community-verified", confidence: 0.9 },
  // ── More time words ──
  { traditional: "一晝", simplified: "一昼", roman: "idˋ zu", gloss: "a whole morning / one half-day", freq: 483, source: "moe-standard", confidence: 0.85 },
  { traditional: "過身", simplified: "过身", roman: "go siinˊ", gloss: "after passing / by the time", freq: 484, source: "llm-suggested", confidence: 0.6 },
  { traditional: "週", simplified: "周", roman: "ziuˊ", gloss: "week (standard)", mandarin: "zhōu", freq: 485, source: "community-verified", confidence: 0.9 },
  // ── More nature ──
  { traditional: "太陽", simplified: "太阳", roman: "tai iongˇ", gloss: "sun", mandarin: "tàiyáng", freq: 486, source: "community-verified", confidence: 0.92 },
  { traditional: "月亮", simplified: "月亮", roman: "ngiedˋ liong", gloss: "moon", mandarin: "yuèliàng", freq: 487, source: "community-verified", confidence: 0.92 },
  { traditional: "水田", simplified: "水田", roman: "suiˋ tienˇ", gloss: "paddy field", mandarin: "shuǐtián", freq: 488, source: "community-verified", confidence: 0.9 },
  { traditional: "山頂", simplified: "山顶", roman: "sanˊ dangˋ", gloss: "hilltop / mountain top", mandarin: "shāndǐng", freq: 489, source: "community-verified", confidence: 0.9 },
  { traditional: "河壩", simplified: "河坝", roman: "hoˇ ba", gloss: "river / river bank", freq: 490, source: "moe-standard", confidence: 0.85 },
  // ── More verbs ──
  { traditional: "拈", simplified: "拈", roman: "ngiamˊ", gloss: "to pick up / to pinch", example: "拈起來 (pick it up)", freq: 491, source: "moe-standard", confidence: 0.85 },
  { traditional: "擎", simplified: "擎", roman: "kiaˇ", gloss: "to lift / to hold up", example: "擎起來 (lift it up)", freq: 492, source: "moe-standard", confidence: 0.85 },
  { traditional: "跋", simplified: "跋", roman: "bad", gloss: "to fall / to trip", example: "跋倒 (fall over)", freq: 493, source: "moe-standard", confidence: 0.8 },
  { traditional: "忖", simplified: "忖", roman: "cunˋ", gloss: "to think / to ponder (dialectal)", freq: 494, source: "moe-standard", confidence: 0.85 },
  { traditional: "講古", simplified: "讲古", roman: "gongˋ guˋ", gloss: "to tell a story (dialectal)", freq: 495, source: "moe-standard", confidence: 0.88 },
  { traditional: "相借問", simplified: "相借问", roman: "xiongˊ jia mun", gloss: "to greet / exchange greetings", freq: 496, source: "moe-standard", confidence: 0.82 },
  // ── More adjectives ──
  { traditional: "靚靚", simplified: "靓靓", roman: "jiang jiang", gloss: "very pretty / lovely", freq: 497, source: "community-verified", confidence: 0.88 },
  { traditional: "盡好", simplified: "尽好", roman: "qin hoˋ", gloss: "extremely good", freq: 498, source: "moe-standard", confidence: 0.85 },
  { traditional: "盡會", simplified: "尽会", roman: "qin voi", gloss: "very capable", freq: 499, source: "moe-standard", confidence: 0.85 },
  { traditional: "輕鬆", simplified: "轻松", roman: "kiangˊ sungˊ", gloss: "relaxed / lighthearted", mandarin: "qīngsōng", freq: 500, source: "community-verified", confidence: 0.92 },
  { traditional: "緊張", simplified: "紧张", roman: "giunˋ zongˊ", gloss: "nervous / tense", mandarin: "jǐnzhāng", freq: 501, source: "community-verified", confidence: 0.92 },
  { traditional: "舒服", simplified: "舒服", roman: "suˊ fug", gloss: "comfortable", mandarin: "shūfu", freq: 502, source: "community-verified", confidence: 0.92 },
  { traditional: "好痛", simplified: "好痛", roman: "hoˋ tung", gloss: "very painful", freq: 503, source: "community-verified", confidence: 0.9 },
  { traditional: "口渴", simplified: "口渴", roman: "heuˋ hodˋ", gloss: "thirsty", mandarin: "kǒukě", freq: 504, source: "community-verified", confidence: 0.9 },
  // ── More phrases ──
  { traditional: "愛睡目", simplified: "爱睡觉", roman: "oi soi mugˋ", gloss: "sleepy / want to sleep", freq: 505, source: "moe-standard", confidence: 0.85 },
  { traditional: "緊來", simplified: "快来", roman: "giunˋ loiˇ", gloss: "come quickly / hurry up", freq: 506, source: "moe-standard", confidence: 0.88 },
  { traditional: "慢慢行", simplified: "慢慢走", roman: "man man hangˇ", gloss: "walk slowly / take care (farewell)", freq: 507, source: "community-verified", confidence: 0.9 },
  { traditional: "毋使驚", simplified: "不用怕", roman: "mˇ siiˋ giangˊ", gloss: "no need to be afraid", freq: 508, source: "moe-standard", confidence: 0.88 },
  { traditional: "係毋係", simplified: "是不是", roman: "he mˇ he", gloss: "is it or not? (question tag)", freq: 509, source: "community-verified", confidence: 0.88 },
  { traditional: "恁樣", simplified: "这样", roman: "anˋ ngiong", gloss: "this way / like this", freq: 510, source: "moe-standard", confidence: 0.85 },
  { traditional: "該樣", simplified: "那样", roman: "ge ngiong", gloss: "that way / like that", freq: 511, source: "moe-standard", confidence: 0.85 },
  { traditional: "做得啦", simplified: "可以了", roman: "zo dedˋ la", gloss: "that's fine / all good", freq: 512, source: "community-verified", confidence: 0.88 },
  { traditional: "打幫你", simplified: "打帮你", roman: "daˋ bongˊ nˇ", gloss: "thanks to you (gratitude)", freq: 513, source: "moe-standard", confidence: 0.82 },
  { traditional: "身體健康", simplified: "身体健康", roman: "siinˊ tiˋ kien gongˊ", gloss: "good health", freq: 514, source: "community-verified", confidence: 0.88 },
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
    if (b.entry.confidence !== a.entry.confidence)
      return b.entry.confidence - a.entry.confidence;
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
