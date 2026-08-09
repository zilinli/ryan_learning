/**
 * 客家话 FormoSpeech 文本规范化。
 * formog2p 主要认台湾客语推荐用字（繁体）；简体未知字会被丢掉 → 怪声。
 */
import { Converter } from "opencc-js";

const converter = Converter({ from: "cn", to: "tw" });

/** 简体/异体 → 台湾客语书面繁体，供 FormoSpeech G2P。 */
export function normalizeHakkaForTts(raw: string): string {
  let t = (raw || "").normalize("NFC").trim();
  if (!t) return t;

  t = t
    .replace(/[!！]+/g, "！")
    .replace(/[?？]+/g, "？")
    .replace(/[,，]+/g, "，")
    .replace(/[.。]+/g, "。")
    .replace(/;；/g, "；")
    .replace(/:：/g, "：");

  t = converter(t);

  // 口语用字：我→涯（客家话第一人称；避開「我們」）
  t = t.replace(/我(?!們)/g, "涯");

  return t.trim();
}
