/**
 * Narrow client-side recall fast-path (UX-RPT.7 / Slice A).
 * Only exact two-operand arithmetic — never invent pedagogy here.
 */

export type LocalRecallHit = {
  question: string;
  answer: number;
  reply: string;
};

const OP = "([+＋\\-−–×xX*÷/])";
const NUM = "(\\d{1,4})";
const RE = new RegExp(
  `^\\s*${NUM}\\s*${OP}\\s*${NUM}\\s*[=＝]?\\s*\\??\\s*$`,
);

function normalizeOp(raw: string): "+" | "-" | "*" | "/" {
  if (raw === "+" || raw === "＋") return "+";
  if (raw === "-" || raw === "−" || raw === "–") return "-";
  if (raw === "×" || raw === "x" || raw === "X" || raw === "*") return "*";
  return "/";
}

function compute(a: number, op: "+" | "-" | "*" | "/", b: number): number | null {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (b === 0) return null;
  if (a % b !== 0) return null; // only exact integer division
  return a / b;
}

/**
 * Match pure recall arithmetic. Returns null for anything else (Agent path).
 */
export function tryLocalRecall(text: string): LocalRecallHit | null {
  const t = text.trim();
  if (!t || t.length > 32) return null;
  if (/[a-zA-Z\u4e00-\u9fff]/.test(t.replace(/[xX]/g, ""))) return null;
  const m = RE.exec(t);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a > 9999 || b > 9999) return null;
  const op = normalizeOp(m[2]!);
  // Keep times-table / small facts in the fast path; big multi-digit stays with Agent (mode C).
  if (op === "*" && (a > 12 || b > 12)) return null;
  if (op === "/" && (b > 12 || a > 144)) return null;
  const answer = compute(a, op, b);
  if (answer === null || !Number.isFinite(answer)) return null;
  const sym =
    op === "*" ? "×" : op === "/" ? "÷" : op === "-" ? "−" : "+";
  return {
    question: `${a}${sym}${b}`,
    answer,
    reply: `Yes — ${a}${sym}${b}=${answer}. Want a quick way to remember it?`,
  };
}
