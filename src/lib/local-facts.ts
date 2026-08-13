/**
 * Client-side facts fast-path (P0, report §8.2).
 * Narrow, exact, deterministic lookups only — never invents pedagogy:
 * unit conversion, distance=speed×time, square/cube, powers of 2,
 * simple percentage and halves, small-arithmetic tables, temperature,
 * common-fraction decimals, rectangle/square perimeter & area.
 * Anything ambiguous returns null (Agent path).
 */

export type LocalFactHit = {
  question: string;
  answer: string;
  reply: string;
};

type Unit = { name: string; aliases: string[]; toBase: number };
type UnitFamily = {
  id: string;
  base: string;
  units: Unit[];
};

const FAMILIES: UnitFamily[] = [
  {
    id: "length",
    base: "m",
    units: [
      { name: "km", aliases: ["km", "千米", "公里", "公裡"], toBase: 1000 },
      { name: "m", aliases: ["m", "米", "公尺"], toBase: 1 },
    ],
  },
  {
    id: "mass",
    base: "g",
    units: [
      { name: "kg", aliases: ["kg", "千克", "公斤"], toBase: 1000 },
      { name: "g", aliases: ["g", "克", "公克"], toBase: 1 },
    ],
  },
  {
    id: "volume",
    base: "mL",
    units: [
      { name: "L", aliases: ["l", "L", "升"], toBase: 1000 },
      { name: "mL", aliases: ["ml", "mL", "毫升"], toBase: 1 },
    ],
  },
  {
    id: "time",
    base: "min",
    units: [
      {
        name: "h",
        aliases: ["h", "hr", "hour", "hours", "小时", "時", "时"],
        toBase: 60,
      },
      {
        name: "min",
        aliases: ["min", "minute", "minutes", "分钟", "分"],
        toBase: 1,
      },
    ],
  },
];

function findUnit(token: string): { unit: Unit; family: UnitFamily } | null {
  const lower = token.toLowerCase();
  for (const family of FAMILIES) {
    for (const unit of family.units) {
      if (unit.aliases.some((a) => a.toLowerCase() === lower)) {
        return { unit, family };
      }
    }
  }
  return null;
}

/** Join all unit aliases for a family into a capture-free alternation. */
function familyAliases(family: UnitFamily): string {
  const set = new Set<string>();
  for (const u of family.units) {
    for (const a of u.aliases) set.add(a);
  }
  return [...set].sort((a, b) => b.length - a.length).join("|");
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Number.isInteger(v)) return String(v);
  // 2 decimals max — enough for unit conversions like m→km
  return String(Math.round(v * 100) / 100);
}

const NUM = "(\\d{1,6})";
const NUM_DEC = "(\\d{1,6}(?:\\.\\d{1,3})?)";

/** Symbolic / English: `3 km = ? m`, `3 km = m`, `12m=?km` */
const SYM_RE = (aliases: string) =>
  new RegExp(
    `^\\s*${NUM_DEC}\\s*(${aliases})\\s*[=＝]\\s*\\??\\s*(${aliases})\\s*\\??\\s*$`,
    "i",
  );

/** Chinese: `3 千米等于多少米`, `3千米=几米`, `3公里是多少米` */
const CN_RE = (aliases: string) =>
  new RegExp(
    `^\\s*${NUM_DEC}\\s*(${aliases})\\s*(?:等于|是|=)?\\s*(?:多少|几)?\\s*(${aliases})\\s*\\??\\s*$`,
  );

function tryUnitConversion(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 40) return null;
  for (const family of FAMILIES) {
    const aliases = familyAliases(family);
    const m = SYM_RE(aliases).exec(t) || CN_RE(aliases).exec(t);
    if (!m) continue;
    const a = Number(m[1]);
    const from = findUnit(m[2]);
    const to = findUnit(m[3]);
    if (!Number.isFinite(a) || !from || !to) continue;
    if (from.family.id !== to.family.id) continue;
    const value = (a * from.unit.toBase) / to.unit.toBase;
    const out = formatValue(value);
    if (!out) continue;
    return {
      question: t,
      answer: out,
      reply: `Yes — ${a} ${from.unit.name} = ${out} ${to.unit.name}.`,
    };
  }
  return null;
}

