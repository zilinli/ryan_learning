/**
 * 方言 STT 转写结果的 LLM 纠错（兜底路径）。
 *
 * 讯飞/本地 Whisper 对潮汕话/客家话口语的识别可能混入普通话同音字
 * （如"我"被听成"涯"/"汝"），这一步把「转写文本 + 方言高频词表」交给
 * LLM，只做同音/用词纠错，禁止扩写与语义改写，输出严格 JSON。
 *
 * 解析失败一律回退原文，绝不阻塞语音输入。
 */
import type { SpeechLang } from "./voices";
import { TEOCHEW_DICT } from "./teochew-dict";
import { HAKKA_DICT } from "./hakka-dict";

export type DialectSttCorrectResult = {
  corrected: string;
  changed: boolean;
  raw: string;
};

export type DialectKind = "teo" | "hak";

/** 从词典抽取高置信度的核心词汇，用于给 LLM 提供同音词纠错参考。 */
export function topDialectWords(
  dialect: DialectKind,
  limit = 40,
): string[] {
  const dict = dialect === "teo" ? TEOCHEW_DICT : HAKKA_DICT;
  const verified = dict
    .filter((e) => e.source === "community-verified")
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of verified) {
    for (const w of [e.traditional, e.simplified]) {
      if (out.length >= limit) break;
      if (w && !seen.has(w)) {
        seen.add(w);
        out.push(w);
      }
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** 构建纠错 prompt（纯函数，便于测试）。 */
export function buildDialectCorrectionPrompt(
  raw: string,
  dialect: DialectKind,
): string {
  const name = dialect === "teo" ? "潮汕话（潮州话）" : "客家话";
  const words = topDialectWords(dialect).join(" ");
  return [
    `你是方言语音转写校对助手。以下是一段儿童用【${name}】说的话被语音识别（ASR）转写出的文本，可能含很多普通话同音字错误。`,
    ``,
    `该方言常见书面用词（高频词参考，可据此纠错）：${words}`,
    ``,
    `要求：`,
    `1. 只修正明显的同音字/方言用词错误（例如潮汕话：我→我/涯→我；汝/你→汝；勿→勿；乜个→乜个。客家话：涯→涯；汝/你→汝；麼个→麼个；毋→毋）。`,
    `2. 严禁扩写、严禁改写语义、严禁把学生的话翻译成普通话、严禁增加原文没有的内容。`,
    `3. 不确定的字词保持原样，不要臆造生僻字（不要使用 CJK 扩展区生僻字）。`,
    `4. 只输出严格 JSON，不要多余文字：{"corrected": "纠错后的文本", "changed": true或false}`,
    ``,
    `原始转写文本：`,
    `${raw}`,
  ].join("\n");
}

/** 解析 LLM 输出的严格 JSON；解析失败回退原文。 */
export function parseCorrectionResult(
  rawLlm: string,
  fallback: string,
): DialectSttCorrectResult {
  const t = (rawLlm || "").trim();
  // 允许 LLM 在 JSON 外包裹 ```json ... ``` 或少量说明
  const jsonMatch = t.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { corrected: fallback, changed: false, raw: fallback };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      corrected?: unknown;
      changed?: unknown;
    };
    const corrected = typeof parsed.corrected === "string"
      ? parsed.corrected.trim()
      : "";
    if (!corrected) {
      return { corrected: fallback, changed: false, raw: fallback };
    }
    return {
      corrected,
      changed: parsed.changed === true,
      raw: fallback,
    };
  } catch {
    return { corrected: fallback, changed: false, raw: fallback };
  }
}

/** 供外部调用方判断当前 voice 是否为方言模式。 */
export function isDialectLang(lang: SpeechLang | "auto"): lang is DialectKind {
  return lang === "teo" || lang === "hak";
}
