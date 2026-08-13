/**
 * Grade-agnostic skill graph — supports K-12 (BASIS-aligned).
 * Skills are micro-skills for BKT; topicId maps to legacy topic buckets.
 */
export type SkillDef = {
  id: string;
  label: string;
  /** Coarse topic for backward-compatible topic list */
  topicId: string;
  subject: "math" | "science" | "ela" | "humanities" | "language" | "general";
  /** Minimum grade for this skill to appear */
  minGrade: number;
  /** Grade at which this skill is "core" (ZPD-weighted) */
  coreGrade: number;
  /** Maximum grade after which this skill is considered mastered/retired */
  maxGrade: number;
  /** Skill band */
  band: "early" | "elementary" | "middle" | "high";
  /** Prerequisite skill ids (soft — used for tutoring advice) */
  requires?: string[];
  /**
   * P2 — adjacent skill ids: nearby-but-different skills that naturally follow
   * once this one is mastered (breadth grows out of depth). Not prerequisites —
   * they are fresh territory worth peeking into.
   */
  adjacent?: string[];
  /** Keyword matcher */
  re: RegExp;
};

export const SKILL_CATALOG: SkillDef[] = [
  // ── Early band (K-2) ───────────────────────────────────────────
  {
    id: "counting-cardinality",
    label: "counting & cardinality",
    topicId: "math-early",
    subject: "math",
    minGrade: 0, coreGrade: 1, maxGrade: 2, band: "early",
    re: /\bcount|how many|数|多少个|cómo muchos/i,
  },
  {
    id: "addition-subtraction-20",
    label: "+/- within 20",
    topicId: "math-early",
    subject: "math",
    minGrade: 0, coreGrade: 1, maxGrade: 2, band: "early",
    re: /\badd|subtract|plus|minus|sum|difference|加|减|suma|resta/i,
  },
  {
    id: "place-value-100",
    label: "place value to 100",
    topicId: "math-early",
    subject: "math",
    minGrade: 1, coreGrade: 2, maxGrade: 3, band: "early",
    re: /\bplace value|ones|tens|位值|个位|十位/i,
  },
  {
    id: "basic-shapes",
    label: "basic shapes",
    topicId: "geometry-early",
    subject: "math",
    minGrade: 0, coreGrade: 1, maxGrade: 2, band: "early",
    re: /\bsquare|circle|triangle|rectangl|形状|正方形|圆|三角|formas/i,
  },
  {
    id: "measurement-intro",
    label: "measurement intro",
    topicId: "math-early",
    subject: "math",
    minGrade: 1, coreGrade: 2, maxGrade: 3, band: "early",
    re: /\blong|short|heavy|light|tall|长度|重量|高|矮/i,
  },
  {
    id: "telling-time",
    label: "telling time",
    topicId: "math-early",
    subject: "math",
    minGrade: 1, coreGrade: 2, maxGrade: 3, band: "early",
    re: /\bclock|time|hour|minute|o.?clock|时间|钟|点/i,
  },
  {
    id: "letter-sounds",
    label: "letter sounds / phonics",
    topicId: "ela-early",
    subject: "ela",
    minGrade: 0, coreGrade: 1, maxGrade: 2, band: "early",
    re: /\bphonics|letter sound|sight word|字母|拼读|识字/i,
  },
  {
    id: "simple-sentences",
    label: "simple sentences",
    topicId: "ela-early",
    subject: "ela",
    minGrade: 0, coreGrade: 1, maxGrade: 2, band: "early",
    re: /\bread|sentence|story|阅读|故事|句子/i,
  },
  {
    id: "science-observations",
    label: "observations & questions",
    topicId: "science-early",
    subject: "science",
    minGrade: 0, coreGrade: 1, maxGrade: 2, band: "early",
    re: /\bwhy|where|observe|see|look|为什么|看到|观察/i,
  },

  // ── Elementary band (G3-5) — baseline, includes existing 14 G4 skills ──
  {
    id: "multiplication-facts",
    label: "multiplication facts",
    topicId: "multiplication",
    subject: "math",
    minGrade: 2, coreGrade: 3, maxGrade: 5, band: "elementary",
    re: /\bmultipl|times table|×|\bx\s*\d+|乘法|乘以|七乘|九九/i,
  },
  {
    id: "division-basics",
    label: "division / long division",
    topicId: "division",
    subject: "math",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    requires: ["multiplication-facts"],
    adjacent: ["ratios-proportions"],
    re: /\bdivid|÷|除法|除以|long division|余数|餘數/i,
  },
  {
    id: "multi-step-word-problems",
    label: "multi-step word problems",
    topicId: "word-problems",
    subject: "math",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    requires: ["multiplication-facts", "division-basics"],
    re: /\bword problem|story|how many|share equally|一共|应用|應用|share equally|应用题/i,
  },
  {
    id: "place-value",
    label: "place value (decimals)",
    topicId: "decimals",
    subject: "math",
    minGrade: 3, coreGrade: 4, maxGrade: 5, band: "elementary",
    re: /\bplace value|ones|tens|hundreds|thousands|位值|个位|十位|百位/i,
  },
  {
    id: "decimals",
    label: "decimals",
    topicId: "decimals",
    subject: "math",
    minGrade: 4, coreGrade: 4, maxGrade: 6, band: "elementary",
    requires: ["place-value"],
    re: /\bdecimal|小数|小數|0\.\d/i,
  },
  {
    id: "fractions-concepts",
    label: "fraction concepts",
    topicId: "fractions",
    subject: "math",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    adjacent: ["ratios-proportions"],
    re: /\bfract|numerator|denominator|分数|分數|分子|分母/i,
  },
  {
    id: "equivalent-fractions",
    label: "equivalent fractions",
    topicId: "fractions",
    subject: "math",
    minGrade: 4, coreGrade: 4, maxGrade: 6, band: "elementary",
    requires: ["fractions-concepts", "multiplication-facts"],
    adjacent: ["ratios-proportions", "decimals"],
    re: /\bequivalent|\bsimplif|约分|約分|等值分数|同分母|通分/i,
  },
  {
    id: "fraction-word-problems",
    label: "fraction word problems",
    topicId: "fractions",
    subject: "math",
    minGrade: 4, coreGrade: 5, maxGrade: 7, band: "elementary",
    requires: ["fractions-concepts", "equivalent-fractions"],
    re: /\bword problem.*fract|story.*fract|fract.*(word|share|story|application|应用题|應用題|应用|應用|一共|共有|剩下|还剩下|還剩下)|share.*fract/i,
  },
  {
    id: "geometry-angles",
    label: "angles & triangles",
    topicId: "geometry",
    subject: "math",
    minGrade: 4, coreGrade: 5, maxGrade: 7, band: "elementary",
    re: /\bangle|triangle|right angle|直角|三角形|角|hypotenuse|斜边|斜邊/i,
  },
  {
    id: "geometry-measure",
    label: "perimeter & area",
    topicId: "geometry",
    subject: "math",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    requires: ["multiplication-facts"],
    adjacent: ["physics-6-8", "volume-intro"],
    re: /\bperimeter|area|周长|周長|面积|面積|square unit/i,
  },
  {
    id: "volume-intro",
    label: "volume of solids",
    topicId: "geometry",
    subject: "math",
    minGrade: 4, coreGrade: 5, maxGrade: 7, band: "elementary",
    requires: ["multiplication-facts", "geometry-measure"],
    adjacent: ["measurement-units"],
    re: /\bvolume|cubic|cm³|m³|体积|體積/i,
  },
  {
    id: "reading-evidence",
    label: "reading with evidence",
    topicId: "reading",
    subject: "ela",
    minGrade: 2, coreGrade: 4, maxGrade: 8, band: "elementary",
    re: /\breading|comprehension|passage|evidence|引用|阅读|閱讀|理解|段落/i,
  },
  {
    id: "narrative-writing",
    label: "narrative writing",
    topicId: "writing",
    subject: "ela",
    minGrade: 2, coreGrade: 4, maxGrade: 8, band: "elementary",
    re: /\bparagraph|essay|writing|story|narrative|作文|写作|寫作|叙事/i,
  },
  {
    id: "earth-moon-sun",
    label: "Earth–Moon–Sun / space",
    topicId: "science-space",
    subject: "science",
    minGrade: 2, coreGrade: 4, maxGrade: 6, band: "elementary",
    adjacent: ["physics-6-8", "ecosystems"],
    re: /\bmoon|phase|solar|planet|earth|sun|月亮|月相|太阳系|太陽系|日食|月食/i,
  },
  {
    id: "ecosystems",
    label: "ecosystems",
    topicId: "science-eco",
    subject: "science",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    adjacent: ["biology-6-8", "env-science"],
    re: /\becosystem|habitat|food chain|生态|生態|食物链|食物鏈/i,
  },
  {
    id: "ancient-civ",
    label: "ancient civilizations",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    adjacent: ["world-history-i"],
    re: /\begypt|mesopotamia|civilization|pharaoh|埃及|美索不|文明|金字塔/i,
  },
  {
    id: "measurement-units",
    label: "measurement units",
    topicId: "math-misc",
    subject: "math",
    minGrade: 3, coreGrade: 4, maxGrade: 6, band: "elementary",
    re: /\b(unit|convert|cm|km|mm|dm|kilogram|gram|测量|单位|换算|單位|換算)\b/i,
  },

  // ── Middle band (G6-8) ─────────────────────────────────────────
  {
    id: "ratios-proportions",
    label: "ratios & proportions",
    topicId: "math-middle",
    subject: "math",
    minGrade: 5, coreGrade: 6, maxGrade: 8, band: "middle",
    requires: ["fractions-concepts", "equivalent-fractions", "multiplication-facts"],
    adjacent: ["statistics-intro", "prealgebra"],
    re: /\bratio|proportion|unit rate|percent|比例|比率|百分比|\%/i,
  },
  {
    id: "expressions-equations",
    label: "expressions & equations",
    topicId: "math-middle",
    subject: "math",
    minGrade: 6, coreGrade: 7, maxGrade: 9, band: "middle",
    requires: ["division-basics", "fractions-concepts"],
    re: /\bequation|expression|variable|solve.*x|代数|方程|算式/i,
  },
  {
    id: "prealgebra",
    label: "prealgebra",
    topicId: "math-middle",
    subject: "math",
    minGrade: 5, coreGrade: 6, maxGrade: 8, band: "middle",
    requires: ["fraction-word-problems", "decimals"],
    re: /\bpre.?algebra|integers|negative|order of operations|pemdas|预代数/i,
  },
  {
    id: "algebra-i",
    label: "algebra I",
    topicId: "math-middle",
    subject: "math",
    minGrade: 6, coreGrade: 7, maxGrade: 9, band: "middle",
    requires: ["prealgebra", "expressions-equations"],
    adjacent: ["physics-6-8"],
    re: /\balgebra|linear|slope|y.*=|inequalit|函数|线性|斜率/i,
  },
  {
    id: "algebra-ii-geometry",
    label: "algebra II & geometry",
    topicId: "math-middle",
    subject: "math",
    minGrade: 7, coreGrade: 8, maxGrade: 10, band: "middle",
    requires: ["algebra-i", "geometry-angles"],
    re: /\bquadratic|parabola|polynomial|similarity|congruence|二次|抛物线|多项式/i,
  },
  {
    id: "statistics-intro",
    label: "statistics intro",
    topicId: "math-middle",
    subject: "math",
    minGrade: 6, coreGrade: 7, maxGrade: 12, band: "middle",
    adjacent: ["scientific-method", "algebra-i"],
    re: /\bmean|median|mode|range|probability|统计|概率|平均数|中位数/i,
  },
  {
    id: "geometry-advanced",
    label: "advanced geometry",
    topicId: "geometry",
    subject: "math",
    minGrade: 7, coreGrade: 8, maxGrade: 10, band: "middle",
    requires: ["geometry-angles", "geometry-measure", "algebra-i"],
    re: /\bPythagorean|theorem|circle theorem|transformation|毕达哥拉斯|勾股/i,
  },
  {
    id: "biology-6-8",
    label: "biology G6-8",
    topicId: "science-bio",
    subject: "science",
    minGrade: 6, coreGrade: 6, maxGrade: 8, band: "middle",
    adjacent: ["chemistry-6-8", "ecosystems"],
    re: /\bcell|organism|DNA|genetics|species|细胞|生物|基因|物种/i,
  },
  {
    id: "chemistry-6-8",
    label: "chemistry G6-8",
    topicId: "science-chem",
    subject: "science",
    minGrade: 6, coreGrade: 7, maxGrade: 8, band: "middle",
    adjacent: ["physics-6-8", "biology-6-8"],
    re: /\batom|element|reaction|molecule|chemical|原子|元素|反应|化学/i,
  },
  {
    id: "physics-6-8",
    label: "physics G6-8",
    topicId: "science-phys",
    subject: "science",
    minGrade: 6, coreGrade: 7, maxGrade: 8, band: "middle",
    adjacent: ["earth-moon-sun", "geometry-measure"],
    re: /\bforce|motion|energy|wave|gravity|newton|力|运动|能量|波|重力/i,
  },
  {
    id: "world-history-i",
    label: "world history & geography I",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 5, coreGrade: 6, maxGrade: 8, band: "middle",
    re: /\bworld history|geography|ancient rome|greece|middle age|世界史|地理|罗马|希腊/i,
  },
  {
    id: "world-history-ii",
    label: "world history & geography II",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 6, coreGrade: 7, maxGrade: 9, band: "middle",
    adjacent: ["us-history"],
    re: /\brevolution|empire|colony|industrial|renaissance|革命|帝国|殖民|工业|文艺复兴/i,
  },
  {
    id: "us-history",
    label: "US history",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 7, coreGrade: 8, maxGrade: 12, band: "middle",
    re: /\bconstitution|civil war|revolutionary|US history|美国|独立|宪法|内战/i,
  },
  {
    id: "argumentative-writing",
    label: "argumentative writing",
    topicId: "writing",
    subject: "ela",
    minGrade: 6, coreGrade: 7, maxGrade: 12, band: "middle",
    requires: ["reading-evidence"],
    adjacent: ["text-analysis"],
    re: /\bargument|thesis|persuasive|debate|counterclaim|论证|论点|论据|辩论/i,
  },
  {
    id: "text-analysis",
    label: "text analysis",
    topicId: "reading",
    subject: "ela",
    minGrade: 6, coreGrade: 7, maxGrade: 12, band: "middle",
    requires: ["reading-evidence"],
    adjacent: ["argumentative-writing"],
    re: /\banaly[sz]|theme|symbol|mood|tone|analysis|分析|主题|象征/i,
  },
  {
    id: "scientific-method",
    label: "scientific method",
    topicId: "science-misc",
    subject: "science",
    minGrade: 6, coreGrade: 7, maxGrade: 12, band: "middle",
    re: /\bhypothesis|experiment|control|variable|data|假设|实验|数据|变量/i,
  },

  // ── High band (G9-12) ──────────────────────────────────────────
  {
    id: "algebra-ii",
    label: "algebra II",
    topicId: "math-high",
    subject: "math",
    minGrade: 9, coreGrade: 9, maxGrade: 12, band: "high",
    requires: ["algebra-i", "algebra-ii-geometry"],
    re: /\balgebra 2|quadratic|polynomial|logarithm|complex number|代数|对数|复数/i,
  },
  {
    id: "trigonometry",
    label: "trigonometry",
    topicId: "math-high",
    subject: "math",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["geometry-advanced", "algebra-ii"],
    re: /\btrig|sin|cos|tan|sine|cosine|tangent|unit circle|三角|正弦|余弦/i,
  },
  {
    id: "precalculus",
    label: "precalculus",
    topicId: "math-high",
    subject: "math",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["algebra-ii", "trigonometry"],
    re: /\bpre.?calc|sequence|series|vector|polar|limit|预微积分|级数|向量/i,
  },
  {
    id: "ap-calculus",
    label: "AP calculus",
    topicId: "math-high",
    subject: "math",
    minGrade: 10, coreGrade: 11, maxGrade: 12, band: "high",
    requires: ["precalculus"],
    re: /\bcalculus|derivative|integral|differenti|differential|dx|微积分|导数|积分/i,
  },
  {
    id: "statistics-ap",
    label: "AP statistics",
    topicId: "math-high",
    subject: "math",
    minGrade: 10, coreGrade: 11, maxGrade: 12, band: "high",
    requires: ["statistics-intro", "algebra-ii"],
    re: /\binference|hypothesis test|confidence interval|chi.square|统计推断|假设检验|置信/i,
  },
  {
    id: "honors-biology",
    label: "Honors/AP biology",
    topicId: "science-bio",
    subject: "science",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["biology-6-8", "chemistry-6-8"],
    re: /\bmitosis|meiosis|enzyme|respiration|photosynthesis|CRISPR|有丝/i,
  },
  {
    id: "honors-chemistry",
    label: "Honors/AP chemistry",
    topicId: "science-chem",
    subject: "science",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["chemistry-6-8", "algebra-ii"],
    re: /\bstoichiometry|equilibrium|thermo|redox|bond|organic|摩尔|平衡|氧化还原/i,
  },
  {
    id: "honors-physics",
    label: "Honors/AP physics",
    topicId: "science-phys",
    subject: "science",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["physics-6-8", "algebra-ii", "trigonometry"],
    re: /\bkinematics|momentum|electromagnetic|circuit|thermodynamic|光学|电路|动量/i,
  },
  {
    id: "env-science",
    label: "AP environmental science",
    topicId: "science-eco",
    subject: "science",
    minGrade: 10, coreGrade: 11, maxGrade: 12, band: "high",
    requires: ["ecosystems", "honors-biology", "chemistry-6-8"],
    re: /\bclimate|pollution|sustainability|biodiversity|renewable|气候|污染|可持续/i,
  },
  {
    id: "ap-english-lang",
    label: "AP English language",
    topicId: "ela-high",
    subject: "ela",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["text-analysis", "argumentative-writing"],
    re: /\brhetoric|synthesis|rhetorical analysis|AP english|修辞|综合/i,
  },
  {
    id: "ap-english-lit",
    label: "AP English literature",
    topicId: "ela-high",
    subject: "ela",
    minGrade: 9, coreGrade: 11, maxGrade: 12, band: "high",
    requires: ["text-analysis"],
    re: /\bliterary analysis|prose|poetry|Shakespeare|novel|文学|诗歌|小说/i,
  },
  {
    id: "ap-world-history",
    label: "AP world history",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 9, coreGrade: 10, maxGrade: 12, band: "high",
    requires: ["world-history-i", "world-history-ii"],
    re: /\bDBQ|LEQ|global trade|empire|monarchy|democracy/,
  },
  {
    id: "ap-us-history",
    label: "AP US history",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 10, coreGrade: 11, maxGrade: 12, band: "high",
    requires: ["us-history"],
    re: /\bAPUSH|founding fathers|Progressive Era|cold war|Vietnam|新政|冷战|进步/i,
  },
  {
    id: "ap-economics",
    label: "AP micro/macro economics",
    topicId: "humanities",
    subject: "humanities",
    minGrade: 10, coreGrade: 12, maxGrade: 12, band: "high",
    re: /\bsupply|demand|elasticity|GDP|inflation|monetary|fiscal|供需|弹性|通胀/i,
  },
  {
    id: "research-capstone",
    label: "capstone research",
    topicId: "general-high",
    subject: "general",
    minGrade: 11, coreGrade: 12, maxGrade: 12, band: "high",
    re: /\bresearch|dissertation|capstone|senior project|methodology|论文|研究|方法论/i,
  },
];