/** `60 km/h 2 h`, `60千米每小时2小时` → 路程 = 120 km */
const DISTANCE_RE = new RegExp(
  `^\\s*${NUM}\\s*(?:km/h|千米每?小时|公里每?小时|千米/时|公里/时)\\s*(?:和|与|and|，|,)?\\s*${NUM}\\s*(?:h|hr|小时|时|hour|hours)\\s*(?:的)?(?:路程|距离|distance)?\\s*\\??\\s*$`,
  "i",
);

function tryDistanceFormula(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 40) return null;
  const m = DISTANCE_RE.exec(t);
  if (!m) return null;
  const speed = Number(m[1]);
  const hours = Number(m[2]);
  if (!Number.isFinite(speed) || !Number.isFinite(hours)) return null;
  const out = formatValue(speed * hours);
  return {
    question: t,
    answer: out,
    reply: `Yes — ${speed} km/h × ${hours} h = ${out} km.`,
  };
}

/** `12²`, `12^2`, `12的平方`, `12 squared`; `3³`, `3的立方`, `3 cubed` */
const SQUARE_RE = /^\s*(\d{1,4})\s*(?:²|\^2|的平方|squared)\s*\??\s*$/i;
const CUBE_RE = /^\s*(\d{1,4})\s*(?:³|\^3|的立方|cubed)\s*\??\s*$/i;

function tryPowerTable(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 24) return null;
  const sq = SQUARE_RE.exec(t);
  if (sq) {
    const n = Number(sq[1]);
    const out = n * n;
    if (!Number.isFinite(out) || out > 10_000_000) return null;
    return {
      question: t,
      answer: String(out),
      reply: `Yes — ${n}² = ${out}.`,
    };
  }
  const cu = CUBE_RE.exec(t);
  if (cu) {
    const n = Number(cu[1]);
    const out = n * n * n;
    if (!Number.isFinite(out) || out > 10_000_000) return null;
    return {
      question: t,
      answer: String(out),
      reply: `Yes — ${n}³ = ${out}.`,
    };
  }
  return null;
}

const POW2_SYM_RE = /^\s*2\s*\^\s*(\d{1,2})\s*\??\s*$/;
const POW2_CN_RE = /^\s*2\s*的\s*(\d{1,2})\s*次方\s*\??\s*$/;

function tryPowerOfTwo(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 24) return null;
  const m = POW2_SYM_RE.exec(t) || POW2_CN_RE.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 0 || n > 12) return null;
  const out = 2 ** n;
  return {
    question: t,
    answer: String(out),
    reply: `Yes — 2^${n} = ${out}.`,
  };
}

/** `50% of 200`, `50%的200`, `half of 84`, `84的一半` */
const PERCENT_RE = /^\s*(\d{1,4})\s*%\s*(?:of|的)?\s*(\d{1,6})\s*\??\s*$/i;
const HALF_RE = /^\s*(?:half of)\s*(\d{1,6})\s*\??\s*$/i;
const HALF_CN_RE = /^\s*(\d{1,6})\s*的\s*一半\s*\??\s*$/;

function tryPercentAndHalf(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 24) return null;
  const p = PERCENT_RE.exec(t);
  if (p) {
    const pct = Number(p[1]);
    const base = Number(p[2]);
    if (pct > 100) return null;
    const out = formatValue((pct / 100) * base);
    if (!out) return null;
    return {
      question: t,
      answer: out,
      reply: `Yes — ${pct}% of ${base} = ${out}.`,
    };
  }
  const h = HALF_RE.exec(t) || HALF_CN_RE.exec(t);
  if (h) {
    const n = Number(h[1]);
    if (n % 2 !== 0) return null;
    return {
      question: t,
      answer: String(n / 2),
      reply: `Yes — half of ${n} = ${n / 2}.`,
    };
  }
  return null;
}

/** `7×8`, `7 x 8`, `7*8`, `7 times 8`, `七乘八`, `7乘8` → 56 */
const MUL_RE =
  /^\s*(\d{1,3})\s*(?:×|\*|\bx\b|乘|times|multiplied by)\s*(\d{1,3})\s*(?:=?=?)\s*\??\s*$/i;
