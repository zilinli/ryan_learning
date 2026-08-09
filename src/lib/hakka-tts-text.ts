/**
 * 客家话 FormoSpeech 文本规范化。
 *
 * formog2p 主要认台湾客语推荐用字（繁体）；模型词表标点只有「，」与空格。
 * 普通话书面语直接送合成会：① 未知字被剥掉导致断句怪；② 。！？被丢弃没停顿。
 * 这里做：简→繁、常用词→客语书面、数字口语化、句读统一成可停顿的逗号。
 */
import { Converter } from "opencc-js";

const converter = Converter({ from: "cn", to: "tw" });

/** Cache / voice bump when normalize rules change (invalidates old mp3). */
export const HAKKA_TTS_TEXT_VERSION = "v2";

const DIGIT_ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;

/**
 * 普通话/书面 → 客语推荐用字（繁体键；最长优先）。
 * 只收 G2P 已验证无 unknown 的写法。
 */
const HAKKA_LEXICON: ReadonlyArray<readonly [string, string]> = [
  // phrases first
  ["是不是", "係唔係"],
  ["好不好", "好唔好"],
  ["對不對", "著唔著"],
  ["对不对", "著唔著"],
  ["可不可以", "做得無"],
  ["能不能", "做得唔做得"],
  ["為什麼", "做麼个"],
  ["为什么", "做麼个"],
  ["怎麼樣", "仰般"],
  ["怎么样", "仰般"],
  ["怎麼辦", "仰般辦"],
  ["怎么办", "仰般辦"],
  ["怎麼", "仰般"],
  ["怎么", "仰般"],
  ["什麼", "麼个"],
  ["什么", "麼个"],
  ["哪裏", "哪位"],
  ["哪里", "哪位"],
  ["哪兒", "哪位"],
  ["哪儿", "哪位"],
  ["多少", "幾多"],
  ["沒有", "冇"],
  ["没有", "冇"],
  ["不是", "毋係"],
  ["不會", "毋會"],
  ["不会", "毋會"],
  ["不知道", "毋知"],
  ["不知", "毋知"],
  ["告訴", "講分"],
  ["告诉", "講分"],
  ["我們", "涯等"],
  ["我们", "涯等"],
  ["你們", "你等"],
  ["你们", "你等"],
  ["他們", "佢等"],
  ["他们", "佢等"],
  ["她們", "佢等"],
  ["她们", "佢等"],
  ["可以", "做得"],
  ["一起", "共下"],
  ["非常", "當"],
  ["很好", "當好"],
  ["現在", "這下"],
  ["现在", "這下"],
  ["今天", "今日"],
  ["但是", "毋過"],
  ["可是", "毋過"],
  ["如果", "若係"],
  ["或者", "定係"],
  ["還是", "定係"],
  ["还是", "定係"],
  ["自己", "自家"],
  ["別人", "別儕"],
  ["别人", "別儕"],
  ["誰", "麼儕"],
  ["谁", "麼儕"],
  ["一個", "一隻"],
  ["一个", "一隻"],
  ["這個", "這隻"],
  ["这个", "這隻"],
  ["那個", "該隻"],
  ["那个", "該隻"],
  ["一點", "一滴仔"],
  ["一点", "一滴仔"],
  ["一次", "一擺"],
  ["再試", "再試"],
  ["看看", "看一下"],
  ["試試", "試一下"],
  ["试试", "試一下"],
  ["想想", "想一下"],
  ["走路", "行路"],
  ["吃飯", "食飯"],
  ["吃饭", "食飯"],
  ["同你", "摎你"],
  ["同佢", "摎佢"],
  ["同他", "摎佢"],
  ["同她", "摎佢"],
  ["同涯", "摎涯"],
  ["跟你", "摎你"],
  ["跟佢", "摎佢"],
  ["和他", "摎佢"],
  ["和她", "摎佢"],
  ["和你", "摎你"],
  ["和涯", "摎涯"],
  ["給你", "分你"],
  ["给你", "分你"],
  ["給涯", "分涯"],
  ["给我", "分涯"],
  ["老師", "老師"],
  // single chars / short
  ["沒", "冇"],
  ["没", "冇"],
  ["嗎", "無"],
  ["吗", "無"],
  ["他", "佢"],
  ["她", "佢"],
  ["它", "佢"],
  ["吃", "食"],
  ["說", "講"],
  ["说", "講"],
  ["傾", "講"],
  ["倾", "講"],
  ["給", "分"],
  ["给", "分"],
  ["和", "摎"],
  ["跟", "摎"],
  ["的", "个"],
];

function applyHakkaLexicon(text: string): string {
  let t = text;
  // longest-first
  const sorted = [...HAKKA_LEXICON].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of sorted) {
    if (!from || from === to) continue;
    if (t.includes(from)) t = t.split(from).join(to);
  }
  // restore false positives from 的→个
  t = t.replace(/个確/g, "的確").replace(/目个/g, "目的").replace(/个確/g, "的確");
  return t;
}

