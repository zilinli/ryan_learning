/**
 * 客家话 FormoSpeech 文本规范化。
 * formog2p 主要认台湾客语推荐用字（繁体）；简体未知字 / 引号 / 数字会导致 422。
 */
import { Converter } from "opencc-js";

const converter = Converter({ from: "cn", to: "tw" });

const DIGIT_ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;

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

  // G2P 不认的书名号/引号/方括号 → 去掉（日志里 422 就是 「」）
  t = t.replace(/[「」『』【】《》〈〉〔〕〖〗〘〙〚〛]/g, "");
  t = t.replace(/[“”‘’\"']/g, "");
  t = t.replace(/[、]/g, "，");
  t = t.replace(/[…‥]+/g, "。");
  t = t.replace(/[—–－〜～]+/g, "，");
  t = t.replace(/[·•∙・]/g, "");

  // ASCII/全角标点统一
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

  // 阿拉伯数字 → 汉字（逐位；G2P 不认 0-9）
  t = t.replace(/[0-9０-９]+/g, (m) =>
    [...m]
      .map((ch) => {
        const n = "０１２３４５６７８９".indexOf(ch);
        const d = n >= 0 ? n : Number(ch);
        return Number.isInteger(d) && d >= 0 && d <= 9 ? DIGIT_ZH[d] : "";
      })
      .join(""),
  );

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

  // 口语用字：我→涯（客家话第一人称；避開「我們」）
  t = t.replace(/我(?!們)/g, "涯");

  t = t.replace(/\s+/g, " ").trim();
  // 去掉首尾多余逗号/空格，保留句末 。！？
  t = t.replace(/^[，；：\s]+/, "").replace(/[，；：\s]+$/, "");
  return t.trim();
}
