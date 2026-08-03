/**
 * BASIS G4–oriented skill graph for Ryan.
 * Skills are micro-skills for BKT; topicId maps to legacy topic buckets.
 */

export type SkillDef = {
  id: string;
  label: string;
  /** Coarse topic for backward-compatible topic list */
  topicId: string;
  subject: "math" | "science" | "ela" | "humanities";
  /** Prerequisite skill ids (soft — used for tutoring advice) */
  requires?: string[];
  /** Keyword matcher */
  re: RegExp;
};

export const SKILL_CATALOG: SkillDef[] = [
  {
    id: "multiplication-facts",
    label: "multiplication facts",
    topicId: "multiplication",
    subject: "math",
    re: /\bmultipl|times table|×|\bx\s*\d+|乘法|乘以|七乘|九九/i,
  },
  {
    id: "place-value",
    label: "place value",
    topicId: "decimals",
    subject: "math",
    re: /\bplace value|ones|tens|hundreds|位值|个位|十位|百位/i,
  },
  {
    id: "decimals",
    label: "decimals",
    topicId: "decimals",
    subject: "math",
    requires: ["place-value"],
    re: /\bdecimal|小数|小數|0\.\d/i,
  },
  {
    id: "fractions-concepts",
    label: "fraction concepts",
    topicId: "fractions",
    subject: "math",
    re: /\bfract|numerator|denominator|分数|分數|分子|分母/i,
  },
  {
    id: "equivalent-fractions",
    label: "equivalent fractions",
    topicId: "fractions",
    subject: "math",
    requires: ["fractions-concepts", "multiplication-facts"],
    re: /\bequivalent|\bsimplif|约分|約分|等值分数|同分母|通分/i,
  },
  {
    id: "fraction-word-problems",
    label: "fraction word problems",
    topicId: "fractions",
    subject: "math",
    requires: ["fractions-concepts", "equivalent-fractions"],
    re: /\bword problem|story problem|how many|应用题|應用題|应用|應用|share|equally|一共/i,
  },
  {
    id: "division-basics",
    label: "division / long division",
    topicId: "division",
    subject: "math",
    requires: ["multiplication-facts"],
    re: /\bdivid|÷|除法|除以|long division|余数|餘數/i,
  },
  {
    id: "geometry-angles",
    label: "angles & triangles",
    topicId: "geometry",
    subject: "math",
    re: /\bangle|triangle|right angle|直角|三角形|角|hypotenuse|斜边|斜邊/i,
  },
  {
    id: "geometry-measure",
    label: "perimeter & area",
    topicId: "geometry",
    subject: "math",
    requires: ["multiplication-facts"],
    re: /\bperimeter|area|周长|周長|面积|面積|square unit/i,
  },
  {
    id: "reading-evidence",
    label: "reading with evidence",
    topicId: "reading",
    subject: "ela",
    re: /\breading|comprehension|passage|evidence|引用|阅读|閱讀|理解|段落/i,
  },
  {
    id: "narrative-writing",
    label: "narrative writing",
    topicId: "writing",
    subject: "ela",
    re: /\bparagraph|essay|writing|story|narrative|作文|写作|寫作|叙事/i,
  },
  {
    id: "earth-moon-sun",
    label: "Earth–Moon–Sun / space",
    topicId: "science-space",
    subject: "science",
    re: /\bmoon|phase|solar|planet|earth|sun|月亮|月相|太阳系|太陽系|日食|月食/i,
  },
  {
    id: "ecosystems",
    label: "ecosystems",
    topicId: "science-eco",
    subject: "science",
    re: /\becosystem|habitat|food chain|生态|生態|食物链|食物鏈/i,
  },
  {
    id: "ancient-civ",
    label: "ancient civilizations",
    topicId: "humanities",
    subject: "humanities",
    re: /\begypt|mesopotamia|civilization|pharaoh|埃及|美索不|文明|金字塔/i,
  },
];

const BY_ID = new Map(SKILL_CATALOG.map((s) => [s.id, s]));

export function getSkillDef(id: string): SkillDef | undefined {
  return BY_ID.get(id);
}

export function inferSkillsFromText(text: string): SkillDef[] {
  const t = text || "";
  const hits: SkillDef[] = [];
  for (const skill of SKILL_CATALOG) {
    if (skill.re.test(t)) hits.push(skill);
  }
  // Word-problem + fraction cues → also tag fraction-word-problems
  if (
    /\bfract|分数|分數/i.test(t) &&
    /\bword problem|story|应用|應用|how many|一共/i.test(t)
  ) {
    const wp = BY_ID.get("fraction-word-problems");
    if (wp && !hits.some((h) => h.id === wp.id)) hits.push(wp);
  }
  return hits;
}

export function topicLabelForId(topicId: string): string {
  const hit = SKILL_CATALOG.find((s) => s.topicId === topicId);
  return hit?.label || topicId;
}