const BY_ID = new Map(SKILL_CATALOG.map((s) => [s.id, s]));

export function getSkillDef(id: string): SkillDef | undefined {
  return BY_ID.get(id);
}

/**
 * Filter skill catalog by grade range — only skills where minGrade ≤ grade ≤ maxGrade.
 * Used for BKT initialization, ZPD warm-up, and skill prompts.
 */
export function activeSkillsForProfile(grade: number): SkillDef[] {
  return SKILL_CATALOG.filter((s) => s.minGrade <= grade && grade <= s.maxGrade);
}

/**
 * Return the prerequisite chain for a skill up to `depth` levels.
 * Used by ZPD warm-up to never suggest a skill whose prereq pKnown < 0.60.
 */
export function prerequisiteChain(skillId: string, depth = 3): string[] {
  const chain: string[] = [];
  let current = getSkillDef(skillId);
  for (let i = 0; i < depth && current; i++) {
    if (current.requires?.length) {
      for (const reqId of current.requires) {
        if (!chain.includes(reqId)) {
          chain.push(reqId);
          const reqDef = getSkillDef(reqId);
          if (reqDef?.requires?.length) {
            current = reqDef;
            continue;
          }
        }
      }
    }
    current = undefined;
  }
  return chain;
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

// ── Multi-lingual Word-problem Parsing (Phase 0.6) ─────────────────

export type DetectedLanguage = "en" | "zh-CN" | "zh-HK" | "mixed";

/**
 * Detect the language of student input.
 * Uses character-density heuristics: CJK block ranges for Chinese,
 * Latin for English, with special treatment for code-switching.
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || !text.trim()) return "en";
  const t = text.trim();
  const cjkCount = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latinCount = (t.match(/[a-zA-Z]/g) || []).length;
  const total = cjkCount + latinCount || 1;

  if (cjkCount === 0) return "en";
  if (latinCount === 0) {
    // Check for 繁體 indicators (HK/TW specific chars)
    if (
      /[嘅咁啲喺嗰嚟嘢啱嘥]/u.test(t) ||
      /(唔該|係咪|睇下|邊個|點解|而家|乜嘢|點樣)/u.test(t)
    )
      return "zh-HK";
    return "zh-CN";
  }

  // Mixed: determine dominant
  if (cjkCount / total > 0.55) {
    return /[嘅咁啲喺嗰嚟嘢啱嘥]/u.test(t)
      ? "zh-HK"
      : "zh-CN";
  }
  if (latinCount / total > 0.55) return "en";
  return "mixed";
}

/**
 * Detect if text contains word-problem phrasing (in any language).
 */
export function isWordProblem(text: string): boolean {
  return /(word problem|story|how many|share equally|一共|应用|應用|share equally|应用题)/i.test(
    text,
  );
}

/**
 * Infer skills with language-aware regex — matches both EN and 中文 patterns.
 * Also returns the detected language for downstream prompt hints.
 */
export function inferSkillsFromTextMultiLang(
  text: string,
): { skills: SkillDef[]; language: DetectedLanguage } {
  const lang = detectLanguage(text);
  const t = text || "";
  const hits: SkillDef[] = [];

  for (const skill of SKILL_CATALOG) {
    if (skill.re.test(t)) hits.push(skill);
  }

  // Multi-lingual word-problem boost: detect fraction + story patterns
  if (
    /\b(fract|分数|分數)/i.test(t) &&
    /\b(word problem|story|应用|應用|how many|一共)/i.test(t)
  ) {
    const wp = BY_ID.get("fraction-word-problems");
    if (wp && !hits.some((h) => h.id === wp.id)) hits.push(wp);
  }

  return { skills: hits, language: lang };
}