/** 非负整数 → 汉语口语（供客语 G2P；避免「12」念成「一二」）。 */
export function numberToZhSpoken(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 10) return DIGIT_ZH[n]!;
  if (n < 20) return n === 10 ? "十" : `十${DIGIT_ZH[n % 10]}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${DIGIT_ZH[tens]}十${ones ? DIGIT_ZH[ones] : ""}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    let s = `${DIGIT_ZH[hundreds]}百`;
    if (rest === 0) return s;
    if (rest < 10) return `${s}零${DIGIT_ZH[rest]}`;
    return s + numberToZhSpoken(rest);
  }
  if (n < 10000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    let s = `${DIGIT_ZH[thousands]}千`;
    if (rest === 0) return s;
    if (rest < 100) return `${s}零${numberToZhSpoken(rest)}`;
    return s + numberToZhSpoken(rest);
  }
  // 过大：逐位，避免怪异读法
  return String(Math.floor(n))
    .split("")
    .map((ch) => DIGIT_ZH[Number(ch)] ?? "")
    .join("");
}

function replaceNumbers(text: string): string {
  return text.replace(/[0-9０-９]+(?:\.[0-9０-９]+)?/g, (raw) => {
    const ascii = raw.replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    );
    if (ascii.includes(".")) {
      const [a, b] = ascii.split(".");
      const head = numberToZhSpoken(Number(a));
      const frac = [...(b || "")].map((d) => DIGIT_ZH[Number(d)] ?? "").join("");
      return frac ? `${head}點${frac}` : head;
    }
    const n = Number(ascii);
    if (!Number.isFinite(n) || ascii.length > 6) {
      return [...ascii].map((d) => DIGIT_ZH[Number(d)] ?? "").join("");
    }
    return numberToZhSpoken(n);
  });
}

/**
 * 模型 punctuations 只有「， 」——把句读收成逗号，保留自然停顿。
 * 连续逗号压成一个。
 */
function unifyPauses(text: string): string {
  let t = text
    .replace(/[。！？；：]+/g, "，")
    .replace(/[，]{2,}/g, "，")
    .replace(/\s*，\s*/g, "，");
  t = t.replace(/^[，\s]+/, "").replace(/[，\s]+$/, "");
  return t;
}

/** 简体/异体 → 台湾客语书面繁体，并去掉 G2P 不认的符号，供 FormoSpeech。 */
export function normalizeHakkaForTts(raw: string): string {
  let t = (raw || "").normalize("NFC").trim();
  if (!t) return t;

  // LaTeX / 行内公式 → 略读
  t = t.replace(/\$\$[\s\S]*?\$\$/g, " ");
  t = t.replace(/\$[^$]+\$/g, " ");
  t = t.replace(/\\\([\s\S]*?\\\)/g, " ");
  t = t.replace(/\\\[[\s\S]*?\\\]/g, " ");

  // Markdown 噪音
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");

  // G2P 不认的书名号/引号/方括号
  t = t.replace(/[「」『』【】《》〈〉〔〕〖〗〘〙〚〛]/g, "");
  t = t.replace(/[“”‘’\"']/g, "");
  t = t.replace(/[、]/g, "，");
  t = t.replace(/[…‥]+/g, "。");
  t = t.replace(/[—–－〜～]+/g, "，");
  t = t.replace(/[·•∙・]/g, "");

  // ASCII/全角标点统一（稍后 unifyPauses 再收成逗号）
  t = t
    .replace(/[!！]+/g, "！")
    .replace(/[?？]+/g, "？")
    .replace(/[,，]+/g, "，")
    .replace(/[.。]+/g, "。")
    .replace(/[;；]+/g, "；")
    .replace(/[:：]+/g, "：");

  // 选择题标记 → 客语可念
  t = t.replace(/\bA\s*[)）．.]/gi, "甲，");
  t = t.replace(/\bB\s*[)）．.]/gi, "乙，");
  t = t.replace(/\bC\s*[)）．.]/gi, "丙，");
  t = t.replace(/\bD\s*[)）．.]/gi, "丁，");

  t = replaceNumbers(t);

  // 数学运算符号口语化
  t = t
    .replace(/[×✕✖]/g, "乘")
    .replace(/[÷]/g, "除")
    .replace(/[＋+]/g, "加")
    .replace(/[－\-]/g, "减")
    .replace(/[=＝]/g, "等于")
    .replace(/[%％]/g, "百分之");

  // 其余拉丁/符号噪音（保留空格；英文单词留给 include_eng）
  t = t.replace(/[^\u4e00-\u9fffA-Za-z\s，。！？；：]/g, " ");

  t = converter(t);
  t = applyHakkaLexicon(t);

  // 口语用字：我→涯（客家话第一人称；避開「我們」已替换为涯等）
  t = t.replace(/我(?!們)/g, "涯");

  t = t.replace(/\s+/g, " ").trim();
  t = unifyPauses(t);
  return t.trim();
}
