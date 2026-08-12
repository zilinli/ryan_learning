/**
 * Client-side facts fast-path (P0, report §8.2).
 * Narrow, exact, deterministic lookups only — never invents pedagogy:
 * unit conversion, distance=speed×time, square/cube, powers of 2,
 * simple percentage and halves. Anything ambiguous returns null (Agent path).
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
    tryPercentAndHalf(t)
  );
}
