/**
 * B3 — Lexical confusable-term layer for voice confirm-intent.
 * No ASR confidence required; client-side match after /api/transcribe.
 */

export type ConfusablePair = {
  id: string;
  /** Transcript-side triggers */
  heard: string[];
  confusedWith: string[];
  /** Only fire when recent conversation context matches */
  skillIds?: string[];
  /** Confirm-question shown to child */
  confirmLine: string;
};

/** ~20 G4-scoped pairs — math homophones + dialect drift + code-switch. */
export const CONFUSABLE_SEED: ConfusablePair[] = [
  {
    id: "chuyi-chufa",
    heard: ["除以"],
    confusedWith: ["除法"],
    skillIds: ["division-basics", "multi-step-word-problems"],
    confirmLine: "你是说「除以」还是「除法」？",
  },
  {
    id: "chufa-chuyi",
    heard: ["除法"],
    confusedWith: ["除以"],
    skillIds: ["division-basics", "multi-step-word-problems"],
    confirmLine: "你是说「除法」还是「除以」？",
  },
  {
    id: "chengyi-chengfa",
    heard: ["乘以"],
    confusedWith: ["乘法"],
    skillIds: ["multiplication-facts", "multi-step-word-problems"],
    confirmLine: "你是说「乘以」还是「乘法」？",
  },
  {
    id: "chengfa-chengyi",
    heard: ["乘法"],
    confusedWith: ["乘以"],
    skillIds: ["multiplication-facts"],
    confirmLine: "你是说「乘法」还是「乘以」？",
  },
  {
    id: "gongbeishu-gongyueshu",
    heard: ["公倍数"],
    confusedWith: ["公约数"],
    skillIds: ["fractions-concepts", "equivalent-fractions"],
    confirmLine: "你是说「公倍数」还是「公约数」？",
  },
  {
    id: "gongyueshu-gongbeishu",
    heard: ["公约数"],
    confusedWith: ["公倍数"],
    skillIds: ["fractions-concepts", "equivalent-fractions"],
    confirmLine: "你是说「公约数」还是「公倍数」？",
  },
  {
    id: "fenzi-fenmu",
    heard: ["分子"],
    confusedWith: ["分母"],
    skillIds: ["fractions-concepts", "equivalent-fractions", "fraction-word-problems"],
    confirmLine: "你是说「分子」还是「分母」？",
  },
  {
    id: "fenmu-fenzi",
    heard: ["分母"],
    confusedWith: ["分子"],
    skillIds: ["fractions-concepts", "equivalent-fractions", "fraction-word-problems"],
    confirmLine: "你是说「分母」还是「分子」？",
  },
  {
    id: "jia-jian-clip",
    heard: ["加上", "加一"],
    confusedWith: ["减去", "减一"],
    skillIds: ["multi-step-word-problems", "place-value"],
    confirmLine: "你是说「加」还是「减」？",
  },
  {
    id: "zhishu-xiaoshu",
    heard: ["整数"],
    confusedWith: ["小数"],
    skillIds: ["decimals", "place-value"],
    confirmLine: "你是说「整数」还是「小数」？",
  },
  {
    id: "xiaoshu-zhishu",
    heard: ["小数"],
    confusedWith: ["整数"],
    skillIds: ["decimals", "place-value"],
    confirmLine: "你是说「小数」还是「整数」？",
  },
  {
    id: "jiao-zhijiao",
    heard: ["直角"],
    confusedWith: ["锐角", "钝角"],
    skillIds: ["geometry-angles"],
    confirmLine: "你是说「直角」还是别的角？",
  },
  {
    id: "miji-tiji",
    heard: ["面积"],
    confusedWith: ["体积"],
    skillIds: ["geometry-measure", "volume-intro", "measurement-units"],
    confirmLine: "你是说「面积」还是「体积」？",
  },
  {
    id: "tiji-miji",
    heard: ["体积"],
    confusedWith: ["面积"],
    skillIds: ["volume-intro", "geometry-measure"],
    confirmLine: "你是说「体积」还是「面积」？",
  },
  {
    id: "plus-code-switch",
    heard: ["破斯", "plus"],
    confusedWith: ["加", "plus"],
    skillIds: ["multi-step-word-problems", "place-value"],
    confirmLine: 'Did you mean "plus / 加"?',
  },
  {
    id: "times-twice",
    heard: ["times", "太姆斯"],
    confusedWith: ["twice", "乘"],
    skillIds: ["multiplication-facts"],
    confirmLine: 'Did you mean "times" or "twice"?',
  },
  {
    id: "divide-by",
    heard: ["divide by", "底外"],
    confusedWith: ["division", "除以"],
    skillIds: ["division-basics"],
    confirmLine: 'Did you mean "divide by / 除以"?',
  },
  {
    id: "teo-chu",
    heard: ["除开", "除開"],
    confusedWith: ["除以", "除法"],
    skillIds: ["division-basics"],
    confirmLine: "你是说「除以」还是「除法」？（听到像「除开」）",
  },
  {
    id: "remainder-yushu",
    heard: ["余数", "餘數"],
    confusedWith: ["商"],
    skillIds: ["division-basics"],
    confirmLine: "你是说「余数」还是「商」？",
  },
  {
    id: "shang-yushu",
    heard: ["商是", "商等于"],
    confusedWith: ["余数"],
    skillIds: ["division-basics"],
    confirmLine: "你是说「商」还是在问「余数」？",
  },
];

const CONFIRM_TIMEOUT_MS = 4000;

export function confirmTimeoutMs(): number {
  return CONFIRM_TIMEOUT_MS;
}

/**
 * Find first confusable match. When skillIds are set on a pair, require
 * overlap with recentSkillIds (empty recent → no skill-gated fire).
 */
export function detectConfusable(
  transcript: string,
  recentSkillIds: string[] = [],
): ConfusablePair | null {
  const text = (transcript || "").trim();
  if (!text) return null;
  for (const pair of CONFUSABLE_SEED) {
    if (pair.skillIds?.length) {
      if (!recentSkillIds.length) continue;
      if (!pair.skillIds.some((id) => recentSkillIds.includes(id))) continue;
    }
    if (pair.heard.some((h) => h && text.includes(h))) return pair;
  }
  return null;
}

/** Chip options: heard term first, then confusedWith alternatives. */
export function confirmOptions(pair: ConfusablePair): string[] {
  const first = pair.heard[0] || "";
  const rest = pair.confusedWith.filter((x) => x && x !== first);
  return [first, ...rest].filter(Boolean).slice(0, 3);
}

/** Replace the first heard trigger with the chosen term. */
export function applyConfusableChoice(
  transcript: string,
  pair: ConfusablePair,
  chosen: string,
): string {
  const text = transcript || "";
  for (const h of pair.heard) {
    if (h && text.includes(h)) {
      return text.replace(h, chosen);
    }
  }
  return text;
}