/** `8+3`, `8加3`, `12-5`, `12减5`, `24/6`, `24除6` → small arithmetic */
const ADD_RE =
  /^\s*(\d{1,4})\s*(?:\+|\bplus\b|加|加上)\s*(\d{1,4})\s*\??\s*$/i;
const SUB_RE =
  /^\s*(\d{1,4})\s*(?:-|−|–|\bminus\b|减|减去|减去)\s*(\d{1,4})\s*\??\s*$/i;
const DIV_RE =
  /^\s*(\d{1,5})\s*(?:÷|\/|\bdivided by\b|除以|除)\s*(\d{1,3})\s*\??\s*$/i;

function tryArithmeticTable(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 28) return null;
  const mul = MUL_RE.exec(t);
  if (mul) {
    const a = Number(mul[1]);
    const b = Number(mul[2]);
    if (a > 12 || b > 12) return null;
    const out = a * b;
    if (!Number.isFinite(out)) return null;
    return {
      question: t,
      answer: String(out),
      reply: `Yes — ${a} × ${b} = ${out}.`,
    };
  }
  const add = ADD_RE.exec(t);
  if (add) {
    const a = Number(add[1]);
    const b = Number(add[2]);
    if (a > 9999 || b > 9999) return null;
    return {
      question: t,
      answer: String(a + b),
      reply: `Yes — ${a} + ${b} = ${a + b}.`,
    };
  }
  const sub = SUB_RE.exec(t);
  if (sub) {
    const a = Number(sub[1]);
    const b = Number(sub[2]);
    if (a > 9999 || b > 9999) return null;
    return {
      question: t,
      answer: String(a - b),
      reply: `Yes — ${a} − ${b} = ${a - b}.`,
    };
  }
  const div = DIV_RE.exec(t);
  if (div) {
    const a = Number(div[1]);
    const b = Number(div[2]);
    if (b === 0 || a % b !== 0) return null;
    if (a > 100_000) return null;
    return {
      question: t,
      answer: String(a / b),
      reply: `Yes — ${a} ÷ ${b} = ${a / b}.`,
    };
  }
  return null;
}

/** `68°F in C`, `100°C to F`, `20摄氏度等于多少华氏度` */
const TEMP_C2F_RE =
  /^\s*(\d{1,3})\s*°?\s*(?:C|celsius|摄氏度)\s*(?:等于\s*多少|in|to|等于|=|多少|→)?\s*(?:F|fahrenheit|华氏度|华氏)?\s*\??\s*$/;
const TEMP_F2C_RE =
  /^\s*(\d{1,3})\s*°?\s*(?:F|fahrenheit|华氏度|华氏)\s*(?:等于\s*多少|in|to|等于|=|多少|→)?\s*(?:C|celsius|摄氏度|摄氏)?\s*\??\s*$/;

function tryTemperature(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 30) return null;
  const c2f = TEMP_C2F_RE.exec(t);
  if (c2f) {
    const c = Number(c2f[1]);
    if (c > 500) return null;
    const f = (c * 9) / 5 + 32;
    return {
      question: t,
      answer: formatValue(f),
      reply: `Yes — ${c}°C = ${formatValue(f)}°F.`,
    };
  }
  const f2c = TEMP_F2C_RE.exec(t);
  if (f2c) {
    const f = Number(f2c[1]);
    if (f > 1000) return null;
    const c = ((f - 32) * 5) / 9;
    return {
      question: t,
      answer: formatValue(c),
      reply: `Yes — ${f}°F = ${formatValue(c)}°C.`,
    };
  }
  return null;
}

/** `1/2 as a decimal`, `3/4是多少` */
const FRAC_DEC_RE = /^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:as a decimal|小数|是多少|等于多少)?\s*\??\s*$/;

function tryFractionDecimal(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 24) return null;
  const m = FRAC_DEC_RE.exec(t);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b === 0 || a > b || a > 100 || b > 100) return null;
  if (a % b === 0) return null; // whole numbers are handled elsewhere
  const out = formatValue(a / b);
  return {
    question: t,
    answer: out,
    reply: `Yes — ${a}/${b} = ${out}.`,
  };
}

/** `perimeter of rectangle 4 and 6`, `面积 长3 宽5`, `square area 5` */
const PERIM_RECT_RE =
  /^\s*(?:perimeter|周长|周長)\s*(?:of|of a|of the)?\s*(?:rectangle|rect|长方形|長方形|矩形)?\s*(?:长|長|length)?\s*(\d{1,4})\s*(?:and|和|,|，|×|\*)?\s*(?:宽|寬|width)?\s*(\d{1,4})\s*\??\s*$/i;
const AREA_RECT_RE =
  /^\s*(?:area|面积|面積)\s*(?:of|of a|of the)?\s*(?:rectangle|rect|长方形|長方形|矩形)?\s*(?:长|長|length)?\s*(\d{1,4})\s*(?:and|和|,|，|×|\*)?\s*(?:宽|寬|width)?\s*(\d{1,4})\s*\??\s*$/i;
const AREA_SQUARE_RE =
  /^\s*(?:area|面积|面積)\s*(?:of|of a|of the)?\s*(?:square|正方形)?\s*(\d{1,4})\s*\??\s*$/i;

function tryShapesFormulas(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 34) return null;
  const pr = PERIM_RECT_RE.exec(t);
  if (pr) {
    const a = Number(pr[1]);
    const b = Number(pr[2]);
    if (a > 9999 || b > 9999) return null;
    const out = 2 * (a + b);
    return {
      question: t,
      answer: String(out),
      reply: `Yes — perimeter = 2 × (${a} + ${b}) = ${out}.`,
    };
  }
  const ar = AREA_RECT_RE.exec(t);
  if (ar) {
    const a = Number(ar[1]);
    const b = Number(ar[2]);
    if (a > 999 || b > 999) return null;
    const out = a * b;
    return {
      question: t,
      answer: String(out),
      reply: `Yes — area = ${a} × ${b} = ${out}.`,
    };
  }
  const asq = AREA_SQUARE_RE.exec(t);
  if (asq) {
    const n = Number(asq[1]);
    if (n > 999) return null;
    const out = n * n;
    return {
      question: t,
      answer: String(out),
      reply: `Yes — area = ${n}² = ${out}.`,
    };
  }
  return null;
}

/** `double 6`, `triple 8`, `double of 6`, `6的2倍`, `6的两倍` */
const DOUBLE_RE = /^\s*(?:double|twice|加倍|翻倍)\s*(?:of)?\s*(\d{1,6})\s*\??\s*$/i;
const TRIPLE_RE = /^\s*(?:triple|三倍)\s*(?:of)?\s*(\d{1,6})\s*\??\s*$/i;
const DOUBLE_CN_RE = /^\s*(\d{1,6})\s*的\s*(?:两|2)倍\s*\??\s*$/;
const TRIPLE_CN_RE = /^\s*(\d{1,6})\s*的\s*(?:三|3)倍\s*\??\s*$/;

function tryDoubleTriple(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 20) return null;
  const d = DOUBLE_RE.exec(t) || DOUBLE_CN_RE.exec(t);
  if (d) {
    const n = Number(d[1]);
    if (n > 1_000_000) return null;
    return {
      question: t,
      answer: String(n * 2),
      reply: `Yes — double ${n} = ${n * 2}.`,
    };
  }
  const tr = TRIPLE_RE.exec(t) || TRIPLE_CN_RE.exec(t);
  if (tr) {
    const n = Number(tr[1]);
    if (n > 1_000_000) return null;
    return {
      question: t,
      answer: String(n * 3),
      reply: `Yes — triple ${n} = ${n * 3}.`,
    };
  }
  return null;
}

/**
 * Match a narrow set of facts. Returns null for anything else (Agent path).
 */
export function tryLocalFacts(text: string): LocalFactHit | null {
  const t = text.trim();
  if (!t || t.length > 40) return null;
  return (
    tryUnitConversion(t) ??
    tryDistanceFormula(t) ??
    tryPowerTable(t) ??
    tryPowerOfTwo(t) ??
    tryPercentAndHalf(t) ??
    tryArithmeticTable(t) ??
    tryTemperature(t) ??
    tryFractionDecimal(t) ??
    tryShapesFormulas(t) ??
    tryDoubleTriple(t)
  );
}
